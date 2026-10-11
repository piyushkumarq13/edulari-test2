/**
 * The inline <style> block dashboard.php carries in its <head> (onboarding banner,
 * personalised badge, welcome toast and their two keyframes). Ported verbatim so the
 * classes it styles exist in the stylesheet tree.
 */
export const DASHBOARD_EXTRA_STYLES = `
        /* ── Onboarding Banner ── */
        .onboard-banner {
            background: linear-gradient(135deg, #4338ca 0%, #06b6d4 100%);
            color: #fff;
            padding: 18px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 14px;
            border-radius: 14px;
            margin-bottom: 22px;
            box-shadow: 0 6px 24px rgba(67,56,202,.28);
            animation: slideDown .4s ease;
        }
        .onboard-banner-left { display: flex; align-items: center; gap: 16px; }
        .onboard-banner-emoji { font-size: 2.2rem; line-height: 1; }
        .onboard-banner-title { font-size: 1rem; font-weight: 700; margin-bottom: 2px; }
        .onboard-banner-sub   { font-size: .85rem; opacity: .88; }
        .onboard-banner-btn {
            background: #fff;
            color: #4338ca;
            padding: 10px 22px;
            border-radius: 8px;
            font-weight: 700;
            font-size: .88rem;
            text-decoration: none;
            white-space: nowrap;
            transition: opacity .2s;
        }
        .onboard-banner-btn:hover { opacity: .88; }

        /* ── Personalised badge ── */
        .personalised-badge {
            background: #ede9fe;
            color: #4338ca;
            padding: 3px 11px;
            border-radius: 99px;
            font-size: .75rem;
            font-weight: 600;
            vertical-align: middle;
            margin-left: 8px;
            white-space: nowrap;
            flex-shrink: 0;
        }

        /* ── Welcome toast (shown once after onboarding) ── */
        .welcome-toast {
            position: fixed;
            bottom: 28px;
            right: 28px;
            background: #fff;
            border-left: 4px solid #4338ca;
            border-radius: 10px;
            padding: 16px 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,.14);
            max-width: 320px;
            z-index: 9999;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            animation: toastIn .4s ease;
        }
        .welcome-toast-icon { font-size: 1.6rem; line-height: 1; }
        .welcome-toast-title { font-weight: 700; font-size: .95rem; margin-bottom: 3px; }
        .welcome-toast-sub   { font-size: .82rem; color: #64748b; }
        .welcome-toast-close {
            position: absolute; top: 8px; right: 10px;
            background: none; border: none; cursor: pointer;
            font-size: 1rem; color: #94a3b8; line-height: 1;
        }

        @keyframes slideDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn   { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
    `;