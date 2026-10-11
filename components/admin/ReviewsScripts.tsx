"use client";

import { useEffect } from "react";

/**
 * The inline script at the bottom of public/admin/reviews.php, ported 1:1.
 *
 * Only the AJAX delete target changed (window.location.pathname -> /api/admin/reviews);
 * the modal helpers, the toast, the star builder, the inline "Read more" expander and the
 * auto-submitting filter selects behave exactly as before, against server-rendered markup.
 */
export default function ReviewsScripts({ csrfToken }: { csrfToken: string }) {
  useEffect(() => {
    const CSRF_TOKEN = csrfToken;
    let pendingDeleteId: string | null = null;

    function showToast(msg: string, type: "success" | "error" = "success") {
      const t = document.getElementById("rvToast");
      if (!t) return;
      t.textContent = msg;
      t.className = "rv-toast rv-toast--" + type + " rv-toast--show";
      const anyT = t as HTMLElement & { _timer?: ReturnType<typeof setTimeout> };
      clearTimeout(anyT._timer);
      anyT._timer = setTimeout(() => t.classList.remove("rv-toast--show"), 3500);
    }

    function openModal(id: string) {
      const el = document.getElementById(id);
      if (!el) return;
      el.removeAttribute("hidden");
      el.classList.add("rv-modal-overlay--open");
      document.body.style.overflow = "hidden";
      (el.querySelector(".rv-modal") as HTMLElement | null)?.focus();
    }
    function closeModal(id: string) {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute("hidden", "");
      el.classList.remove("rv-modal-overlay--open");
      document.body.style.overflow = "";
    }

    function openReviewModal(btn: HTMLElement) {
      const ds = btn.dataset;
      const set = (id: string, val: string | undefined) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val ?? "";
      };
      set("rvModalStudent", ds.student);
      set("rvModalCourse", ds.course);
      set("rvModalDate", ds.date);
      set("rvModalText", ds.text);

      const stars = document.getElementById("rvModalStars");
      const r = parseInt(ds.rating || "0", 10);
      if (stars) {
        stars.innerHTML = "";
        for (let i = 1; i <= 5; i++) {
          const s = document.createElement("span");
          s.textContent = "★";
          s.className = i <= r ? "rv-star rv-star--filled" : "rv-star rv-star--empty";
          stars.appendChild(s);
        }
        stars.insertAdjacentText("beforeend", " " + r + ".0");
      }

      const delBtn = document.getElementById("rvModalDeleteBtn");
      if (delBtn) {
        delBtn.dataset.reviewId = ds.reviewId;
        delBtn.dataset.student = ds.student;
      }
      openModal("rvViewModal");
    }

    function confirmDeleteFromModal() {
      const btn = document.getElementById("rvModalDeleteBtn");
      if (!btn) return;
      pendingDeleteId = btn.dataset.reviewId ?? null;
      const el = document.getElementById("rvDeleteStudent");
      if (el) el.textContent = btn.dataset.student ?? "";
      closeModal("rvViewModal");
      openModal("rvDeleteModal");
    }

    function confirmDelete(btn: HTMLElement) {
      pendingDeleteId = btn.dataset.reviewId ?? null;
      const el = document.getElementById("rvDeleteStudent");
      if (el) el.textContent = btn.dataset.student ?? "";
      openModal("rvDeleteModal");
    }

    const confirmBtn = document.getElementById("rvConfirmDeleteBtn") as HTMLButtonElement | null;

    function executeDelete() {
      if (!confirmBtn) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Deleting…";

      const body = new URLSearchParams({
        ajax_delete: "1",
        csrf_token: CSRF_TOKEN,
        review_id: pendingDeleteId ?? "",
      });

      fetch("/api/admin/reviews", { method: "POST", body })
        .then((r) => r.json())
        .then((data: { success: boolean; message?: string }) => {
          closeModal("rvDeleteModal");
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Yes, Delete";

          if (data.success) {
            const row = document.getElementById("rv-row-" + pendingDeleteId);
            if (row) {
              row.style.transition = "opacity .3s, transform .3s";
              row.style.opacity = "0";
              row.style.transform = "translateX(10px)";
              setTimeout(() => row.remove(), 320);
            }
            showToast("Review deleted successfully.", "success");
          } else {
            showToast(data.message || "Delete failed.", "error");
          }
        })
        .catch(() => {
          closeModal("rvDeleteModal");
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Yes, Delete";
          showToast("Network error. Please try again.", "error");
        });
    }

    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest(".rv-expand-btn") as HTMLElement | null;
      if (!btn) return;
      const preview = btn.dataset.preview ?? "";
      const full = btn.dataset.full ?? "";
      const span = btn.previousElementSibling;
      if (!span) return;
      if (btn.textContent.trim() === "Read more") {
        span.textContent = full;
        btn.textContent = "Read less";
      } else {
        span.textContent = preview;
        btn.textContent = "Read more";
      }
    };
    document.addEventListener("click", onDocumentClick);

    const overlays = Array.from(document.querySelectorAll<HTMLElement>(".rv-modal-overlay"));
    overlays.forEach((overlay) => overlay.addEventListener("click", function (this: HTMLElement, e: MouseEvent) {
      if (e.target === this) closeModal(this.id);
    }));

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".rv-modal-overlay:not([hidden])").forEach((m) => closeModal(m.id));
      }
    };
    document.addEventListener("keydown", onKeydown);

    const filterSelects = Array.from(document.querySelectorAll<HTMLElement>(".js-filter-submit"));
    const onFilterChange = (e: Event) => {
      const el = e.currentTarget as HTMLElement & { form?: HTMLFormElement | null };
      el.form?.submit();
    };
    filterSelects.forEach((el) => el.addEventListener("change", onFilterChange));

    const viewButtons = Array.from(document.querySelectorAll<HTMLElement>(".js-view-review"));
    const onView = (e: Event) => openReviewModal(e.currentTarget as HTMLElement);
    viewButtons.forEach((btn) => btn.addEventListener("click", onView));

    const deleteButtons = Array.from(document.querySelectorAll<HTMLElement>(".js-delete-review"));
    const onDelete = (e: Event) => confirmDelete(e.currentTarget as HTMLElement);
    deleteButtons.forEach((btn) => btn.addEventListener("click", onDelete));

    const closeModalButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-close-modal]"));
    const onCloseModal = (e: Event) => closeModal((e.currentTarget as HTMLElement).getAttribute("data-close-modal") || "");
    closeModalButtons.forEach((btn) => btn.addEventListener("click", onCloseModal));

    const modalDeleteBtn = document.getElementById("rvModalDeleteBtn");
    modalDeleteBtn?.addEventListener("click", confirmDeleteFromModal);
    confirmBtn?.addEventListener("click", executeDelete);

    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeydown);
      filterSelects.forEach((el) => el.removeEventListener("change", onFilterChange));
      viewButtons.forEach((btn) => btn.removeEventListener("click", onView));
      deleteButtons.forEach((btn) => btn.removeEventListener("click", onDelete));
      closeModalButtons.forEach((btn) => btn.removeEventListener("click", onCloseModal));
      modalDeleteBtn?.removeEventListener("click", confirmDeleteFromModal);
      confirmBtn?.removeEventListener("click", executeDelete);
    };
  }, [csrfToken]);

  return null;
}
