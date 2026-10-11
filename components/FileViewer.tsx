"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Port of edulariFileExt() in public/partials/file_viewer.php. */
export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

type Props = { lessonId: number; fileName: string; title?: string };

/**
 * Port of edulariFileViewer() in public/partials/file_viewer.php.
 * Same lfv-* classes, same /media?type=lesson_pdf&id= URL, same CDN renderers
 * for docx/pptx/xlsx/zip, same fallback note for unsupported extensions.
 */
export default function FileViewer({ lessonId, fileName, title = "Lesson file" }: Props) {
  const ext = fileExt(fileName);
  const url = `/api/media?type=lesson_pdf&id=${lessonId}`;
  const reactId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!["docx", "pptx", "xlsx", "xls", "csv", "zip"].includes(ext)) return;
    let cancelled = false;

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
        if (existing) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("cdn load failed"));
        document.head.appendChild(s);
      });

    const run = async () => {
      const host = hostRef.current;
      if (!host) return;
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        const buf = await res.arrayBuffer();

        if (ext === "docx") {
          await loadScript("https://cdn.jsdelivr.net/npm/docx-preview@0.3.4/dist/docx-preview.min.js");
          const docx = (window as unknown as { docx: { renderAsync(b: ArrayBuffer, el: HTMLElement, s: null, o: object): Promise<void> } }).docx;
          await docx.renderAsync(buf, host, null, { className: "lfv__docx" });
        } else if (ext === "pptx") {
          await loadScript("https://cdn.jsdelivr.net/npm/pptx-preview@1.0.6/dist/pptx-preview.min.js");
          const PptxPreview = (window as unknown as { PptxPreview: { init(el: HTMLElement, o: object): { load(b: ArrayBuffer): Promise<void> } } }).PptxPreview;
          const p = PptxPreview.init(host, { width: 800, height: 450 });
          await p.load(buf);
        } else if (["xlsx", "xls", "csv"].includes(ext)) {
          await loadScript("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js");
          const XLSX = (window as unknown as { XLSX: { read(b: ArrayBuffer): { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_html(s: unknown): string } } }).XLSX;
          const wb = XLSX.read(buf);
          const sheet = wb.SheetNames[0];
          host.innerHTML = XLSX.utils.sheet_to_html(wb.Sheets[sheet]);
        } else if (ext === "zip") {
          await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
          const JSZip = (window as unknown as { JSZip: { loadAsync(b: ArrayBuffer): Promise<{ forEach(cb: (p: string, f: { dir: boolean }) => void): void }> } }).JSZip;
          const zip = await JSZip.loadAsync(buf);
          const rows: string[] = [];
          zip.forEach((path, f) => rows.push(`<tr><td>${escapeHtml(path)}</td><td>${f.dir ? "Folder" : "File"}</td></tr>`));
          host.innerHTML = `<table><tr><th>Name</th><th>Type</th></tr>${rows.join("")}</table>`;
        }
      } catch {
        if (cancelled) return;
        if (ext === "zip") setError("Could not read this archive.");
        else if (ext === "docx") setError("Could not render this document. Please download it.");
        else if (["xlsx", "xls", "csv"].includes(ext)) setError("Could not render this spreadsheet. Please download it.");
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [ext, url]);

  return (
    <div className="lfv">
      <style>{`
        .lfv{margin:0}
        .lfv__toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}
        .lfv__name{font-weight:600;word-break:break-all}
        .lfv__frame{width:100%;height:75vh;border:1px solid #e5e7eb;border-radius:8px}
        .lfv img.lfv__img{max-width:100%;border-radius:8px;display:block}
        .lfv audio{width:100%}
        .lfv__note{padding:16px;background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;color:#374151}
        .lfv__zip{max-height:60vh;overflow:auto;border:1px solid #e5e7eb;border-radius:8px}
        .lfv__zip table{width:100%;border-collapse:collapse;font-size:14px}
        .lfv__zip td,.lfv__zip th{padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:left}
        .lfv__sheet{overflow:auto;max-height:75vh;border:1px solid #e5e7eb;border-radius:8px}
        .lfv__sheet table{border-collapse:collapse;font-size:13px}
        .lfv__sheet td,.lfv__sheet th{border:1px solid #e5e7eb;padding:6px 10px}
        .lfv__doc{border:1px solid #e5e7eb;border-radius:8px;max-height:75vh;overflow:auto;background:#fff}
      `}</style>

      <div className="lfv__toolbar">
        <span className="lfv__name">{fileName}</span>
        <a className="lp-btn lp-btn--outline lp-btn--sm" href={url} download>Download {ext.toUpperCase()}</a>
      </div>

      {(ext === "pdf" || ext === "txt" || ext === "html") ? (
        <iframe className="lfv__frame" src={url} title={title} loading="lazy" />
      ) : null}

      {["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img className="lfv__img" src={url} alt={title} loading="lazy" />
      ) : null}

      {ext === "mp4" || ext === "webm" ? (
        <video className="lfv__frame" style={{ height: "auto", background: "#000" }} controls preload="metadata" playsInline src={url} />
      ) : null}

      {ext === "mp3" || ext === "wav" || ext === "ogg" ? (
        <audio controls preload="metadata" src={url} />
      ) : null}

      {ext === "docx" ? (
        <div id={`lfv-docx-${lessonId}`} ref={hostRef} className="lfv__doc">
          {error ?? "Loading document…"}
        </div>
      ) : null}

      {ext === "pptx" ? (
        <div id={`lfv-pptx-${lessonId}`} ref={hostRef} className="lfv__doc" style={{ height: "70vh" }}>
          {error ?? "Loading presentation…"}
        </div>
      ) : null}

      {["xlsx", "xls", "csv"].includes(ext) ? (
        <div id={`lfv-xls-${lessonId}`} ref={hostRef} className="lfv__sheet">
          {error ?? "Loading spreadsheet…"}
        </div>
      ) : null}

      {ext === "zip" ? (
        <div id={`lfv-zip-${lessonId}`} ref={hostRef} className="lfv__zip">
          {error ?? "Loading archive…"}
        </div>
      ) : null}

      {ext !== "" && !["pdf", "txt", "html", "jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mp3", "wav", "ogg", "docx", "pptx", "xlsx", "xls", "csv", "zip"].includes(ext) ? (
        <div className="lfv__note">
          Preview is not available for <strong>.{ext}</strong> files. You can open it by downloading.
        </div>
      ) : null}

      {ext === "" ? <span hidden>{reactId}</span> : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] ?? c));
}
