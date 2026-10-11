"use client";

import { useEffect, useState } from "react";

type Banner = { id: string; template: string; type: string; title: string; message: string; active: boolean };

const TYPE_CLASS: Record<string, string> = {
  info: "sbn-type-info",
  warning: "sbn-type-warning",
  success: "sbn-type-success",
  promo: "sbn-type-promo",
};

export default function SiteBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/site-banners")
      .then((r) => r.json())
      .then((d) => setBanners(d.banners ?? []))
      .catch(() => setBanners([]));
  }, []);

  const visible = banners.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <>
      <style>{`
        .sbn-shell{position:fixed;left:0;right:0;top:0;z-index:997;display:flex;align-items:center;gap:12px;width:100%;padding:10px 20px;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13.5px;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,.08);}
        .sbn-type-info{background:#eff6ff;color:#1e3a5f;border-bottom:1px solid #bfdbfe;}
        .sbn-type-warning{background:#fffbeb;color:#5c3d0a;border-bottom:1px solid #fde68a;}
        .sbn-type-success{background:#ecfdf5;color:#064e3b;border-bottom:1px solid #a7f3d0;}
        .sbn-type-promo{background:linear-gradient(90deg,#fff0f0,#fff5e6);color:#7c2d12;border-bottom:1px solid #fed7aa;}
        .sbn-content{flex:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;}
        .sbn-close{flex-shrink:0;width:24px;height:24px;border:none;background:transparent;font-size:18px;line-height:1;cursor:pointer;opacity:.6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:inherit;}
      `}</style>
      {visible.map((b) => (
        <div key={b.id} className={`sbn-shell ${TYPE_CLASS[b.type] ?? "sbn-type-info"}`} role="status">
          <div className="sbn-content">
            {b.template === "icon-message" ? (
              <>
                <span className="sbnt-icon-icon" aria-hidden="true">i</span>
                {b.title ? <strong className="sbnt-icon-title">{b.title}</strong> : null}
                {b.message ? <span className="sbnt-icon-message">{b.message}</span> : null}
              </>
            ) : (
              <>
                {b.title ? <strong className="sbnt-simple-title">{b.title}</strong> : null}
                {b.message ? <span className="sbnt-simple-message">{b.message}</span> : null}
              </>
            )}
          </div>
          <button className="sbn-close" aria-label="Dismiss banner" onClick={() => setDismissed((s) => new Set([...s, b.id]))}>&times;</button>
        </div>
      ))}
    </>
  );
}
