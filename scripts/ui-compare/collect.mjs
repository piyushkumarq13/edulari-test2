/**
 * scripts/ui-compare/collect.mjs
 *
 * Drives one browser against one site and returns, per page+viewport:
 *   - full-page screenshot (PNG buffer)
 *   - every element's identity + bounding box + computed styles
 *   - page-level facts: total height, horizontal overflow, loaded fonts, image sizes
 *
 * The same function runs against the old PHP site and the Next app so the two
 * snapshots are directly comparable.
 */

import { FREEZE_CSS, MASK_SELECTORS, PROPERTIES } from "./config.mjs";

/** Injected in the page: freeze animations, wait for fonts, collect everything. */
const COLLECTOR = (props, maskSelectors) => {
  const out = { elements: [], fonts: [], images: [], title: "", description: "" };

  out.title = document.title;
  out.description = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";

  // Fonts actually used by rendered text, not merely declared.
  try {
    const used = new Set();
    for (const el of document.querySelectorAll("body *")) {
      // script/style/noscript/svg render no text and report the browser default
      // font-family ("Times New Roman"), which pollutes the font list.
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|TEMPLATE)$/.test(el.tagName)) continue;
      if (!el.textContent?.trim()) continue;
      if (el.children.length && !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      used.add(getComputedStyle(el).fontFamily);
    }
    out.fonts = [...used].sort();
  } catch {
    out.fonts = [];
  }

  // Same-origin stylesheets that are actually APPLIED to the document.
  // A page whose CSS was only preloaded (link rel="preload" as="style" with no matching
  // link rel="stylesheet") renders completely unstyled while still looking "clean" to a
  // DOM diff, so this is recorded separately and asserted by the report.
  out.appliedStylesheets = (() => {
    try {
      const set = new Set();
      for (const sheet of Array.from(document.styleSheets)) {
        const href = sheet.href ?? "";
        if (!href.startsWith(location.origin)) continue;
        let rules = null;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin sheet
        }
        if (!rules || rules.length === 0) continue;
        set.add(href.split("/").pop());
      }
      return [...set];
    } catch {
      return [];
    }
  })();

  // Stylesheets the document requested but never applied.
  out.preloadedOnlyStylesheets = Array.from(document.querySelectorAll('link[rel="preload"][as="style"]'))
    .map((l) => l.getAttribute("href") ?? "")
    .filter((h) => h.startsWith(location.origin))
    .map((h) => h.split("/").pop())
    .filter((h) => !out.appliedStylesheets.includes(h));

  // Fonts the document actually loaded.
  out.loadedFontFaces = (() => {
    try {
      const set = new Set();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin sheet
        }
        for (const rule of Array.from(rules ?? [])) {
          if (rule.constructor.name === "CSSFontFaceRule" || rule.type === 5) {
            const family = (rule.style?.getPropertyValue("font-family") ?? "").replace(/["']/g, "").split(",")[0].trim();
            const weight = rule.style?.getPropertyValue("font-weight") ?? "";
            if (family) set.add(`${family} ${weight}`.trim());
          }
        }
      }
      return [...set].sort();
    } catch {
      return [];
    }
  })();

  // Images: rendered size vs natural size, plus the src.
  for (const img of Array.from(document.querySelectorAll("img"))) {
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    out.images.push({
      src: img.currentSrc || img.src,
      attrWidth: img.getAttribute("width"),
      attrHeight: img.getAttribute("height"),
      renderedWidth: Math.round(r.width * 100) / 100,
      renderedHeight: Math.round(r.height * 100) / 100,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      objectFit: cs.objectFit,
      loading: img.getAttribute("loading"),
    });
  }

  const maskSet = new Set(maskSelectors);
  const nodes = Array.from(document.querySelectorAll("body *"));

  nodes.forEach((el, index) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id || "";
    const classes = (el.getAttribute("class") || "").trim();
    const masked = maskSet.has(tag) || maskSet.has("." + classes.split(/\s+/)[0]) || Array.from(el.classList).some((c) => maskSet.has("." + c));

    const rec = {
      index,
      tag,
      id,
      classes,
      parentIndex: el.parentElement ? nodes.indexOf(el.parentElement) : -1,
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
      text: masked ? "" : (el.childElementCount === 0 ? (el.textContent ?? "").trim().slice(0, 200) : ""),
      masked,
      style: {},
    };
    for (const p of props) rec.style[p] = cs[p];
    out.elements.push(rec);
  });

  const de = document.documentElement;
  out.pageHeight = Math.max(de.scrollHeight, document.body?.scrollHeight ?? 0);
  out.clientWidth = de.clientWidth;
  out.scrollWidth = de.scrollWidth;
  out.horizontalOverflow = de.scrollWidth - de.clientWidth;
  return out;
};

/**
 * @param {import('playwright').Browser} browser
 * @param {object} opts { base, page, viewport, props, maskSelectors, storageState, prepare }
 */
export async function collect(browser, opts) {
  const { base, page: pageDef, viewport, storageState, prepare } = opts;

  const context = await browser.newContext({
    viewport: { width: viewport, height: Math.max(800, Math.round(viewport * 0.7)) },
    deviceScaleFactor: 1,
    storageState: storageState ?? undefined,
    reducedMotion: "reduce",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });

  const page = await context.newPage();
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});

  const url = `${base}${pageDef.path}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

  // Settle: fonts, images, network idle, then freeze again in case hydration
  // re-enabled a transition.
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(400);
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});

  if (prepare) await prepare(page);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);

  const data = await page.evaluate(COLLECTOR, [opts.props ?? PROPERTIES, opts.maskSelectors ?? MASK_SELECTORS]);

  const shot = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });

  const stylesheets = await page.evaluate(() =>
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => (n.tagName === "LINK" ? n.getAttribute("href") : "inline <style>"))
      .filter(Boolean),
  );

  const result = {
    page: pageDef.id,
    path: pageDef.path,
    viewport,
    url,
    status: response?.status() ?? 0,
    redirectTo: response?.status() >= 300 && response?.status() < 400 ? response.headers()["location"] ?? null : null,
    stylesheets,
    screenshot: shot,
    ...data,
  };

  await context.close();
  return result;
}
