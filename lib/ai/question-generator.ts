import { config } from "@/lib/config";
import type { TestQuestion } from "@/lib/instructor/test-tokens";

export class AiError extends Error {}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function aiTokenTimeoutMs(): number {
  return num("AI_REQUEST_TIMEOUT", 45) * 1000;
}


async function postJson(url: string, payload: unknown, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTokenTimeoutMs());
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
      let msg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        msg = parsed.error?.message ?? msg;
      } catch {
        // keep the HTTP status message
      }
      throw new AiError(msg);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const text =
      ((data.candidates as { content?: { parts?: { text?: string }[] } }[])?.[0]?.content?.parts?.[0]?.text) ||
      ((data.choices as { message?: { content?: string } }[])?.[0]?.message?.content) ||
      "";
    if (!text) throw new AiError("AI returned an empty response.");
    return text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    const e = err as Error & { cause?: unknown };
    if (e.name === "AbortError") throw new AiError("Network error contacting AI service (timeout).");
    throw new AiError(`Network error contacting AI service: ${e.cause ?? e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function buildQuestionPrompt(d: Record<string, unknown>): string {
  const profile = (d.profile ?? {}) as Record<string, unknown>;
  const credentials = (d.credentials ?? {}) as Record<string, unknown>;
  const competency = (d.competency ?? {}) as Record<string, unknown>;

  const subject = (competency.primary_subject as string) || "General";
  const secondary = (competency.secondary_subjects as string) || "";
  const skillLevel = (competency.skill_level as string) || "intermediate";
  const audience = (competency.target_audience as string) || "general learners";
  const ideas = (competency.course_ideas as string) || "";
  const education = (credentials.highest_education as string) || "";
  const field = (credentials.field_of_study as string) || "";
  const certs = (credentials.certifications as string) || "";
  const yearsExp = Number(profile.years_exp ?? 0);
  const bio = (profile.bio as string) || "";
  const n = config.TEST_QUESTION_COUNT;

  return `You are an expert educational evaluator. An instructor has applied to teach online courses.
Based on their profile below, generate exactly ${n} multiple-choice questions to verify
their subject-matter competency and teaching readiness.

─── Instructor Profile ───
• Primary subject : ${subject}
• Secondary subjects: ${secondary}
• Self-rated skill level: ${skillLevel}
• Target audience : ${audience}
• Course ideas    : ${ideas}
• Highest education: ${education} in ${field}
• Certifications  : ${certs}
• Years of experience: ${yearsExp}
• Bio excerpt     : ${bio}

─── Instructions ───
- Questions must be relevant to "${subject}" and teaching methodology.
- Mix conceptual knowledge questions with practical/pedagogical ones.
- Each question should have exactly 4 options (A, B, C, D).
- One option is clearly correct; the others are plausible distractors.
- Difficulty should match a ${skillLevel}-level expert.
- Output ONLY a raw JSON array — no markdown fences, no explanation.

─── Required JSON format ───
[
  {
    "question": "Question text here?",
    "options": {
      "A": "Option A text",
      "B": "Option B text",
      "C": "Option C text",
      "D": "Option D text"
    },
    "answer": "A"
  }
]

Generate exactly ${n} questions now.`;
}

/**
 * Generate instructor-competency questions with the configured AI provider.
 * Port of private/api/ai_questions.php — same prompt, same three providers, same parser.
 */
export async function generateTestQuestions(regData: Record<string, unknown>): Promise<TestQuestion[]> {
  const prompt = buildQuestionPrompt(regData);
  const provider = config.ACTIVE_AI_PROVIDER;

  let raw: string | undefined;
  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY ?? "";
    if (!key) throw new AiError("OPENROUTER_API_KEY is not set.");
    const fallbacks = [
      process.env.OPENROUTER_MODEL || "openrouter/free",
      "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "openai/gpt-oss-20b:free",
    ];
    let lastError = "No models available.";
    for (const model of fallbacks) {
      try {
        raw = await postJson(
          process.env.OPENROUTER_ENDPOINT ?? "https://openrouter.ai/api/v1/chat/completions",
          { model, messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 4096 },
          {
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": config.NEXT_PUBLIC_SITE_URL ?? "https://edulari.test",
            "X-Title": process.env.OPENROUTER_SITE_NAME || "Edulari",
          },
        );
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    if (raw === undefined || raw === "") throw new AiError(`All AI models failed. Last error: ${lastError}`);
  } else if (provider === "google") {
    const key = process.env.GOOGLE_AI_API_KEY ?? "";
    if (!key) throw new AiError("GOOGLE_AI_API_KEY is not set.");
    raw = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GOOGLE_AI_MODEL || "gemini-flash-latest"}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      },
      {},
    );
  } else if (provider === "nvidia_kimi") {
    const key = process.env.NVIDIA_KIMI_API_KEY ?? "";
    if (!key) throw new AiError("NVIDIA_KIMI_API_KEY is not set.");
    raw = await postJson(
      process.env.NVIDIA_KIMI_ENDPOINT ?? "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        model: process.env.NVIDIA_KIMI_MODEL || "moonshotai/kimi-k2.6",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 4096,
      },
      { Authorization: `Bearer ${key}` },
    );
  } else {
    throw new AiError(`Unknown AI provider: ${provider}`);
  }

  if (raw === undefined || raw === "") throw new AiError("AI returned no content.");
  return parseQuestionsFromJSON(raw);
}

/** Parse and normalise the AI response. Port of parseQuestionsFromJSON(). */
export function parseQuestionsFromJSON(raw: string): TestQuestion[] {
  let clean = raw.trim().replace(/^```[\w]*\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  const start = clean.indexOf("[");
  if (start === -1) throw new AiError("Failed to parse questions from AI response.");
  clean = clean.slice(start);

  let questions: unknown = null;
  try {
    questions = JSON.parse(clean);
  } catch {
    questions = null;
  }

  let arr: Record<string, unknown>[];
  if (Array.isArray(questions) && questions.length > 0) {
    arr = questions as Record<string, unknown>[];
  } else {
    const salvaged: Record<string, unknown>[] = [];
    const re = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      try {
        const obj = JSON.parse(m[0]) as Record<string, unknown>;
        if (obj && typeof obj.question === "string" && obj.question) salvaged.push(obj);
      } catch {
        // skip malformed blob
      }
    }
    if (salvaged.length > 0) arr = salvaged;
    else throw new AiError("Failed to parse questions from AI response.");
  }

  const valid: TestQuestion[] = [];
  for (const q of arr) {
    const opts = (q.options ?? {}) as Record<string, unknown>;
    const answer = typeof q.answer === "string" ? q.answer.toUpperCase() : "";
    if (
      typeof q.question === "string" &&
      q.question &&
      opts.A && opts.B && opts.C && opts.D &&
      ["A", "B", "C", "D"].includes(answer)
    ) {
      valid.push({
        question: q.question.trim(),
        options: {
          A: String(opts.A).trim(),
          B: String(opts.B).trim(),
          C: String(opts.C).trim(),
          D: String(opts.D).trim(),
        },
        answer,
      });
    }
  }

  if (valid.length === 0) throw new AiError("No valid questions could be parsed from AI response.");
  return valid;
}
