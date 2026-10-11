import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1","h2","h3","h4","h5","h6","p","br","hr","strong","em","u","s","code","pre",
  "ul","ol","li","blockquote","a","img","table","thead","tbody","tr","th","td","div","span",
];
const ALLOWED_ATTR: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "class", "loading"],
  code: ["class", "data-lang"],
  pre: ["class", "data-lang"],
  table: ["class"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  if (!md) return "";
  const html = marked.parse(md) as string;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ["http", "https", "data"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}
