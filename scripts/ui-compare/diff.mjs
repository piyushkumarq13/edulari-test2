/**
 * scripts/ui-compare/diff.mjs
 *
 * Pairs elements between an old and a new snapshot and produces the mismatch list.
 *
 * Pairing strategy (in order of confidence):
 *   1. exact `tag#id.classes` signature, occurrences matched in document order
 *   2. `tag.classes` signature
 *   3. tag alone
 * Anything left over is reported as only-in-old / only-in-new.
 */

import { COLOR_PROPS, TOLERANCE_PX } from "./config.mjs";

const sig1 = (e) => `${e.tag}#${e.id}.${e.classes}`;
const sig2 = (e) => `${e.tag}.${e.classes}`;
const sig3 = (e) => e.tag;

function buildIndex(elements, sigFn) {
  const map = new Map();
  for (const el of elements) {
    const k = sigFn(el);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(el);
  }
  return map;
}

function describe(e) {
  const cls = e.classes ? `.${e.classes.split(/\s+/).join(".")}` : "";
  return `${e.tag}${e.id ? `#${e.id}` : ""}${cls}`;
}

function parseColor(v) {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(String(v).trim());
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

function colorsEqual(a, b) {
  if (a === b) return true;
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return false;
  return ca.r === cb.r && ca.g === cb.g && ca.b === cb.b && Math.abs(ca.a - cb.a) < 0.01;
}

const NUMERIC_PROPS = new Set([
  "top", "right", "bottom", "left", "width", "height",
  "min-width", "max-width", "min-height", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "font-size", "font-weight", "line-height", "letter-spacing",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "opacity", "z-index", "gap", "row-gap", "column-gap", "flex-grow", "flex-shrink", "order",
  "outline-width", "outline-offset",
]);

function valuesEqual(prop, a, b) {
  if (a === undefined || a === null) a = "";
  if (b === undefined || b === null) b = "";
  if (COLOR_PROPS.has(prop)) return colorsEqual(a, b);
  if (NUMERIC_PROPS.has(prop)) {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) <= TOLERANCE_PX;
    return String(a).trim() === String(b).trim();
  }
  // font-size / line-height may be "normal" vs a px value
  return String(a).trim() === String(b).trim();
}

/** Weight a mismatch by how visible it is, so the report can be sorted by impact. */
function impact(prop) {
  if (["display", "position", "visibility", "font-family", "font-size", "font-weight"].includes(prop)) return 100;
  if (["width", "height", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-left", "margin-right", "margin-bottom"].includes(prop)) return 80;
  if (["color", "background-color", "border-radius", "gap", "row-gap", "column-gap", "box-shadow", "line-height", "letter-spacing", "text-align"].includes(prop)) return 60;
  if (COLOR_PROPS.has(prop)) return 60;
  if (["max-width", "min-height", "max-height", "grid-template-columns", "flex-direction", "justify-content", "align-items"].includes(prop)) return 50;
  return 20;
}

export function diffSnapshots(oldSnap, newSnap) {
  const mismatches = [];
  const matchedOld = new Set();
  const matchedNew = new Set();

  // Pass 1: signature #id.classes, then .classes, then tag.
  for (const sigFn of [sig1, sig2, sig3]) {
    const oi = buildIndex(oldSnap.elements, sigFn);
    const ni = buildIndex(newSnap.elements, sigFn);
    for (const [k, oEls] of oi) {
      const nEls = ni.get(k);
      if (!nEls) continue;
      const n = Math.min(oEls.length, nEls.length);
      for (let i = 0; i < n; i++) {
        const o = oEls[i];
        const nw = nEls[i];
        if (matchedOld.has(o.index) || matchedNew.has(nw.index)) continue;
        matchedOld.add(o.index);
        matchedNew.add(nw.index);

        // Geometry
        for (const dim of ["x", "y", "width", "height"]) {
          if (Math.abs(o.box[dim] - nw.box[dim]) > TOLERANCE_PX) {
            mismatches.push({
              kind: "geometry",
              selector: describe(o),
              property: `box-${dim}`,
              old: Math.round(o.box[dim] * 100) / 100,
              new: Math.round(nw.box[dim] * 100) / 100,
              delta: Math.round((nw.box[dim] - o.box[dim]) * 100) / 100,
              impact: 80,
            });
          }
        }

        // Text
        if (!o.masked && o.text && nw.text && o.text !== nw.text) {
          mismatches.push({
            kind: "text",
            selector: describe(o),
            property: "text",
            old: o.text.slice(0, 120),
            new: nw.text.slice(0, 120),
            impact: 40,
          });
        }

        // Computed styles
        for (const prop of Object.keys(o.style)) {
          const ov = o.style[prop];
          const nv = nw.style[prop];
          if (valuesEqual(prop, ov, nv)) continue;
          mismatches.push({
            kind: "style",
            selector: describe(o),
            property: prop,
            old: String(ov),
            new: String(nv),
            impact: impact(prop),
          });
        }
      }
    }
  }

  const onlyOld = oldSnap.elements.filter((e) => !matchedOld.has(e.index) && (e.id || e.classes));
  const onlyNew = newSnap.elements.filter((e) => !matchedNew.has(e.index) && (e.id || e.classes));

  // Page level
  const pageMismatches = [];
  if (oldSnap.title !== newSnap.title) {
    pageMismatches.push({ kind: "meta", selector: "title", property: "title", old: oldSnap.title, new: newSnap.title, impact: 30 });
  }
  if (Math.abs(oldSnap.pageHeight - newSnap.pageHeight) > TOLERANCE_PX) {
    pageMismatches.push({
      kind: "geometry",
      selector: "document",
      property: "pageHeight",
      old: oldSnap.pageHeight,
      new: newSnap.pageHeight,
      delta: newSnap.pageHeight - oldSnap.pageHeight,
      impact: 90,
    });
  }
  if (oldSnap.horizontalOverflow !== newSnap.horizontalOverflow) {
    pageMismatches.push({
      kind: "geometry",
      selector: "document",
      property: "horizontalOverflow",
      old: oldSnap.horizontalOverflow,
      new: newSnap.horizontalOverflow,
      impact: 95,
    });
  }
  const oldFonts = (oldSnap.fonts ?? []).join(" | ");
  const newFonts = (newSnap.fonts ?? []).join(" | ");
  if (oldFonts !== newFonts) {
    pageMismatches.push({ kind: "font", selector: "body", property: "font-family-in-use", old: oldFonts, new: newFonts, impact: 100 });
  }

  mismatches.push(...pageMismatches);

  return { mismatches, onlyOld, onlyNew };
}
