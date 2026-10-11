/**
 * Measures whether navbar.css and a page's own CSS target the same elements.
 *
 * The old site emits navbar.css from INSIDE <body> via navbar.php, so it is always
 * the last stylesheet the browser applies. The Next port imports it from the root
 * layout, i.e. FIRST. That only matters where both files style the same selector, so
 * this script finds the exact overlaps (and the properties they disagree about)
 * instead of assuming.
 *
 * Handles @media / @supports by recursing into the block body.
 *
 *   node scripts/css-conflicts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const CSS_ROOT = process.env.CSS_ROOT ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\Edulari\\styles\\css";

function selKey(sel) {
  return sel
    .replace(/::?[a-z-]+(\([^)]*\))?/gi, "")
    .replace(/\s*([>+~])\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Returns [{ sel, key, props }] for every declaration block, recursing into at-rules.
 */
function parse(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;

  function block(start) {
    // start points just after '{'
    let depth = 1;
    const bodyStart = start;
    let j = start;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      j++;
    }
    return { body: src.slice(bodyStart, j - 1), end: j };
  }

  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) break;
    const prelude = src.slice(i, open).trim();
    const { body, end } = block(open + 1);

    if (prelude.startsWith("@")) {
      // @media / @supports / @layer -> recurse into the body
      out.push(...parse(body));
      i = end;
      continue;
    }
    if (prelude && /[A-Za-z#*.:[]/.test(prelude)) {
      const props = [...body.matchAll(/([-a-zA-Z]+)\s*:/g)].map((d) => d[1]);
      for (const part of prelude.split(",")) {
        const s = part.trim().replace(/\s+/g, " ");
        if (s) out.push({ sel: s, key: selKey(s), props, media: prelude.match(/@media[^{]*/)?.[0]?.trim() ?? "" });
      }
    }
    i = end;
  }
  return out;
}

function cssFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) cssFiles(p, acc);
    else if (e.name.endsWith(".css")) acc.push(p);
  }
  return acc;
}

const all = cssFiles(CSS_ROOT);
const navbarFile = all.find((f) => path.basename(f) === "navbar.css" && path.dirname(f) === CSS_ROOT);
if (!navbarFile) {
  console.error("navbar.css not found at the css root");
  process.exit(1);
}

const navbar = parse(fs.readFileSync(navbarFile, "utf8"));
const byKey = new Map();
for (const s of navbar) if (!byKey.has(s.key)) byKey.set(s.key, s);
console.log(`navbar.css: ${navbar.length} selector instances, ${byKey.size} unique\n`);

// Global rules in navbar.css are the ones that hit EVERY page.
const globals = navbar.filter((s) => /^(html|body|\*|:root)$/.test(s.key));
console.log("global (element/universal) rules in navbar.css:");
for (const g of globals) console.log(`   ${g.sel}  { ${g.props.join("; ")} }  ${g.media}`);
console.log("");

const report = [];
for (const f of all) {
  if (f === navbarFile) continue;
  const rel = path.relative(CSS_ROOT, f);
  const sels = parse(fs.readFileSync(f, "utf8"));
  const seen = new Map();
  for (const s of sels) {
    const n = byKey.get(s.key);
    if (!n) continue;
    const sharedProps = [...new Set(s.props.filter((p) => n.props.includes(p)))];
    if (!seen.has(s.key)) seen.set(s.key, { sel: s.sel, sharedProps, sameMedia: s.media === n.media });
  }
  if (seen.size) report.push({ file: rel, items: [...seen.values()] });
}
report.sort((a, b) => b.items.length - a.items.length);

if (!report.length) {
  console.log("No selector overlap between navbar.css and any other stylesheet.");
  console.log("=> navbar.css import order has NO visual effect.");
} else {
  console.log(`OVERLAPS between navbar.css and ${report.length} other stylesheet(s)\n`);
  for (const r of report) {
    const propClashes = r.items.filter((c) => c.sharedProps.length);
    console.log(`${r.file}  --  ${r.items.length} shared selectors, ${propClashes.length} also set the same properties`);
    for (const c of propClashes.slice(0, 10)) console.log(`      ${c.sel}   [${c.sharedProps.join(", ")}]`);
    if (propClashes.length > 10) console.log(`      ... and ${propClashes.length - 10} more`);
    console.log("");
  }
}
