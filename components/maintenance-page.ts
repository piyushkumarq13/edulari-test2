/**
 * Port of public/partials/maintenance-page.php.
 *
 * The PHP file renders a complete standalone document (its own <head>, inline
 * <style>, dark gradient background, pulsing status dot). In Next.js the same
 * markup is returned from proxy.ts as an HTML string so it bypasses the app
 * router entirely, exactly as checkMaintenanceMode() did in bootstrap.php.
 */
export function renderMaintenancePage(siteName = "Edulari"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Under Maintenance — ${escapeHtml(siteName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #0f0c29 0%, #1a1a4e 50%, #24243e 100%);
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  -webkit-font-smoothing: antialiased;
}
.maint-container {
  max-width: 480px;
  padding: 2.5rem;
}
.maint-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 1.5rem;
  background: rgba(232,69,69,0.12);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.maint-icon svg { color: #e84545; }
.maint-title {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 0.75rem;
  color: #fff;
}
.maint-desc {
  font-size: 1rem;
  line-height: 1.7;
  color: #94a3b8;
  margin-bottom: 2rem;
}
.maint-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e84545;
  animation: maintPulse 1.4s infinite;
  margin-right: 0.5rem;
}
.maint-status {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes maintPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
</head>
<body>
<div class="maint-container">
  <div class="maint-icon">
    <svg viewBox="0 0 24 24" fill="none" width="32" height="32" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  </div>
  <h1 class="maint-title">We'll be right back</h1>
  <p class="maint-desc">${escapeHtml(siteName)} is currently undergoing scheduled maintenance. We apologize for the inconvenience and will be back online shortly.</p>
  <div class="maint-status">
    <span class="maint-dot"></span>
    <span>Maintenance in progress</span>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] ?? c));
}
