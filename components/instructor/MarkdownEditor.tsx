"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { markdownToHtml, htmlToMarkdown, escapeHtml } from "@/lib/markdown-editor";

/**
 * Client port of public/assets/js/md-editor.js. It enhances a hidden <textarea> by building
 * the same .mde-wrap / .mde-toolbar / .mde-editor DOM around it so styles/css/md-editor.css
 * applies unchanged, converts Markdown <-> HTML in the browser exactly as the PHP did, keeps
 * the localStorage draft, and writes the Markdown value back into the textarea on submit.
 *
 * `simple` reproduces data-md-tools="simple": it hides Image, Code block and Table.
 */
export default function MarkdownEditor({
  name,
  defaultValue = "",
  rows = 7,
  placeholder = "Write your content here…",
  simple = false,
  draftKey,
  csrfToken,
  textareaId: idProp,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  simple?: boolean;
  draftKey?: string;
  csrfToken?: string;
  textareaId?: string;
}) {
  const uid = useId();
  const textareaId = idProp ?? `mde-${uid}`;
  const key = draftKey ?? `mde_draft_${name}`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /** Re-render the editor from the textarea value; the PHP exposed window.mdRefresh[name]. */
  const refresh = useCallback(() => {
    const ta = textareaRef.current;
    const ed = editorRef.current;
    if (!ta || !ed) return;
    ed.innerHTML = markdownToHtml(ta.value) || "";
    try {
      localStorage.setItem(key, ed.innerHTML);
    } catch {
      /* private mode */
    }
  }, [key]);

  useEffect(() => {
    const ta = textareaRef.current;
    const host = ta?.parentElement;
    if (!ta || !host) return;

    // Build the wrapper the PHP inserts *before* the textarea, then move the textarea inside.
    const wrap = document.createElement("div");
    wrap.className = "mde-wrap";
    host.insertBefore(wrap, ta);

    const toolbar = document.createElement("div");
    toolbar.className = "mde-toolbar";
    wrap.appendChild(toolbar);

    const editor = document.createElement("div");
    editor.className = "mde-editor";
    editor.contentEditable = "true";
    editor.setAttribute("data-placeholder", placeholder);
    wrap.appendChild(editor);

    ta.style.display = "none";
    wrap.appendChild(ta);
    editorRef.current = editor;
    wrapRef.current = wrap;

    // The stored draft wins over the server value, as in md-editor.js.
    let saved = "";
    try {
      saved = localStorage.getItem(key) || "";
    } catch {
      /* private mode */
    }
    editor.innerHTML = saved || markdownToHtml(ta.value) || "";

    // ── Toolbar ────────────────────────────────────────────────────────────
    type Btn = { key: string; icon: string; title: string; simpleHidden?: boolean };
    const ICONS = {
      undo: '<i class="fa-solid fa-rotate-left"></i>',
      redo: '<i class="fa-solid fa-rotate-right"></i>',
      bold: '<i class="fa-solid fa-bold"></i>',
      italic: '<i class="fa-solid fa-italic"></i>',
      underline: '<i class="fa-solid fa-underline"></i>',
      strike: '<i class="fa-solid fa-strikethrough"></i>',
      h1: '<i class="fa-solid fa-heading"></i><sub>1</sub>',
      h2: '<i class="fa-solid fa-heading"></i><sub>2</sub>',
      h3: '<i class="fa-solid fa-heading"></i><sub>3</sub>',
      ul: '<i class="fa-solid fa-list-ul"></i>',
      ol: '<i class="fa-solid fa-list-ol"></i>',
      quote: '<i class="fa-solid fa-quote-left"></i>',
      link: '<i class="fa-solid fa-link"></i>',
      image: '<i class="fa-solid fa-image"></i>',
      hr: '<i class="fa-solid fa-minus"></i>',
      code: '<i class="fa-solid fa-code"></i>',
      table: '<i class="fa-solid fa-table"></i>',
    } as const;
    const BUTTONS: Btn[] = [
      { key: "undo", icon: ICONS.undo, title: "Undo" },
      { key: "redo", icon: ICONS.redo, title: "Redo" },
      { key: "bold", icon: ICONS.bold, title: "Bold" },
      { key: "italic", icon: ICONS.italic, title: "Italic" },
      { key: "underline", icon: ICONS.underline, title: "Underline" },
      { key: "strike", icon: ICONS.strike, title: "Strikethrough" },
      { key: "h1", icon: ICONS.h1, title: "Heading 1" },
      { key: "h2", icon: ICONS.h2, title: "Heading 2" },
      { key: "h3", icon: ICONS.h3, title: "Heading 3" },
      { key: "ul", icon: ICONS.ul, title: "Bullets" },
      { key: "ol", icon: ICONS.ol, title: "Numbered" },
      { key: "quote", icon: ICONS.quote, title: "Quote" },
      { key: "link", icon: ICONS.link, title: "Link" },
      { key: "image", icon: ICONS.image, title: "Image", simpleHidden: true },
      { key: "hr", icon: ICONS.hr, title: "Rule" },
      { key: "code", icon: ICONS.code, title: "Code block", simpleHidden: true },
      { key: "table", icon: ICONS.table, title: "Table", simpleHidden: true },
    ];

    const buttons = new Map<string, HTMLButtonElement>();
    for (const b of BUTTONS) {
      if (simple && b.simpleHidden) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mde-btn";
      btn.title = b.title;
      btn.innerHTML = b.icon;
      toolbar.appendChild(btn);
      buttons.set(b.key, btn);
    }

    const setActive = (name: string, on: boolean) => {
      buttons.get(name)?.classList.toggle("mde-btn--active", on);
    };
    const updateState = () => {
      try {
        setActive("bold", document.queryCommandState("bold"));
        setActive("italic", document.queryCommandState("italic"));
        setActive("underline", document.queryCommandState("underline"));
        setActive("strikethrough", document.queryCommandState("strikeThrough"));
        setActive("ul", document.queryCommandState("insertUnorderedList"));
        setActive("ol", document.queryCommandState("insertOrderedList"));
        const v = String(document.queryCommandValue("formatBlock")).toLowerCase();
        setActive("h1", v === "h1");
        setActive("h2", v === "h2");
        setActive("h3", v === "h3");
        setActive("quote", v === "blockquote");
      } catch {
        /* command not supported */
      }
    };
    const toggleBlock = (tag: string) => {
      const sel = window.getSelection();
      const current = sel && sel.rangeCount ? String(sel.anchorNode?.parentElement?.tagName ?? "").toLowerCase() : "";
      editor.focus();
      document.execCommand("formatBlock", false, current === tag ? "<p>" : `<${tag}>`);
      updateState();
    };
    const selectionText = () => window.getSelection()?.toString() ?? "";

    const createModal = (title: string, bodyHtml: string, onInsert: (root: HTMLElement) => void) => {
      const overlay = document.createElement("div");
      overlay.className = "mde-modal-overlay";
      overlay.innerHTML =
        `<div class="mde-modal">` +
        `<div class="mde-modal__head"><h3>${title}</h3><button type="button" class="mde-modal__x">&times;</button></div>` +
        `<div class="mde-modal__body">${bodyHtml}</div>` +
        `<div class="mde-modal__foot"><button type="button" class="mde-modal__cancel">Cancel</button>` +
        `<button type="button" class="mde-modal__insert">Insert</button></div></div>`;
      const close = () => overlay.remove();
      overlay.querySelector(".mde-modal__x")?.addEventListener("click", close);
      overlay.querySelector(".mde-modal__cancel")?.addEventListener("click", close);
      overlay.querySelector(".mde-modal__insert")?.addEventListener("click", () => onInsert(overlay));
      document.body.appendChild(overlay);
      return overlay;
    };

    const blockInsert = (html: string) => {
      const sel = window.getSelection();
      let anchor: HTMLElement | null = sel && sel.rangeCount ? (sel.anchorNode as HTMLElement) : null;
      if (anchor && anchor.nodeType === 3) anchor = anchor.parentElement;
      const block = anchor?.closest("pre,table,blockquote,h1,h2,h3,h4,h5,h6,ul,ol") ?? null;
      const r = document.createRange();
      if (block) {
        r.setStartAfter(block);
      } else {
        r.selectNodeContents(editor);
        r.collapse(false);
      }
      r.deleteContents();
      sel?.removeAllRanges();
      sel?.addRange(r);
      document.execCommand("insertHTML", false, html + "<p><br></p>");
    };

    const wire = (keyName: string, fn: () => void) => {
      buttons.get(keyName)?.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
    };

    wire("undo", () => { editor.focus(); document.execCommand("undo"); });
    wire("redo", () => { editor.focus(); document.execCommand("redo"); });
    wire("bold", () => { document.execCommand("bold"); updateState(); });
    wire("italic", () => { document.execCommand("italic"); updateState(); });
    wire("underline", () => { document.execCommand("underline"); updateState(); });
    wire("strike", () => { document.execCommand("strikeThrough"); updateState(); });
    wire("h1", () => toggleBlock("h1"));
    wire("h2", () => toggleBlock("h2"));
    wire("h3", () => toggleBlock("h3"));
    wire("ul", () => { document.execCommand("insertUnorderedList"); updateState(); });
    wire("ol", () => { document.execCommand("insertOrderedList"); updateState(); });
    wire("quote", () => toggleBlock("blockquote"));
    wire("hr", () => { document.execCommand("insertHorizontalRule"); updateState(); });

    wire("link", () => {
      const sel = selectionText();
      createModal(
        "Insert Link",
        `<label>Display text</label><input type="text" class="mde-modal__in" data-f="text" value="${escapeHtml(sel)}">` +
        `<label>URL</label><input type="text" class="mde-modal__in" data-f="url" placeholder="https://example.com">`,
        (root) => {
          const text = (root.querySelector('[data-f="text"]') as HTMLInputElement)?.value.trim() ?? "";
          const url = (root.querySelector('[data-f="url"]') as HTMLInputElement)?.value.trim() ?? "";
          if (text) {
            editor.focus();
            document.execCommand("insertHTML", false, `<a href="${url}" target="_blank">${text}</a>`);
          } else if (sel) {
            document.execCommand("createLink", false, url);
          }
          root.remove();
        },
      );
    });

    wire("image", () => {
      createModal(
        "Insert Image",
        `<label>Image URL</label><input type="text" class="mde-modal__in" data-f="url" placeholder="https://…/image.png">` +
        `<label>Or upload a file</label><input type="file" accept="image/*" class="mde-modal__in" data-f="file">`,
        (root) => {
          const url = (root.querySelector('[data-f="url"]') as HTMLInputElement)?.value.trim() ?? "";
          const file = (root.querySelector('[data-f="file"]') as HTMLInputElement)?.files?.[0];
          if (url) {
            editor.focus();
            document.execCommand("insertImage", false, url);
            root.remove();
          } else if (file) {
            const fd = new FormData();
            fd.append("file", file);
            fetch("/api/editor/image", {
     method: "POST",
     body: fd,
     credentials: "same-origin",
     headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
   })
              .then((r) => r.json())
              .then((res: { success?: boolean; url?: string; message?: string }) => {
                if (res.success && res.url) {
                  editor.focus();
                  document.execCommand("insertImage", false, res.url);
                  root.remove();
                } else {
                  window.alert(res.message || "Upload failed");
                }
              })
              .catch(() => window.alert("Upload failed"));
          } else {
            window.alert("Provide a URL or choose a file.");
          }
        },
      );
    });

    wire("code", () => {
      const seed = selectionText() || "// code here";
      createModal(
        "Insert Code Block",
        `<label>Language</label><select class="mde-modal__in" data-f="lang">` +
        ["javascript", "html", "css", "php", "python", "sql", "bash", "json"]
          .map((l) => `<option>${l}</option>`).join("") +
        `</select>`,
        (root) => {
          const lang = (root.querySelector('[data-f="lang"]') as HTMLSelectElement)?.value || "text";
          blockInsert(`<pre class="md-code" data-lang="${lang}"><code>${escapeHtml(seed)}</code></pre>`);
          root.remove();
        },
      );
    });

    wire("table", () => {
      createModal(
        "Insert Table",
        `<label>Rows (incl. header)</label><input type="number" class="mde-modal__in" data-f="r" value="3" min="1">` +
        `<label>Columns</label><input type="number" class="mde-modal__in" data-f="c" value="3" min="1">`,
        (root) => {
          const r = Math.max(1, parseInt((root.querySelector('[data-f="r"]') as HTMLInputElement)?.value ?? "3", 10) || 3);
          const c = Math.max(1, parseInt((root.querySelector('[data-f="c"]') as HTMLInputElement)?.value ?? "3", 10) || 3);
          let html = '<table class="md-table">';
          for (let ri = 0; ri < r; ri++) {
            html += "<tr>";
            for (let ci = 0; ci < c; ci++) {
              html += ri === 0 ? "<th>Header</th>" : "<td>Cell</td>";
            }
            html += "</tr>";
          }
          html += "</table>";
          blockInsert(html);
          root.remove();
        },
      );
    });

    // ── Active-state tracking ───────────────────────────────────────────────
    editor.addEventListener("keyup", updateState);
    editor.addEventListener("mouseup", updateState);
    document.addEventListener("selectionchange", () => {
      if (editor.contains(document.getSelection()?.anchorNode ?? null)) updateState();
    });

    // ── Empty-pre Backspace removal (the PHP's only keyboard behaviour) ──────
    editor.addEventListener("keydown", (e) => {
      if (e.key !== "Backspace") return;
      const sel2 = window.getSelection();
      let n = sel2?.anchorNode ?? null;
      if (n && n.nodeType === 3) n = (n as Text).parentElement;
      const pre = (n as HTMLElement | null)?.closest?.("pre");
      if (pre && pre.textContent?.trim() === "") {
        e.preventDefault();
        const next = pre.nextElementSibling;
        pre.remove();
        if (next) {
          const r2 = document.createRange();
          r2.selectNodeContents(next);
          r2.collapse(true);
          sel2?.removeAllRanges();
          sel2?.addRange(r2);
        }
      }
    });

    // ── localStorage draft (HTML, not Markdown) ──────────────────────────────
    const saveDraft = () => {
      try {
        localStorage.setItem(key, editor.innerHTML);
      } catch {
        /* private mode */
      }
    };
    editor.addEventListener("input", saveDraft);
    editor.addEventListener("keyup", saveDraft);
    editor.addEventListener("blur", saveDraft);
    const timer = setInterval(saveDraft, 1500);

    // ── Submit integration: write Markdown back and clear the draft ───────────
    const form = ta.form;
    const onSubmit = () => {
      ta.value = htmlToMarkdown(editor);
      try {
        localStorage.removeItem(key);
      } catch {
        /* private mode */
      }
    };
    form?.addEventListener("submit", onSubmit);

    (window as unknown as Record<string, unknown>).mdRefresh = {
      ...((window as unknown as Record<string, unknown>).mdRefresh ?? {}),
      [name]: refresh,
    };

    return () => {
      clearInterval(timer);
      form?.removeEventListener("submit", onSubmit);
      wrap.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <textarea ref={textareaRef} id={textareaId} name={name} rows={rows} defaultValue={defaultValue} />
    </>
  );
}