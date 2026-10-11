"use client";

import { useEffect } from "react";

/**
 * The inline script at the bottom of public/admin/enrollments.php, ported 1:1.
 *
 * The only change from the PHP is the fetch target: the page used to POST to itself
 * (window.location.pathname), whereas the App Router answers those three AJAX actions from
 * /api/admin/enrollments. Everything else — the modal dance, the toast, the DOM manipulations —
 * is identical, run against server-rendered static markup exactly as the PHP script did.
 */
export default function EnrollmentsScripts({ csrfToken }: { csrfToken: string }) {
  useEffect(() => {
    const CSRF = csrfToken;
    let pendingUnenrollId: string | null = null;

    const originalEnrollHtml = new Map<HTMLElement, string>();

    function showToast(msg: string, type: "success" | "error" = "success") {
      const t = document.getElementById("enToast");
      if (!t) return;
      t.textContent = msg;
      t.className = "en-toast en-toast--" + type + " en-toast--show";
      const anyT = t as HTMLElement & { _timer?: ReturnType<typeof setTimeout> };
      clearTimeout(anyT._timer);
      anyT._timer = setTimeout(() => t.classList.remove("en-toast--show"), 3500);
    }

    function openModal(id: string) {
      const el = document.getElementById(id);
      if (!el) return;
      el.removeAttribute("hidden");
      el.classList.add("en-modal-overlay--open");
      document.body.style.overflow = "hidden";
    }
    function closeModal(id: string) {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute("hidden", "");
      el.classList.remove("en-modal-overlay--open");
      document.body.style.overflow = "";
    }

    const studentSel = document.getElementById("enStudentSelect") as HTMLSelectElement | null;
    const courseSel = document.getElementById("enCourseSelect") as HTMLSelectElement | null;
    const preview = document.getElementById("enPreview");
    const previewTxt = document.getElementById("enPreviewText");

    function updatePreview() {
      if (!studentSel || !courseSel || !preview || !previewTxt) return;
      const sText = studentSel.options[studentSel.selectedIndex]?.text;
      const cText = courseSel.options[courseSel.selectedIndex]?.text;
      if (studentSel.value && courseSel.value) {
        previewTxt.textContent = (sText ?? "") + " → " + (cText ?? "");
        preview.removeAttribute("hidden");
      } else {
        preview.setAttribute("hidden", "");
      }
    }
    studentSel?.addEventListener("change", updatePreview);
    courseSel?.addEventListener("change", updatePreview);

    const enrollBtn = document.getElementById("enSubmitBtn") as HTMLButtonElement | null;
    if (enrollBtn) originalEnrollHtml.set(enrollBtn, enrollBtn.innerHTML);

    function submitEnroll() {
      if (!studentSel || !courseSel || !enrollBtn || !preview) return;
      const studentId = studentSel.value;
      const courseId = courseSel.value;
      let valid = true;

      const studentErr = document.getElementById("enStudentErr");
      const courseErr = document.getElementById("enCourseErr");
      if (studentErr) studentErr.textContent = "";
      if (courseErr) courseErr.textContent = "";

      if (!studentId) {
        if (studentErr) studentErr.textContent = "Please select a student.";
        valid = false;
      }
      if (!courseId) {
        if (courseErr) courseErr.textContent = "Please select a course.";
        valid = false;
      }
      if (!valid) return;

      enrollBtn.disabled = true;
      enrollBtn.textContent = "Enrolling…";

      const body = new URLSearchParams({
        ajax: "1",
        enroll: "1",
        csrf_token: CSRF,
        student_id: studentId,
        course_id: courseId,
      });

      fetch("/api/admin/enrollments", { method: "POST", body })
        .then((r) => r.json())
        .then((data: { success: boolean; message: string }) => {
          enrollBtn.disabled = false;
          enrollBtn.innerHTML = originalEnrollHtml.get(enrollBtn) ?? "";

          if (data.success) {
            closeModal("enEnrollModal");
            studentSel.value = "";
            courseSel.value = "";
            preview.setAttribute("hidden", "");
            showToast(data.message, "success");
            setTimeout(() => location.reload(), 1200);
          } else {
            showToast(data.message, "error");
          }
        })
        .catch(() => {
          enrollBtn.disabled = false;
          enrollBtn.innerHTML = originalEnrollHtml.get(enrollBtn) ?? "";
          showToast("Network error. Please try again.", "error");
        });
    }

    function openDetailModal(btn: HTMLElement) {
      const ds = btn.dataset;
      const set = (id: string, val: string | undefined) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val ?? "";
      };
      set("enDetailId", ds.enrollmentId);
      set("enDetailStudent", ds.student);
      set("enDetailEmail", ds.email);
      set("enDetailCourse", ds.course);
      set("enDetailInstructor", ds.instructor);
      set("enDetailPrice", ds.price);
      set("enDetailDate", ds.date);

      const prog = parseInt(ds.progress || "0", 10);
      set("enDetailProgressPct", prog + "%");
      const bar = document.getElementById("enDetailProgressBar");
      if (bar) {
        bar.style.width = prog + "%";
        bar.className = "en-progress-fill" + (prog >= 100 ? " en-progress-fill--complete" : prog >= 50 ? " en-progress-fill--mid" : "");
      }

      const unenrollBtn = document.getElementById("enDetailUnenrollBtn");
      if (unenrollBtn) {
        unenrollBtn.dataset.enrollmentId = ds.enrollmentId;
        unenrollBtn.dataset.student = ds.student;
        unenrollBtn.dataset.course = ds.course;
      }

      openModal("enDetailModal");
    }

    function confirmUnenroll(btn: HTMLElement) {
      pendingUnenrollId = btn.dataset.enrollmentId ?? null;
      const s = document.getElementById("enUnenrollStudent");
      const c = document.getElementById("enUnenrollCourse");
      if (s) s.textContent = btn.dataset.student ?? "";
      if (c) c.textContent = btn.dataset.course ?? "";
      openModal("enUnenrollModal");
    }

    function confirmUnenrollFromModal() {
      const btn = document.getElementById("enDetailUnenrollBtn");
      if (!btn) return;
      pendingUnenrollId = btn.dataset.enrollmentId ?? null;
      const s = document.getElementById("enUnenrollStudent");
      const c = document.getElementById("enUnenrollCourse");
      if (s) s.textContent = btn.dataset.student ?? "";
      if (c) c.textContent = btn.dataset.course ?? "";
      closeModal("enDetailModal");
      openModal("enUnenrollModal");
    }

    const confirmUnenrollBtn = document.getElementById("enConfirmUnenrollBtn") as HTMLButtonElement | null;
    if (confirmUnenrollBtn) originalEnrollHtml.set(confirmUnenrollBtn, confirmUnenrollBtn.innerHTML);

    function executeUnenroll() {
      if (!confirmUnenrollBtn) return;
      confirmUnenrollBtn.disabled = true;
      confirmUnenrollBtn.textContent = "Unenrolling…";

      const body = new URLSearchParams({
        ajax: "1",
        unenroll: "1",
        csrf_token: CSRF,
        enrollment_id: pendingUnenrollId ?? "",
      });

      fetch("/api/admin/enrollments", { method: "POST", body })
        .then((r) => r.json())
        .then((data: { success: boolean; message: string }) => {
          closeModal("enUnenrollModal");
          confirmUnenrollBtn.disabled = false;
          confirmUnenrollBtn.textContent = "Yes, Unenroll";

          if (data.success) {
            const row = document.getElementById("en-row-" + pendingUnenrollId);
            if (row) {
              row.style.transition = "opacity .3s, transform .3s";
              row.style.opacity = "0";
              row.style.transform = "translateX(12px)";
              setTimeout(() => row.remove(), 320);
            }
            showToast(data.message, "success");
          } else {
            showToast(data.message, "error");
          }
        })
        .catch(() => {
          closeModal("enUnenrollModal");
          confirmUnenrollBtn.disabled = false;
          confirmUnenrollBtn.textContent = "Yes, Unenroll";
          showToast("Network error. Please try again.", "error");
        });
    }

    const overlays = Array.from(document.querySelectorAll<HTMLElement>(".en-modal-overlay"));
    overlays.forEach((o) => o.addEventListener("click", (e) => {
      if (e.target === o) closeModal(o.id);
    }));
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".en-modal-overlay:not([hidden])").forEach((m) => closeModal(m.id));
      }
    };
    document.addEventListener("keydown", onKeydown);

    const verifyBtn = document.getElementById("enVerifySubmitBtn") as HTMLButtonElement | null;
    if (verifyBtn) originalEnrollHtml.set(verifyBtn, verifyBtn.innerHTML);

    function closeVerifyModal() {
      closeModal("enVerifyPaymentModal");
      const input = document.getElementById("enVerifyPaymentInput") as HTMLInputElement | null;
      if (input) input.value = "";
      const err = document.getElementById("enVerifyPaymentErr");
      if (err) err.textContent = "";
      const box = document.getElementById("enVerifyResultBox");
      if (box) {
        box.setAttribute("hidden", "");
        box.textContent = "";
        box.style.background = "";
        box.style.border = "";
        box.style.color = "";
      }
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalEnrollHtml.get(verifyBtn) ?? "";
      }
    }

    function submitVerifyPayment() {
      if (!verifyBtn) return;
      const input = document.getElementById("enVerifyPaymentInput") as HTMLInputElement | null;
      const errEl = document.getElementById("enVerifyPaymentErr");
      const box = document.getElementById("enVerifyResultBox");
      if (!input || !errEl || !box) return;

      const pid = input.value.trim();
      errEl.textContent = "";
      box.setAttribute("hidden", "");

      if (!pid) {
        errEl.textContent = "Please enter a Payment ID.";
        input.focus();
        return;
      }
      if (!/^pay_[A-Za-z0-9]{14,}$/.test(pid)) {
        errEl.textContent = 'Payment IDs start with "pay_" and are at least 18 characters.';
        input.focus();
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.textContent = "Looking up…";

      const body = new URLSearchParams({
        ajax: "1",
        verify_and_enroll: "1",
        csrf_token: CSRF,
        payment_id: pid,
      });

      fetch("/api/admin/enrollments", { method: "POST", body })
        .then((r) => r.json())
        .then((data: { success: boolean; message: string }) => {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = originalEnrollHtml.get(verifyBtn) ?? "";

          box.removeAttribute("hidden");
          box.textContent = data.message;

          if (data.success) {
            box.style.background = "#f0fdf4";
            box.style.border = "1px solid #86efac";
            box.style.color = "#166534";
            showToast("Enrollment complete.", "success");
          } else {
            box.style.background = "#fef2f2";
            box.style.border = "1px solid #fca5a5";
            box.style.color = "#991b1b";
          }
        })
        .catch(() => {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = originalEnrollHtml.get(verifyBtn) ?? "";
          box.removeAttribute("hidden");
          box.textContent = "Network error. Please check your connection and try again.";
          box.style.background = "#fef2f2";
          box.style.border = "1px solid #fca5a5";
          box.style.color = "#991b1b";
        });
    }

    const dataModalButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-modal]"));
    const onDataModal = (e: Event) => openModal((e.currentTarget as HTMLElement).dataset.modal || "");
    dataModalButtons.forEach((btn) => btn.addEventListener("click", onDataModal));

    const closeVerifyButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-close-verify]"));
    closeVerifyButtons.forEach((btn) => btn.addEventListener("click", closeVerifyModal));
    verifyBtn?.addEventListener("click", submitVerifyPayment);

    const courseFilter = document.getElementById("enCourseFilter") as HTMLSelectElement | null;
    const onCourseFilter = () => (courseFilter?.form as HTMLFormElement | null)?.submit();
    courseFilter?.addEventListener("change", onCourseFilter);

    const tableBody = document.getElementById("enTableBody");
    const onTableClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const viewBtn = target.closest(".js-view-detail") as HTMLElement | null;
      if (viewBtn) {
        openDetailModal(viewBtn);
        return;
      }
      const unenrollBtn = target.closest(".js-unenroll") as HTMLElement | null;
      if (unenrollBtn) confirmUnenroll(unenrollBtn);
    };
    tableBody?.addEventListener("click", onTableClick);

    const closeModalButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-close-modal]"));
    const onCloseModal = (e: Event) => closeModal((e.currentTarget as HTMLElement).dataset.closeModal || "");
    closeModalButtons.forEach((btn) => btn.addEventListener("click", onCloseModal));

    enrollBtn?.addEventListener("click", submitEnroll);
    const detailUnenrollBtn = document.getElementById("enDetailUnenrollBtn");
    detailUnenrollBtn?.addEventListener("click", confirmUnenrollFromModal);
    confirmUnenrollBtn?.addEventListener("click", executeUnenroll);

    return () => {
      studentSel?.removeEventListener("change", updatePreview);
      courseSel?.removeEventListener("change", updatePreview);
      document.removeEventListener("keydown", onKeydown);
      dataModalButtons.forEach((btn) => btn.removeEventListener("click", onDataModal));
      closeVerifyButtons.forEach((btn) => btn.removeEventListener("click", closeVerifyModal));
      verifyBtn?.removeEventListener("click", submitVerifyPayment);
      courseFilter?.removeEventListener("change", onCourseFilter);
      tableBody?.removeEventListener("click", onTableClick);
      closeModalButtons.forEach((btn) => btn.removeEventListener("click", onCloseModal));
      enrollBtn?.removeEventListener("click", submitEnroll);
      detailUnenrollBtn?.removeEventListener("click", confirmUnenrollFromModal);
      confirmUnenrollBtn?.removeEventListener("click", executeUnenroll);
    };
  }, [csrfToken]);

  return null;
}
