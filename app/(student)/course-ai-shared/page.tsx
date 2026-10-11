import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo/metadata";
import { sql } from "@/lib/db/client";
import { loadMessages } from "@/lib/ai/course-chat";
import SharedChatClient, { type SharedMessage } from "./SharedChatClient";

export const metadata: Metadata = pageMetadata({
  title: "Shared AI Chat – Edulari",
  description: "Shared AI chat conversation.",
  path: "/course-ai-shared",
  noindex: true,
});

/**
 * Port of public/course-ai-shared.php: a public, read-only view of a shared chat.
 * The old URL /course-ai-shared.php?slug=… is rewritten to /course-ai-shared?slug=…
 * by the .htaccess rule ported into next.config.ts.
 */
export default async function SharedChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const slug = (sp.slug ?? "").trim();
  if (slug === "") notFound();

  const links = await sql<{ slug: string; chat_id: number }[]>`
    SELECT slug, chat_id FROM course_ai_share_links WHERE slug = ${slug}
  `;
  if (links.length === 0) notFound();

  const chats = await sql<{ id: number }[]>`SELECT id FROM course_ai_chats WHERE id = ${links[0].chat_id}`;
  if (chats.length === 0) notFound();

  const messages = await loadMessages(Number(links[0].chat_id));

  const shared: SharedMessage[] = messages.map((m) => {
    const versions = m.versions ?? [];
    let content = m.content;
    if (versions.length > 1) content = versions[m.active_version]?.content ?? content;
    return { role: m.role === "assistant" ? "assistant" : "user", content };
  });

  return <SharedChatClient messages={shared} />;
}