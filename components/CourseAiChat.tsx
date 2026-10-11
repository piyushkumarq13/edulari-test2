"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Port of public/assets/js/course-ai.js + the widget markup that learn.php appends to
 * the bottom of the page.
 *
 * Behaviour kept identical: the panel opens on click and lazily loads history once,
 * the send button is disabled while a request is in flight, the user's message is
 * rendered optimistically, "Thinking..." is appended and removed, retry / like / dislike
 * / edit / version paging call the matching API action, and the share modal copies
 * `location.origin + '/course-ai-shared?slug=' + slug`.
 *
 * Differences (deliberate, see docs/analysis/phase6.md):
 *  - the endpoint is `/api/student/course-ai` and the CSRF token is verified there;
 *  - errors are rendered as text nodes instead of `insertAdjacentHTML`;
 *  - the URL is the clean `/course-ai-shared` the .htaccess rewrite produces.
 */

export type AiMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  versions: { content: string; created_at: string }[];
  active_version: number;
  feedback?: string | null;
};

function effectiveContent(m: AiMessage): string {
  const versions = m.versions ?? [];
  if (versions.length > 1) {
    const idx = m.active_version;
    return versions[idx] ? versions[idx].content : m.content;
  }
  return m.content;
}

export default function CourseAiChat({ courseId, csrfToken }: { courseId: number; csrfToken: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const loadedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sendRef = useRef<HTMLButtonElement | null>(null);

  const api = useCallback(
    async (action: string, data: Record<string, unknown> = {}) => {
      const res = await fetch(`/api/student/course-ai?action=${encodeURIComponent(action)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ course_id: courseId, ...data }),
      });
      return (await res.json()) as { messages?: AiMessage[]; slug?: string | null; feedback?: string | null; error?: string };
    },
    [courseId, csrfToken],
  );

  const loadMessages = useCallback(async () => {
    const data = await api("get_messages");
    setMessages(data.messages ?? []);
  }, [api]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, thinking]);

  function togglePanel() {
    setOpen((v) => {
      if (!v) {
        // Lazy load on first open, exactly like the PHP
        // (`if (!loaded) { loadMessages(); loaded = true; }`).
        if (!loadedRef.current) {
          loadedRef.current = true;
          void loadMessages().catch(() => setError("Could not load the conversation."));
        }
        inputRef.current?.focus();
      }
      return !v;
    });
  }

  async function send() {
    const text = (inputRef.current?.value ?? "").trim();
    if (!text || busy) return;
    if (inputRef.current) inputRef.current.value = "";
    setBusy(true);
    setError(null);

    // Optimistic user bubble.
    const optimistic: AiMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      versions: [{ content: text, created_at: "" }],
      active_version: 0,
    };
    setMessages((prev) => [...prev, optimistic]);
    setThinking(true);

    try {
      const data = await api("send", { content: text });
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setThinking(false);
      setBusy(false);
    }
  }

  async function retryMessage(id: number | string) {
    setBusy(true);
    try {
      const data = await api("retry", { message_id: id });
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: number | string, oldContent: string) {
    const next = editDraft.trim();
    if (!next || next === oldContent) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      const data = await api("edit_message", { message_id: id, content: next });
      setMessages(data.messages ?? []);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function switchVersion(id: number | string, idx: number) {
    const data = await api("switch_version", { message_id: id, version_index: idx });
    setMessages(data.messages ?? []);
  }

  async function setFeedback(id: number | string, fb: string) {
    const data = await api("feedback", { message_id: id, feedback: fb });
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: data.feedback ?? null } : m)));
  }

  async function shareChat() {
    const data = await api("share");
    if (!data.slug) return;
    setShareUrl(`${window.location.origin}/course-ai-shared?slug=${data.slug}`);
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const tmp = document.createElement("textarea");
      tmp.value = shareUrl;
      tmp.style.position = "fixed";
      tmp.style.opacity = "0";
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
    }
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  return (
    <>
      <div id="courseAiChatContainer">
        <button id="courseAiChatBtn" onClick={togglePanel}>
          💬 AI Assistant
        </button>
        <div id="courseAiChatPanel" style={{ display: open ? "flex" : "none" }}>
          <div className="course-ai-header">
            <span>AI Tutor</span>
            <div>
              <button
                className="course-ai-close-btn"
                id="courseAiShareBtn"
                title="Share"
                style={{ marginRight: 8, fontSize: 14 }}
                onClick={() => void shareChat()}
              >
                🔗
              </button>
              <button className="course-ai-close-btn" id="courseAiChatCloseBtn" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </div>
          <div className="course-ai-messages" id="courseAiMessages" ref={messagesRef}>
            {messages.map((m) => {
              const content = effectiveContent(m);
              const versions = m.versions ?? [];
              const isEditing = editingId === m.id;
              return (
                <div className="course-ai-msg-row" data-id={String(m.id)} key={String(m.id)}>
                  <div className={`course-ai-msg course-ai-msg--${m.role === "user" ? "user" : "assistant"}`}>
                    {content}
                  </div>

                  {isEditing ? (
                    <>
                      <textarea
                        className="course-ai-edit-input"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        autoFocus
                      />
                      <button className="course-ai-action-btn course-ai-action-btn--save" onClick={() => void saveEdit(m.id, content)}>
                        Save
                      </button>
                      <button className="course-ai-action-btn" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <div className="course-ai-actions">
                      {m.role === "assistant" ? (
                        <>
                          <button className="course-ai-action-btn" onClick={() => void retryMessage(m.id)}>
                            ↻ Retry
                          </button>
                          <button
                            className={`course-ai-action-btn ${m.feedback === "like" ? "course-ai-action-btn--active" : ""}`}
                            onClick={() => void setFeedback(m.id, "like")}
                          >
                            👍
                          </button>
                          <button
                            className={`course-ai-action-btn ${m.feedback === "dislike" ? "course-ai-action-btn--active" : ""}`}
                            onClick={() => void setFeedback(m.id, "dislike")}
                          >
                            👎
                          </button>
                        </>
                      ) : (
                        <button
                          className="course-ai-action-btn"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditDraft(content);
                          }}
                        >
                          ✎ Edit
                        </button>
                      )}

                      {versions.length > 1 ? (
                        <span className="course-ai-version">
                          <button disabled={m.active_version <= 0} onClick={() => void switchVersion(m.id, m.active_version - 1)}>
                            ‹
                          </button>
                          <span>
                            {m.active_version + 1}/{versions.length}
                          </span>
                          <button
                            disabled={m.active_version >= versions.length - 1}
                            onClick={() => void switchVersion(m.id, m.active_version + 1)}
                          >
                            ›
                          </button>
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}

            {thinking ? <div className="course-ai-thinking">Thinking...</div> : null}
            {error ? <div className="course-ai-thinking">Error: {error}</div> : null}
          </div>
          <div className="course-ai-suggestions">
            <span className="ajar-suggest">Explain this lesson</span>
            <span className="ajar-suggest">Summarize in simple terms</span>
          </div>
          <div className="course-ai-input-area">
            <textarea
              id="courseAiInput"
              placeholder="Ask something…"
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button id="courseAiSendBtn" ref={sendRef} onClick={() => void send()} disabled={busy}>
              Send
            </button>
          </div>
        </div>
      </div>

      {shareUrl ? (
        <div className="course-ai-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShareUrl(null)}>
          <div className="course-ai-modal">
            <h3>Share this chat</h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Anyone with this link can view this chat (read-only).
            </p>
            <div className="course-ai-modal-link">
              <input type="text" readOnly value={shareUrl} />
              <button id="caCopy" onClick={() => void copyShareUrl()}>
                {copyLabel}
              </button>
            </div>
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button
                id="caClose"
                style={{ border: 0, background: "#f3f4f6", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                onClick={() => setShareUrl(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}