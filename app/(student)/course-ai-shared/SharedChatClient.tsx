"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { highlightCode } from "@/components/CodeHighlight";

export type SharedMessage = { role: "user" | "assistant"; content: string };

/**
 * The inline renderMarkdown() from course-ai-shared.php, verbatim. It is deliberately
 * NOT lib/markdown.ts: the shared view renders its own simplified pipeline (escape
 * first, then a regex chain) and the output differs. Input is HTML-escaped before any
 * tag is emitted, so the innerHTML use is safe.
 */
export function renderMarkdown(md: string): string {
  if (!md) return "";
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    return '<pre class="md-code"><code class="language-' + (lang || "text") + '" data-lang="' + (lang || "text") + '">' + code.replace(/\n$/, "") + "</code></pre>";
  });
  html = html
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^---$/gm, '<hr class="md-hr">')
    .replace(/^> ?(.*)$/gm, '<blockquote class="md-quote">$1</blockquote>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="md-img" src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  html = html.replace(/((?:^\|.*\|$\n?)+)/gm, (block) => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return block;
    const rows = lines
      .map((l, i) => {
        if (/^\|[\s:\-|]+\|$/.test(l.trim())) return "";
        const cells = l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const tag = i === 0 ? "th" : "td";
        return "<tr>" + cells.map((c) => `<${tag}>${c}</${tag}>`).join("") + "</tr>";
      })
      .join("");
    return '<table class="md-table">' + rows + "</table>";
  });

  html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => "<ul>" + m + "</ul>");
  html = html.replace(/^\d+\. (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => (m.indexOf("<ul>") === -1 ? "<ol>" + m + "</ol>" : m));

  return html.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
}

/** Port of course-ai-shared.php's body. */
export default function SharedChatClient({ messages }: { messages: SharedMessage[] }) {
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedRef.current?.querySelectorAll<HTMLElement>("pre.md-code code").forEach((el) => {
      try {
        highlightCode(el);
      } catch {
        /* leave plain text */
      }
    });
  }, [messages]);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#111827", fontWeight: 700, fontSize: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/images/edulari-logo.png" alt="Edulari" style={{ height: 32, width: "auto" }} />
            Edulari AI
          </Link>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: "999px", padding: "4px 12px" }}>
            Shared chat · read-only
          </span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", color: "#111827" }}>AI Tutor Chat</h1>

        <div id="sharedMessages" ref={feedRef}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 12, marginBottom: 20, ...(m.role === "user" ? { flexDirection: "row-reverse" } : {}) }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 600,
                  ...(m.role === "user"
                    ? { background: "#4f46e5", color: "#fff" }
                    : { background: "#e0e7ff", color: "#4338ca" }),
                }}
              >
                {m.role === "user" ? "U" : "AI"}
              </div>
              <div
                style={
                  m.role === "user"
                    ? { background: "#4f46e5", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "12px 16px", maxWidth: "80%" }
                    : { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px 16px 16px 4px", padding: 16, maxWidth: "100%" }
                }
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link
            href="/student/learn"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, background: "#4f46e5",
              color: "#fff", textDecoration: "none", padding: "12px 24px", borderRadius: 10,
              fontWeight: 600, fontSize: 14,
            }}
          >
            Try Edulari AI yourself
          </Link>
        </div>
      </div>
    </div>
  );
}