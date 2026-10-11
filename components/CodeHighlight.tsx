"use client";

import { useEffect, useRef } from "react";

/**
 * Port of public/assets/js/code-highlight.js.
 *
 * The PHP runs its DOMContentLoaded pass over every `pre.md-code code` element and
 * rewrites textContent into tok-* spans, protecting the spans it just added by splitting
 * on tags. Same keyword tables, same order (comments, strings, numbers), same classes.
 */

const KEYWORDS: Record<string, RegExp | null> = {
  php: /\b(abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|for|foreach|function|global|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|namespace|new|or|print|private|protected|public|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield)\b/g,
  javascript: /\b(async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|of|return|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/g,
  python: /\b(False|None|True|and|as|assert|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g,
  sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|DISTINCT|AS|AND|OR|NOT|NULL|COUNT|SUM|AVG|MAX|MIN)\b/gi,
  css: /\b(align-items|background|border|color|display|flex|font-size|margin|padding|width|height|position|top|left|right|bottom|z-index|overflow|text-align|transition|transform|opacity)\b/g,
  html: null,
  text: null,
};

export function highlightCode(codeEl: HTMLElement): void {
  const lang = (codeEl.dataset.lang || "text").toLowerCase();
  let html = codeEl.textContent ?? "";

  const keywords = KEYWORDS[lang];
  if (keywords) html = html.replace(keywords, '<span class="tok-keyword">$1</span>');

  // Protect the spans just added by splitting on tags, then restoring them.
  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 2) {
    let s = parts[i];
    s = s.replace(/(\/\/[^\n]*|#[^\n]*|<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/)/g, "\u0001$1\u0002");
    s = s.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, "\u0003$1\u0004");
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, "\u0005$1\u0006");
    parts[i] = s;
  }
  html = parts.join("");
  html = html
    .replace(/\u0001([\s\S]*?)\u0002/g, '<span class="tok-comment">$1</span>')
    .replace(/\u0003([\s\S]*?)\u0004/g, '<span class="tok-string">$1</span>')
    .replace(/\u0005([\s\S]*?)\u0006/g, '<span class="tok-number">$1</span>');

  codeEl.innerHTML = html;
}

export default function CodeHighlight() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    document.querySelectorAll<HTMLElement>("pre.md-code code").forEach((el) => {
      try {
        highlightCode(el);
      } catch {
        /* leave the plain text in place */
      }
    });
  });

  return null;
}