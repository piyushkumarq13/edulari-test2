/**
 * The client-side Markdown <-> HTML conversion used by public/assets/js/md-editor.js.
 *
 * The PHP version is two regex passes over the textarea value: markdownToHtml() for the
 * preview/initial render and htmlToMarkdown() on submit. Both run entirely in the browser,
 * so the editor preview never touches the server. These ports keep the same rules, including
 * the non-standard `++underline++`, so what an instructor sees while typing is what the
 * student page eventually renders.
 */

/** markdownToHtml() - the same ordered replacements as md-editor.js. */
export function markdownToHtml(md: string | null | undefined): string {
  let html = (md || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) =>
    `<pre class="md-code" data-lang="${lang || "text"}"><code>${code.replace(/\n$/, "")}</code></pre>`);

  html = html
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^> ?(.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/((?:^\|.*\|$\n?)+)/gm, (block) => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return block;
    const rows = lines
      .map((l, i) => {
        if (/^\|[\s:\-|]+\|$/.test(l.trim())) return "";
        const cells = l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const tag = i === 0 ? "th" : "td";
        return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
      })
      .join("");
    return `<table class="md-table">${rows}</table>`;
  });

  return html.replace(/\n{2,}/g, "<br><br>").split("\n").map((l) => l.trim()).join("");
}

const innerText = (el: Element | null): string => (el?.textContent ?? "").trim();

/** htmlToMarkdown() - walks the live editor DOM back into the textarea value on submit. */
export function htmlToMarkdown(root: HTMLElement): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "h1": return "# " + innerText(el) + "\n";
      case "h2": return "## " + innerText(el) + "\n";
      case "h3": return "### " + innerText(el) + "\n";
      case "h4": return "#### " + innerText(el) + "\n";
      case "h5": return "##### " + innerText(el) + "\n";
      case "h6": return "###### " + innerText(el) + "\n";
      case "strong":
      case "b": return "**" + innerText(el) + "**";
      case "em":
      case "i": return "*" + innerText(el) + "*";
      case "u": return "++" + innerText(el) + "++";
      case "s":
      case "strike": return "~~" + innerText(el) + "~~";
      case "a": return "[" + innerText(el) + "](" + (el.getAttribute("href") || "") + ")";
      case "img": return "![" + (el.getAttribute("alt") || "") + "](" + (el.getAttribute("src") || "") + ")";
      case "blockquote": return "> " + innerText(el).trim() + "\n";
      case "hr": return "---\n";
      case "ul":
        return "\n" + Array.from(el.children).map((li) => "- " + walk(li).trim()).join("\n") + "\n";
      case "ol":
        return "\n" + Array.from(el.children).map((li, i) => `${i + 1}. ` + walk(li).trim()).join("\n") + "\n";
      case "li": return innerText(el);
      case "pre": {
        const code = el.querySelector("code");
        const lang = el.getAttribute("data-lang") || code?.getAttribute("data-lang") || "text";
        return "```" + lang + "\n" + (code?.textContent ?? "") + "\n```\n";
      }
      case "code": return "`" + innerText(el) + "`";
      case "table": {
        const rows = Array.from(el.querySelectorAll("tr"));
        if (rows.length === 0) return "";
        const lines = rows.map((tr) => {
          const cells = Array.from(tr.querySelectorAll("th,td")).map((c) => innerText(c));
          return "| " + cells.join(" | ") + " |";
        });
        lines.splice(1, 0, "| " + Array.from(rows[0].querySelectorAll("th,td")).map(() => "---").join(" | ") + " |");
        return lines.join("\n") + "\n";
      }
      case "br": return "\n";
      default: {
        if (tag === "p" || tag === "div") return innerText(el) + "\n\n";
        return Array.from(el.childNodes).map(walk).join("");
      }
    }
  };
  return Array.from(root.childNodes).map(walk).join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Escape helper for the code-block modal seed, matching md-editor.js. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}