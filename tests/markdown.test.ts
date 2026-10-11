import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("markdown", () => {
  it("renders bold and links", () => {
    const html = renderMarkdown("**bold** and [x](https://example.com)");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com"');
  });

  it("escapes/strips raw script HTML (XSS)", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });

  it("strips javascript: URLs", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  it("renders code blocks and tables without executing anything", () => {
    const html = renderMarkdown("```js\nconsole.log(1)\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<pre");
    expect(html).toContain("console.log");
    expect(html).toContain("<table");
  });
});
