import crypto from "node:crypto";
import { sql } from "@/lib/db/client";
import { logDbError } from "@/lib/db/client";

/**
 * Port of the Groq call in public/student/course_ai_chat_api.php (aiCallGroq) plus the
 * prompt builder, the message loader and all eight actions.
 *
 * PHP threw uncaught RuntimeExceptions on provider failure (a 500 HTML page for the
 * widget). The port returns the same message in a JSON `error` field so the widget can
 * display it; the wording of every error is unchanged.
 */

const GROQ_TIMEOUT_MS = 60_000;
const GROQ_CONNECT_TIMEOUT_MS = 15_000;
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4096;

export type AiVersion = { content: string; created_at: string };
export type AiRow = {
  id: number;
  chat_id: number;
  course_id: number;
  user_id: number;
  role: "user" | "assistant";
  content: string;
  versions: AiVersion[] | null;
  active_version: number;
  feedback: string | null;
  created_at: Date;
};

export type AiMessage = {
  id: number;
  role: string;
  content: string;
  versions: AiVersion[];
  active_version: number;
  feedback: string | null;
};

export class AiError extends Error {}

export function groqEndpoint(): string {
  return process.env.GROQ_ENDPOINT ?? "https://api.groq.com/openai/v1/chat/completions";
}

export function groqModel(): string {
  return process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
}

export async function aiCallGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY ?? "";
  if (key === "") throw new AiError("GROQ_API_KEY not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(groqEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: groqModel(),
        messages: [{ role: "user", content: prompt }],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "Groq cURL error: Operation timed out" : `Groq cURL error: ${err instanceof Error ? err.message : String(err)}`;
    throw new AiError(message);
  } finally {
    clearTimeout(timer);
    void GROQ_CONNECT_TIMEOUT_MS;
  }

  const raw = await response.text();
  if (response.status !== 200) {
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* keep the HTTP status */
    }
    throw new AiError(`Groq error: ${message}`);
  }

  let decoded: { choices?: { message?: { content?: string } }[] };
  try {
    decoded = JSON.parse(raw) as typeof decoded;
  } catch {
    throw new AiError("Groq returned empty response");
  }

  const text = decoded.choices?.[0]?.message?.content ?? "";
  if (text === "") throw new AiError("Groq returned empty response");
  return text;
}

/** Port of getOrCreateChat(): one chat row per (course, user). */
export async function getOrCreateChat(courseId: number, userId: number): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM course_ai_chats WHERE course_id = ${courseId} AND user_id = ${userId}
  `;
  if (rows.length) return Number(rows[0].id);
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO course_ai_chats (course_id, user_id) VALUES (${courseId}, ${userId}) RETURNING id
  `;
  return Number(inserted[0].id);
}

/** Port of loadMessages(): ordered by created_at then id, versions decoded. */
export async function loadMessages(chatId: number): Promise<AiMessage[]> {
  const rows = await sql<AiRow[]>`
    SELECT id, chat_id, course_id, user_id, role, content, versions, active_version, feedback, created_at
    FROM course_ai_messages WHERE chat_id = ${chatId} ORDER BY created_at ASC, id ASC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    role: r.role,
    content: r.content,
    versions: Array.isArray(r.versions) ? r.versions : [],
    active_version: Number(r.active_version ?? 0),
    feedback: r.feedback ?? null,
  }));
}

/** Port of buildPrompt(): one flat user message, description truncated to 500 chars. */
export async function buildPrompt(messages: AiMessage[], courseId: number): Promise<string> {
  const rows = await sql<{ title: string; description: string | null }[]>`
    SELECT title, description FROM courses WHERE id = ${courseId}
  `;
  const title = rows[0]?.title ?? "the course";
  const desc = (rows[0]?.description ?? "").slice(0, 500);

  let prompt = `You are an AI tutor for the course '${title}'. `;
  if (desc) prompt += `Course description: ${desc}. `;
  prompt += "Answer the student's questions about this course. Use Markdown formatting.\n\n";
  prompt += "Conversation so far:\n";
  for (const m of messages) {
    const role = m.role === "assistant" ? "Tutor" : "Student";
    prompt += `${role}: ${m.content}\n`;
  }
  prompt += "Tutor:";
  return prompt;
}

function phpDateNow(): string {
  // PHP's date('Y-m-d H:i:s') in Asia/Kolkata, which is what the versions JSON records.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export type ActionResult =
  | { kind: "messages"; messages: AiMessage[] }
  | { kind: "ok"; feedback?: string | null }
  | { kind: "slug"; slug: string | null }
  | { kind: "error"; error: string };

export async function handleAction(
  action: string,
  payload: Record<string, unknown>,
  userId: number,
  courseId: number,
): Promise<ActionResult> {
  switch (action) {
    case "get_messages": {
      const chatId = await getOrCreateChat(courseId, userId);
      return { kind: "messages", messages: await loadMessages(chatId) };
    }

    case "send": {
      const content = String(payload.content ?? "").trim();
      if (content === "") return { kind: "error", error: "Empty message" };

      const chatId = await getOrCreateChat(courseId, userId);
      const now = phpDateNow();

      await sql`
        INSERT INTO course_ai_messages (chat_id, course_id, user_id, role, content, versions, active_version)
        VALUES (${chatId}, ${courseId}, ${userId}, 'user', ${content},
                ${JSON.stringify([{ content, created_at: now }])}::jsonb, 0)
      `;

      const messages = await loadMessages(chatId);
      const reply = await aiCallGroq(await buildPrompt(messages, courseId));

      await sql`
        INSERT INTO course_ai_messages (chat_id, course_id, user_id, role, content, versions, active_version)
        VALUES (${chatId}, ${courseId}, ${userId}, 'assistant', ${reply},
                ${JSON.stringify([{ content: reply, created_at: now }])}::jsonb, 0)
      `;

      return { kind: "messages", messages: await loadMessages(chatId) };
    }

    case "retry": {
      const messageId = Number(payload.message_id ?? 0);
      if (!(messageId > 0)) return { kind: "error", error: "Invalid message" };

      const rows = await sql<AiRow[]>`
        SELECT * FROM course_ai_messages WHERE id = ${messageId} AND user_id = ${userId}
      `;
      const msg = rows[0];
      if (!msg || msg.role !== "assistant") return { kind: "error", error: "Not found" };

      const chatId = Number(msg.chat_id);
      const versions: AiVersion[] = Array.isArray(msg.versions) ? [...msg.versions] : [];
      if (msg.content !== "") versions.push({ content: msg.content, created_at: phpDateNow() });

      const allMessages = await loadMessages(chatId);
      const newReply = await aiCallGroq(await buildPrompt(allMessages, courseId));
      versions.push({ content: newReply, created_at: phpDateNow() });

      await sql`
        UPDATE course_ai_messages
        SET content = ${newReply}, versions = ${JSON.stringify(versions)}::jsonb, active_version = ${versions.length - 1}
        WHERE id = ${messageId}
      `;

      return { kind: "messages", messages: await loadMessages(chatId) };
    }

    case "edit_message": {
      const messageId = Number(payload.message_id ?? 0);
      const newContent = String(payload.content ?? "").trim();
      if (!(messageId > 0) || newContent === "") return { kind: "error", error: "Invalid" };

      const rows = await sql<AiRow[]>`
        SELECT * FROM course_ai_messages WHERE id = ${messageId} AND user_id = ${userId}
      `;
      const msg = rows[0];
      if (!msg || msg.role !== "user") return { kind: "error", error: "Not found" };

      const chatId = Number(msg.chat_id);
      const versions: AiVersion[] = Array.isArray(msg.versions) ? [...msg.versions] : [];
      versions.push({ content: newContent, created_at: phpDateNow() });
      const newActive = versions.length - 1;

      await sql`
        UPDATE course_ai_messages
        SET content = ${newContent}, versions = ${JSON.stringify(versions)}::jsonb, active_version = ${newActive}
        WHERE id = ${messageId}
      `;

      // Regenerate the next assistant reply with the edited turn in place.
      const next = await sql<{ id: number }[]>`
        SELECT id FROM course_ai_messages
        WHERE chat_id = ${chatId} AND role = 'assistant' AND id > ${messageId}
        ORDER BY id ASC LIMIT 1
      `;
      if (next.length) {
        const aiId = Number(next[0].id);
        const all = (await loadMessages(chatId)).filter((m) => m.id !== aiId);
        const newReply = await aiCallGroq(await buildPrompt(all, courseId));
        const now = phpDateNow();
        await sql`
          UPDATE course_ai_messages
          SET content = ${newReply}, versions = ${JSON.stringify([{ content: newReply, created_at: now }])}::jsonb, active_version = 0
          WHERE id = ${aiId}
        `;
      }

      return { kind: "messages", messages: await loadMessages(chatId) };
    }

    case "switch_version": {
      const messageId = Number(payload.message_id ?? 0);
      const versionIndex = Number(payload.version_index ?? 0);
      if (!(messageId > 0)) return { kind: "error", error: "Invalid" };

      const rows = await sql<AiRow[]>`
        SELECT * FROM course_ai_messages WHERE id = ${messageId} AND user_id = ${userId}
      `;
      const msg = rows[0];
      if (!msg) return { kind: "error", error: "Not found" };

      const versions: AiVersion[] = Array.isArray(msg.versions) ? msg.versions : [];
      const target = versions[versionIndex];
      if (!target) return { kind: "error", error: "Version not found" };

      await sql`
        UPDATE course_ai_messages SET content = ${target.content}, active_version = ${versionIndex}
        WHERE id = ${messageId}
      `;

      return { kind: "messages", messages: await loadMessages(Number(msg.chat_id)) };
    }

    case "feedback": {
      const messageId = Number(payload.message_id ?? 0);
      const feedback = String(payload.feedback ?? "");
      if (!(messageId > 0) || !["like", "dislike", "none"].includes(feedback)) {
        return { kind: "error", error: "Invalid" };
      }
      const rows = await sql<{ id: number; feedback: string | null }[]>`
        SELECT id, feedback FROM course_ai_messages WHERE id = ${messageId} AND user_id = ${userId}
      `;
      if (!rows.length) return { kind: "error", error: "Not found" };
      // Toggling the same value clears it, exactly as the PHP does.
      const newFeedback = rows[0].feedback === feedback ? null : feedback;
      await sql`UPDATE course_ai_messages SET feedback = ${newFeedback} WHERE id = ${messageId}`;
      return { kind: "ok", feedback: newFeedback };
    }

    case "share": {
      const chatId = await getOrCreateChat(courseId, userId);
      const existing = await sql<{ slug: string }[]>`
        SELECT slug FROM course_ai_share_links WHERE chat_id = ${chatId} AND user_id = ${userId}
      `;
      if (existing.length) return { kind: "slug", slug: existing[0].slug };

      const slug = crypto.randomBytes(4).toString("hex");
      await sql`
        INSERT INTO course_ai_share_links (slug, chat_id, user_id) VALUES (${slug}, ${chatId}, ${userId})
      `;
      return { kind: "slug", slug };
    }

    case "get_share": {
      const chatId = await getOrCreateChat(courseId, userId);
      const existing = await sql<{ slug: string }[]>`
        SELECT slug FROM course_ai_share_links WHERE chat_id = ${chatId} AND user_id = ${userId}
      `;
      return { kind: "slug", slug: existing[0]?.slug ?? null };
    }

    default:
      void logDbError;
      return { kind: "error", error: "Unknown action" };
  }
}