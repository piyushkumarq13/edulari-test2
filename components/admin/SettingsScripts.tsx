"use client";

import { useEffect } from "react";

/**
 * The inline script at the bottom of public/admin/settings.php (lines 1014-1431), ported 1:1.
 *
 * The markup is server-rendered and static, so this client component binds listeners to it after
 * mount without React owning those nodes. The only behavioural change is the AJAX target: the PHP
 * posted back to the page URL and the page's POST branch answered with JSON; here the fetch goes to
 * /api/admin/settings, which answers with the identical JSON shapes.
 */
export default function SettingsScripts({ csrfToken, endpoint }: { csrfToken: string; endpoint: string }) {
  useEffect(() => {
    function qs<T extends Element = HTMLElement>(sel: string, ctx?: ParentNode): T | null {
      return (ctx || document).querySelector<T>(sel);
    }
    function qsa<T extends Element = HTMLElement>(sel: string, ctx?: ParentNode): T[] {
      return Array.from((ctx || document).querySelectorAll<T>(sel));
    }

    /* ── Toast ── */
    const toast = qs("#stsToast");
    const toastMsg = qs("#stsToastMsg");
    const toastIco = qs("#stsToastIcon");
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    function showToast(msg: string, type?: "success" | "error" | "info") {
      clearTimeout(toastTimer);
      if (toastMsg) toastMsg.textContent = msg;
      if (toast) toast.className = "sts-toast sts-toast--" + (type || "info") + " sts-toast--show";
      const icons: Record<string, string> = {
        success:
          '<svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error:
          '<svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      };
      if (toastIco) toastIco.innerHTML = icons[type || "info"] || icons.info;
      toastTimer = setTimeout(() => {
        if (toast) toast.className = "sts-toast";
      }, 4500);
    }

    /* ── AJAX helper ── */
    function postForm(data: FormData, cb: (res: SettingsResponse) => void) {
      data.append("csrf_token", csrfToken);
      fetch(endpoint, { method: "POST", body: data })
        .then((r) => r.json())
        .then(cb)
        .catch(() => showToast("Network error. Please try again.", "error"));
    }

    type SettingsResponse = {
      success?: boolean;
      message?: string;
      maintenance?: boolean;
      student?: boolean;
      instructor?: boolean;
      auto_disable_at?: string | null;
      data?: SystemInfoData;
      tables?: Array<{ table: string; count: number | null; size_kb: string | number; status: string }>;
    };
    type SystemInfoData = {
      php_version: string;
      server_software: string;
      os: string;
      memory_limit: string;
      upload_max: string;
      post_max: string;
      max_exec_time: string;
      db_version: string;
      disk_free: string;
      disk_total: string;
      server_time: string;
    };

    const listeners: Array<[EventTarget, string, EventListener]> = [];
    function on<T extends EventTarget>(target: T | null, event: string, handler: EventListener) {
      if (!target) return;
      target.addEventListener(event, handler);
      listeners.push([target, event, handler]);
    }

    /* ── Tab switching ── */
    const tabs = qsa(".sts-tab");
    const panels = qsa(".sts-panel");
    tabs.forEach((tab) => {
      on(tab, "click", () => {
        tabs.forEach((t) => {
          t.classList.remove("sts-tab--active");
          t.setAttribute("aria-selected", "false");
        });
        panels.forEach((p) => p.classList.remove("sts-panel--active"));
        tab.classList.add("sts-tab--active");
        tab.setAttribute("aria-selected", "true");
        const panel = qs("#sts-panel-" + (tab.getAttribute("data-tab") || ""));
        if (panel) panel.classList.add("sts-panel--active");
        if (tab.getAttribute("data-tab") === "system") loadSysInfo();
      });
    });

    /* ── General form ── */
    const generalForm = qs<HTMLFormElement>("#stsGeneralForm");
    on(generalForm, "submit", (e) => {
      e.preventDefault();
      const fd = new FormData(generalForm!);
      fd.append("action", "update_general");
      postForm(fd, (res) => showToast(res.message || "", res.success ? "success" : "error"));
    });

    /* ── SMTP form ── */
    const smtpForm = qs<HTMLFormElement>("#stsSmtpForm");
    on(smtpForm, "submit", (e) => {
      e.preventDefault();
      const fd = new FormData(smtpForm!);
      fd.append("action", "update_smtp");
      postForm(fd, (res) => showToast(res.message || "", res.success ? "success" : "error"));
    });

    /* ── SMTP test ── */
    const smtpTestBtn = qs<HTMLButtonElement>("#stsSmtpTestBtn");
    on(smtpTestBtn, "click", () => {
      const btn = smtpTestBtn!;
      const fd = new FormData(smtpForm!);
      fd.append("action", "test_smtp");
      btn.disabled = true;
      btn.textContent = "Sending…";
      postForm(fd, (res) => {
        showToast(res.message || "", res.success ? "success" : "error");
        btn.disabled = false;
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg> Send Test';
      });
    });

    /* ── Security form ── */
    const securityForm = qs<HTMLFormElement>("#stsSecurityForm");
    on(securityForm, "submit", (e) => {
      e.preventDefault();
      const fd = new FormData(securityForm!);
      fd.append("action", "update_security");
      postForm(fd, (res) => showToast(res.message || "", res.success ? "success" : "error"));
    });

    /* ── Hash cost slider ── */
    const rangeEl = qs<HTMLInputElement>("#hashCost");
    const badgeEl = qs("#hashCostBadge");
    on(rangeEl, "input", () => {
      if (rangeEl && badgeEl) badgeEl.textContent = rangeEl.value;
    });

    /* ── Clear cache ── */
    const clearCacheBtn = qs<HTMLButtonElement>("#stsClearCacheBtn");
    on(clearCacheBtn, "click", () => {
      const btn = clearCacheBtn!;
      btn.disabled = true;
      const fd = new FormData();
      fd.append("action", "clear_cache");
      postForm(fd, (res) => {
        showToast(res.message || "", res.success ? "success" : "error");
        btn.disabled = false;
      });
    });

    /* ── Maintenance modal elements ── */
    const maintModal = qs("#stsMaintModal");
    const maintModalClose = qs("#stsMaintModalClose");
    const maintModalCancel = qs("#stsMaintModalCancel");
    const maintModalConfirm = qs<HTMLButtonElement>("#stsMaintModalConfirm");
    const maintChkStudent = qs<HTMLInputElement>("#stsMaintModalStudent");
    const maintChkInstructor = qs<HTMLInputElement>("#stsMaintModalInstructor");
    const maintAutoSelect = qs<HTMLSelectElement>("#stsMaintModalAuto");
    const maintCustomWrap = qs("#stsMaintModalCustomWrap");
    const maintCustomMins = qs<HTMLInputElement>("#stsMaintModalCustomMins");

    function openMaintModal() {
      if (maintModal) maintModal.style.display = "flex";
      if (maintChkStudent) maintChkStudent.checked = false;
      if (maintChkInstructor) maintChkInstructor.checked = false;
      if (maintAutoSelect) maintAutoSelect.value = "";
      if (maintCustomWrap) maintCustomWrap.style.display = "none";
      if (maintModalConfirm) maintModalConfirm.disabled = true;
    }
    function closeMaintModal() {
      if (maintModal) maintModal.style.display = "none";
    }
    function updateMaintConfirmBtn() {
      if (maintModalConfirm) {
        maintModalConfirm.disabled = !(maintChkStudent?.checked || maintChkInstructor?.checked);
      }
    }

    on(maintChkStudent, "change", updateMaintConfirmBtn);
    on(maintChkInstructor, "change", updateMaintConfirmBtn);
    on(maintAutoSelect, "change", () => {
      if (maintCustomWrap && maintAutoSelect) {
        maintCustomWrap.style.display = maintAutoSelect.value === "custom" ? "block" : "none";
      }
    });
    on(maintModalClose, "click", closeMaintModal);
    on(maintModalCancel, "click", closeMaintModal);
    on(maintModal, "click", (e) => {
      if (e.target === maintModal) closeMaintModal();
    });

    on(maintModalConfirm, "click", () => {
      const fd = new FormData();
      fd.append("action", "toggle_maintenance");
      fd.append("student", maintChkStudent?.checked ? "1" : "0");
      fd.append("instructor", maintChkInstructor?.checked ? "1" : "0");
      const autoVal = maintAutoSelect?.value ?? "";
      if (autoVal === "custom") {
        const mins = parseInt(maintCustomMins?.value ?? "", 10);
        if (mins > 0) fd.append("auto_disable_minutes", String(mins));
      } else if (autoVal !== "") {
        fd.append("auto_disable_minutes", autoVal);
      }
      closeMaintModal();
      postForm(fd, maintUpdateUI);
    });

    function maintUpdateUI(res: SettingsResponse) {
      if (!res.success) {
        showToast(res.message || "", "error");
        return;
      }
      showToast(res.message || "", "info");
      setTimeout(() => window.location.reload(), 700);
      const pill = qs("#stsMaintPill");
      const label = qs("#stsMaintLabel");
      if (res.maintenance) {
        const scopeParts: string[] = [];
        if (res.student) scopeParts.push("Student");
        if (res.instructor) scopeParts.push("Instructor");
        pill?.classList.add("sts-maintenance-pill--active");
        if (label) label.textContent = "Maint: " + (scopeParts.join("/") || "ON");
      } else {
        pill?.classList.remove("sts-maintenance-pill--active");
        if (label) label.textContent = "Maintenance OFF";
      }
      const block = qs("#stsMaintBlock");
      const status = qs("#stsMaintStatus");
      const secBtn = qs("#stsMaintToggleBtn");
      if (block && status && secBtn) {
        if (res.maintenance) {
          block.classList.add("sts-maint-block--on");
          const scopeParts: string[] = [];
          if (res.student) scopeParts.push("Student (incl. public)");
          if (res.instructor) scopeParts.push("Instructor");
          let statusText = "Currently ENABLED — blocking: " + (scopeParts.join(", ") || "?") + ".";
          if (res.auto_disable_at) {
            const d = new Date(res.auto_disable_at.replace(" ", "T"));
            statusText += " Auto-disable at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".";
          }
          status.textContent = statusText;
          secBtn.textContent = "Disable Maintenance";
          secBtn.className = "sts-btn sts-btn--danger";
        } else {
          block.classList.remove("sts-maint-block--on");
          status.textContent = "Currently DISABLED — site is live.";
          secBtn.textContent = "Enable Maintenance";
          secBtn.className = "sts-btn sts-btn--outline";
        }
      }
    }

    function bindMaintToggle(btnId: string) {
      const btn = qs("#" + btnId);
      if (!btn) return;
      on(btn, "click", () => {
        const block = qs("#stsMaintBlock");
        const isOn = block && block.classList.contains("sts-maint-block--on");
        if (isOn) {
          const fd = new FormData();
          fd.append("action", "toggle_maintenance");
          fd.append("student", "0");
          fd.append("instructor", "0");
          postForm(fd, maintUpdateUI);
        } else {
          openMaintModal();
        }
      });
    }
    bindMaintToggle("stsMaintBtn");
    bindMaintToggle("stsMaintToggleBtn");

    /* ── DB health check ── */
    const dbHealthBtn = qs<HTMLButtonElement>("#stsDbHealthBtn");
    on(dbHealthBtn, "click", () => {
      const btn = dbHealthBtn!;
      btn.disabled = true;
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" width="16" height="16" class="sts-spin"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Checking…';
      const fd = new FormData();
      fd.append("action", "db_health");
      postForm(fd, (res) => {
        btn.disabled = false;
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Run Health Check';
        if (!res.tables) {
          showToast(res.message || "", "error");
          return;
        }
        const tbody = qs("#stsDbTable tbody");
        const rows = qsa("tr", tbody ?? undefined);
        res.tables.forEach((t, i) => {
          if (!rows[i]) return;
          const cells = qsa("td", rows[i]);
          if (cells[1]) cells[1].textContent = t.count !== null ? t.count.toLocaleString() : "—";
          if (cells[2]) cells[2].textContent = t.size_kb !== undefined ? String(t.size_kb) : "—";
          if (cells[3]) {
            cells[3].innerHTML =
              t.status === "ok"
                ? '<span class="sts-badge-status sts-badge-status--ok">OK</span>'
                : '<span class="sts-badge-status sts-badge-status--error">Error</span>';
          }
        });
        showToast(res.message || "", res.success ? "success" : "error");
      });
    });

    /* ── System info ── */
    function loadSysInfo() {
      const grid = qs("#stsSysGrid");
      if (!grid) return;
      grid.innerHTML = '<div class="sts-sysinfo-loading"><div class="sts-spinner"></div><span>Loading…</span></div>';
      const fd = new FormData();
      fd.append("action", "system_info");
      postForm(fd, (res) => {
        if (!res.data) {
          grid.innerHTML = '<p class="sts-error">Failed to load system info.</p>';
          return;
        }
        const d = res.data;
        const items: Array<{ icon: string; label: string; value: string }> = [
          { icon: "🖥", label: "PHP Version", value: d.php_version },
          { icon: "🌐", label: "Server Software", value: d.server_software },
          { icon: "💻", label: "OS", value: d.os },
          { icon: "🧠", label: "Memory Limit", value: d.memory_limit },
          { icon: "📤", label: "Upload Max Size", value: d.upload_max },
          { icon: "📋", label: "POST Max Size", value: d.post_max },
          { icon: "⏱", label: "Max Exec Time", value: d.max_exec_time },
          { icon: "🗄", label: "MySQL Version", value: d.db_version },
          { icon: "💾", label: "Disk Free", value: d.disk_free },
          { icon: "📦", label: "Disk Total", value: d.disk_total },
          { icon: "🕐", label: "Server Time", value: d.server_time },
        ];
        grid.innerHTML = "";
        items.forEach((it) => {
          const wrap = document.createElement("div");
          wrap.className = "sts-sysinfo-item";
          const icon = document.createElement("span");
          icon.className = "sts-sysinfo-icon";
          icon.textContent = it.icon;
          const label = document.createElement("span");
          label.className = "sts-sysinfo-label";
          label.textContent = it.label;
          const value = document.createElement("span");
          value.className = "sts-sysinfo-value";
          value.textContent = it.value || "—";
          wrap.append(icon, label, value);
          grid.appendChild(wrap);
        });
      });
    }
    on(qs("#stsSysRefreshBtn"), "click", loadSysInfo);

    /* ── Password strength ── */
    const newPwEl = qs<HTMLInputElement>("#newPassword");
    const barEl = qs("#stsPwStrengthBar");
    const lblEl = qs("#stsPwStrengthLabel");
    function pwStrength(pw: string): number {
      let score = 0;
      if (pw.length >= 8) score++;
      if (pw.length >= 12) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      return score;
    }
    on(newPwEl, "input", () => {
      const pw = newPwEl?.value ?? "";
      const sc = pw ? pwStrength(pw) : 0;
      const pct = Math.min(sc * 20, 100);
      const cls = sc <= 1 ? "weak" : sc <= 3 ? "fair" : "strong";
      const lbl = sc <= 1 ? "Weak" : sc <= 3 ? "Fair" : "Strong";
      if (barEl) {
        barEl.style.width = pct + "%";
        barEl.className = "sts-pw-strength-bar sts-pw-strength-bar--" + cls;
      }
      if (lblEl) {
        lblEl.textContent = pw ? lbl : "";
        lblEl.className = "sts-pw-strength-label sts-pw-strength-label--" + cls;
      }
    });

    /* ── Password match ── */
    const confirmPwEl = qs<HTMLInputElement>("#confirmPassword");
    const matchEl = qs("#stsPwMatch");
    on(confirmPwEl, "input", () => {
      if (!matchEl || !confirmPwEl) return;
      if (!confirmPwEl.value) {
        matchEl.textContent = "";
        return;
      }
      if (confirmPwEl.value === (newPwEl?.value ?? "")) {
        matchEl.textContent = "✓ Passwords match";
        matchEl.className = "sts-pw-match sts-pw-match--ok";
      } else {
        matchEl.textContent = "✗ Passwords do not match";
        matchEl.className = "sts-pw-match sts-pw-match--err";
      }
    });

    /* ── Password form ── */
    const pwForm = qs<HTMLFormElement>("#stsPwForm");
    on(pwForm, "submit", (e) => {
      e.preventDefault();
      const confirmVal = confirmPwEl?.value ?? "";
      const newVal = newPwEl?.value ?? "";
      if (newVal !== confirmVal) {
        showToast("Passwords do not match.", "error");
        return;
      }
      if (newVal.length < 8) {
        showToast("Password must be at least 8 characters.", "error");
        return;
      }
      const fd = new FormData(pwForm!);
      fd.append("action", "change_password");
      postForm(fd, (res) => {
        showToast(res.message || "", res.success ? "success" : "error");
        if (res.success) {
          pwForm!.reset();
          if (barEl) barEl.style.width = "0";
          if (lblEl) lblEl.textContent = "";
          if (matchEl) matchEl.textContent = "";
        }
      });
    });

    /* ── API Keys form ── */
    const apiForm = qs<HTMLFormElement>("#stsApiForm");
    on(apiForm, "submit", (e) => {
      e.preventDefault();
      const fd = new FormData(apiForm!);
      fd.append("action", "update_api");
      postForm(fd, (res) => showToast(res.message || "", res.success ? "success" : "error"));
    });

    /* ── AI provider radio card highlight ── */
    qsa<HTMLInputElement>('input[name="active_ai_provider"]').forEach((radio) => {
      on(radio, "change", () => {
        qsa(".sts-radio-card").forEach((card) => card.classList.remove("sts-radio-card--active"));
        radio.closest(".sts-radio-card")?.classList.add("sts-radio-card--active");
      });
    });

    /* ── Show / hide password toggles ── */
    qsa<HTMLElement>(".sts-pw-toggle").forEach((btn) => {
      on(btn, "click", () => {
        const input = qs<HTMLInputElement>("#" + (btn.getAttribute("data-target") || ""));
        const eyeOn = qs(".sts-eye-show", btn);
        const eyeOff = qs(".sts-eye-hide", btn);
        if (!input) return;
        if (input.type === "password") {
          input.type = "text";
          if (eyeOn) (eyeOn as HTMLElement).style.display = "none";
          if (eyeOff) (eyeOff as HTMLElement).style.display = "";
        } else {
          input.type = "password";
          if (eyeOn) (eyeOn as HTMLElement).style.display = "";
          if (eyeOff) (eyeOff as HTMLElement).style.display = "none";
        }
      });
    });

    return () => {
      listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler));
      clearTimeout(toastTimer);
    };
  }, [csrfToken, endpoint]);

  return null;
}
