"use client";

import { useEffect } from "react";

/**
 * The inline script at the bottom of public/admin/categories.php, ported 1:1.
 *
 * The markup is server-rendered and static, so (exactly like the PHP) this client component
 * binds listeners to it after mount without React owning those nodes. Everything the script
 * did is reproduced: slug previews, character counters, modal open/close, the delete confirm,
 * bulk selection and the sort selector.
 */
export default function CategoriesScripts() {
  useEffect(() => {
    function toSlug(str: string): string {
      return str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const backdrop = document.getElementById("overlayBackdrop");

    function openModal(id: string) {
      const m = document.getElementById(id);
      if (!m) return;
      m.classList.add("cat-modal-overlay--open");
      backdrop?.classList.add("cat-overlay-backdrop--visible");
      document.body.style.overflow = "hidden";
      const first = m.querySelector<HTMLElement>("input:not([type=hidden]), textarea");
      if (first) setTimeout(() => first.focus(), 80);
    }

    function closeModal(id: string) {
      const m = document.getElementById(id);
      if (!m) return;
      m.classList.remove("cat-modal-overlay--open");
      if (!document.querySelector(".cat-modal-overlay--open")) {
        backdrop?.classList.remove("cat-overlay-backdrop--visible");
        document.body.style.overflow = "";
      }
    }

    function closeAll() {
      document.querySelectorAll(".cat-modal-overlay--open").forEach((m) => {
        m.classList.remove("cat-modal-overlay--open");
      });
      backdrop?.classList.remove("cat-overlay-backdrop--visible");
      document.body.style.overflow = "";
    }

    function populateEditModal(btn: HTMLElement) {
      const idEl = document.getElementById("edit_category_id") as HTMLInputElement | null;
      const nameEl = document.getElementById("edit_name") as HTMLInputElement | null;
      const descEl = document.getElementById("edit_description") as HTMLTextAreaElement | null;
      const ds = btn.dataset;
      if (idEl) idEl.value = ds.id || "";
      if (nameEl) nameEl.value = ds.name || "";
      if (descEl) descEl.value = ds.description || "";
      updateCharCount("edit_description", "editDescCount");
      const slug = toSlug(ds.name || "");
      const preview = document.getElementById("editSlugPreview");
      if (preview) preview.textContent = slug ? "Slug: " + slug : "";
    }

    function updateCharCount(taId: string, cId: string) {
      const ta = document.getElementById(taId) as HTMLTextAreaElement | null;
      const ct = document.getElementById(cId);
      if (ta && ct) ct.textContent = String(ta.value.length);
    }

    const onOpenModal = (e: Event) => {
      const btn = (e.currentTarget as HTMLElement);
      const target = btn.dataset.modal || "";
      if (target === "editModal") populateEditModal(btn);
      openModal(target);
    };
    const openButtons = Array.from(document.querySelectorAll<HTMLElement>(".cat-open-modal"));
    openButtons.forEach((btn) => btn.addEventListener("click", onOpenModal));

    const onCloseModal = (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      closeModal(btn.dataset.closeModal || "");
    };
    const closeButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-close-modal]"));
    closeButtons.forEach((btn) => btn.addEventListener("click", onCloseModal));

    const onBackdrop = () => closeAll();
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    backdrop?.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);

    const addName = document.getElementById("add_name") as HTMLInputElement | null;
    const onAddName = () => {
      const s = toSlug(addName?.value || "");
      const preview = document.getElementById("addSlugPreview");
      if (preview) preview.textContent = s ? "Slug: " + s : "";
    };
    addName?.addEventListener("input", onAddName);

    const editName = document.getElementById("edit_name") as HTMLInputElement | null;
    const onEditName = () => {
      const s = toSlug(editName?.value || "");
      const preview = document.getElementById("editSlugPreview");
      if (preview) preview.textContent = s ? "Slug: " + s : "";
    };
    editName?.addEventListener("input", onEditName);

    const charTargets: Array<[string, string]> = [
      ["add_description", "addDescCount"],
      ["edit_description", "editDescCount"],
    ];
    const charHandlers: Array<[HTMLTextAreaElement, () => void]> = [];
    charTargets.forEach(([id, cid]) => {
      const ta = document.getElementById(id) as HTMLTextAreaElement | null;
      if (!ta) return;
      const handler = () => updateCharCount(id, cid);
      ta.addEventListener("input", handler);
      charHandlers.push([ta, handler]);
    });

    const onDeleteTrigger = (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      const id = btn.dataset.id || "";
      const name = btn.dataset.name || "";
      const count = parseInt(btn.dataset.count || "0", 10) || 0;

      const idEl = document.getElementById("delete_category_id") as HTMLInputElement | null;
      if (idEl) idEl.value = id;

      const msgEl = document.getElementById("deleteMessage");
      if (msgEl) {
        msgEl.textContent = 'Are you sure you want to delete "' + name + '"? This action cannot be undone.';
      }

      const warning = document.getElementById("deleteWarning");
      const warnTxt = document.getElementById("deleteWarningText");
      if (warning && warnTxt) {
        if (count > 0) {
          warning.style.display = "flex";
          warnTxt.textContent = count + " course(s) will be unassigned from this category.";
        } else {
          warning.style.display = "none";
        }
      }
      openModal("deleteModal");
    };
    const deleteTriggers = Array.from(document.querySelectorAll<HTMLElement>(".cat-delete-trigger"));
    deleteTriggers.forEach((btn) => btn.addEventListener("click", onDeleteTrigger));

    const selectAll = document.getElementById("selectAll") as HTMLInputElement | null;
    const bulkDeleteBtn = document.getElementById("bulkDeleteBtn") as HTMLButtonElement | null;
    const countSpan = document.getElementById("selectedCount");

    function updateBulkUI() {
      const n = document.querySelectorAll(".cat-row-check:checked").length;
      if (countSpan) countSpan.textContent = String(n);
      if (bulkDeleteBtn) bulkDeleteBtn.disabled = n === 0;
    }

    const rowChecks = Array.from(document.querySelectorAll<HTMLInputElement>(".cat-row-check"));
    const onSelectAll = () => {
      if (!selectAll) return;
      rowChecks.forEach((cb) => {
        cb.checked = selectAll.checked;
      });
      updateBulkUI();
    };
    selectAll?.addEventListener("change", onSelectAll);

    const rowHandlers: Array<[HTMLInputElement, () => void]> = [];
    rowChecks.forEach((cb) => {
      const handler = () => {
        if (!cb.checked && selectAll) selectAll.checked = false;
        updateBulkUI();
      };
      cb.addEventListener("change", handler);
      rowHandlers.push([cb, handler]);
    });

    const onBulkDelete = () => {
      const n = document.querySelectorAll(".cat-row-check:checked").length;
      if (n === 0) return;
      if (!confirm("Delete " + n + " selected categor" + (n === 1 ? "y" : "ies") + "? Courses will be unassigned.")) return;
      (document.getElementById("bulkForm") as HTMLFormElement | null)?.submit();
    };
    bulkDeleteBtn?.addEventListener("click", onBulkDelete);

    const sortSelect = document.getElementById("sortSelect") as HTMLSelectElement | null;
    const onSort = () => {
      if (!sortSelect) return;
      const parts = sortSelect.value.split("|");
      const key = parts[0];
      const dir = parts[1] || "ASC";
      const url = new URL(window.location.href);
      url.searchParams.set("sort", key);
      url.searchParams.set("dir", dir);
      window.location.href = url.toString();
    };
    sortSelect?.addEventListener("change", onSort);

    const alertCloses = Array.from(document.querySelectorAll<HTMLElement>(".cat-alert-close"));
    const onAlertClose = (e: Event) => {
      (e.currentTarget as HTMLElement).parentElement?.remove();
    };
    alertCloses.forEach((btn) => btn.addEventListener("click", onAlertClose));

    const alertEl = document.getElementById("catAlert");
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    if (alertEl) {
      dismissTimer = setTimeout(() => {
        alertEl.style.transition = "opacity 0.4s, transform 0.4s";
        alertEl.style.opacity = "0";
        alertEl.style.transform = "translateY(-8px)";
        removeTimer = setTimeout(() => {
          if (alertEl.parentNode) alertEl.parentNode.removeChild(alertEl);
        }, 420);
      }, 5000);
    }

    return () => {
      openButtons.forEach((btn) => btn.removeEventListener("click", onOpenModal));
      closeButtons.forEach((btn) => btn.removeEventListener("click", onCloseModal));
      backdrop?.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      addName?.removeEventListener("input", onAddName);
      editName?.removeEventListener("input", onEditName);
      charHandlers.forEach(([ta, handler]) => ta.removeEventListener("input", handler));
      deleteTriggers.forEach((btn) => btn.removeEventListener("click", onDeleteTrigger));
      selectAll?.removeEventListener("change", onSelectAll);
      rowHandlers.forEach(([cb, handler]) => cb.removeEventListener("change", handler));
      bulkDeleteBtn?.removeEventListener("click", onBulkDelete);
      sortSelect?.removeEventListener("change", onSort);
      alertCloses.forEach((btn) => btn.removeEventListener("click", onAlertClose));
      if (dismissTimer) clearTimeout(dismissTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, []);

  return null;
}
