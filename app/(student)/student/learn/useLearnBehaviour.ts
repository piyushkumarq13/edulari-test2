"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Port of learn.php's inline <script> IIFE (lines 1348-1831), minus the parts that
 * live inside the content components (universal time tracking, quiz counter, assignment
 * draft + file UI).
 *
 * Keys and timings are unchanged:
 *   lp_sidebar_open, lp_dark_mode, lp_bookmarks_<courseId>, lp_draft_<lessonId>
 *   desktop breakpoint 1024 px, active-lesson scrollIntoView at 450 ms,
 *   topbar shadow after 4 px of scroll.
 */

export const LP_SIDEBAR_KEY = "lp_sidebar_open";
export const LP_DARK_KEY = "lp_dark_mode";
const DESKTOP_BREAKPOINT = 1024;

type Params = {
  courseId: number;
  lessonId: number;
  prevLessonId: number | null;
  nextLessonId: number | null;
};

export default function useLearnBehaviour({ courseId, lessonId, prevLessonId, nextLessonId }: Params) {
  const router = useRouter();

  useEffect(() => {
    const bookmarkKey = "lp_bookmarks_" + courseId;

    const layout = document.getElementById("lpLayout");
    const toggleBtn = document.getElementById("sidebarToggleBtn") as HTMLButtonElement | null;
    const closeBtn = document.getElementById("sidebarCloseBtn");
    const overlay = document.getElementById("lpOverlay");
    const openEmpty = document.getElementById("openSidebarBtn");
    const OPEN = "lp-layout--sidebar-open";

    function openSidebar(persist = true) {
      layout?.classList.add(OPEN);
      toggleBtn?.setAttribute("aria-expanded", "true");
      if (window.innerWidth < DESKTOP_BREAKPOINT) document.body.style.overflow = "hidden";
      if (persist) localStorage.setItem(LP_SIDEBAR_KEY, "1");
    }

    function closeSidebar(persist = true) {
      layout?.classList.remove(OPEN);
      toggleBtn?.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (persist) localStorage.setItem(LP_SIDEBAR_KEY, "0");
    }

    function toggleSidebar() {
      if (layout?.classList.contains(OPEN)) closeSidebar();
      else openSidebar();
    }

    const onToggle = () => toggleSidebar();
    const onClose = () => closeSidebar();
    const onOverlay = () => closeSidebar();
    const onOpenEmpty = () => openSidebar();
    toggleBtn?.addEventListener("click", onToggle);
    closeBtn?.addEventListener("click", onClose);
    overlay?.addEventListener("click", onOverlay);
    openEmpty?.addEventListener("click", onOpenEmpty);

    const savedSidebar = localStorage.getItem(LP_SIDEBAR_KEY);
    if (window.innerWidth >= DESKTOP_BREAKPOINT && savedSidebar !== "0") openSidebar(false);

    const onResize = () => {
      if (
        window.innerWidth >= DESKTOP_BREAKPOINT &&
        savedSidebar !== "0" &&
        !layout?.classList.contains(OPEN)
      ) {
        openSidebar(false);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });

    // ── 2. Section accordion ──────────────────────────────────────────────
    const toggles = Array.from(document.querySelectorAll<HTMLElement>(".lp-section__toggle"));
    const onToggleClick = (ev: Event) => {
      const btn = ev.currentTarget as HTMLElement;
      const section = btn.closest(".lp-section");
      if (!section) return;
      const expanded = section.classList.toggle("lp-section--open");
      btn.setAttribute("aria-expanded", String(expanded));
    };
    toggles.forEach((btn) => btn.addEventListener("click", onToggleClick));

    // ── 6. Topbar shadow on scroll ────────────────────────────────────────
    const topbar = document.getElementById("lpTopbar");
    const onScroll = () => {
      topbar?.classList.toggle("lp-topbar--scrolled", window.scrollY > 4);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── 7. Auto-scroll the active lesson into view (450 ms) ────────────────
    const activeLesson = document.querySelector(".lp-lesson--active");
    let autoScroll: ReturnType<typeof setTimeout> | null = null;
    if (activeLesson) {
      autoScroll = setTimeout(() => {
        activeLesson.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 450);
    }

    // ── 8. Dark mode ──────────────────────────────────────────────────────
    const darkToggle = document.getElementById("darkModeToggle");
    const applyDarkMode = (on: boolean) => {
      document.documentElement.classList.toggle("lp-dark", on);
      darkToggle?.setAttribute("aria-pressed", String(on));
    };
    applyDarkMode(localStorage.getItem(LP_DARK_KEY) === "1");

    const onDarkClick = () => {
      const isDark = document.documentElement.classList.toggle("lp-dark");
      localStorage.setItem(LP_DARK_KEY, isDark ? "1" : "0");
      darkToggle?.setAttribute("aria-pressed", String(isDark));
    };
    darkToggle?.addEventListener("click", onDarkClick);

    // ── 9. Curriculum search ──────────────────────────────────────────────
    const searchInput = document.getElementById("curriculumSearch") as HTMLInputElement | null;
    const searchClearBtn = document.getElementById("searchClearBtn") as HTMLButtonElement | null;
    const noResults = document.getElementById("searchNoResults");
    const curriculum = document.getElementById("lpCurriculum");

    function filterCurriculum(query: string) {
      const q = query.trim().toLowerCase();
      let visibleCount = 0;

      document.querySelectorAll<HTMLElement>(".lp-section").forEach((section) => {
        let sectionVisible = 0;
        section.querySelectorAll<HTMLElement>(".lp-lesson").forEach((lesson) => {
          const title = (lesson.dataset.lessonTitle ?? "").toLowerCase();
          const match = !q || title.includes(q);
          lesson.style.display = match ? "" : "none";
          if (match) sectionVisible++;
        });
        section.style.display = sectionVisible > 0 ? "" : "none";
        if (sectionVisible > 0 && q) {
          section.classList.add("lp-section--open");
          section.querySelector(".lp-section__toggle")?.setAttribute("aria-expanded", "true");
        }
        visibleCount += sectionVisible;
      });

      if (noResults) noResults.hidden = visibleCount > 0 || !q;
      if (curriculum) curriculum.hidden = visibleCount === 0 && !!q;
      if (searchClearBtn) searchClearBtn.hidden = !q;
    }

    const onSearchInput = () => {
      if (searchInput) filterCurriculum(searchInput.value);
    };
    const onSearchClear = () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      filterCurriculum("");
    };
    searchInput?.addEventListener("input", onSearchInput);
    searchClearBtn?.addEventListener("click", onSearchClear);

    // ── 10. Lesson bookmarks (localStorage) ───────────────────────────────
    type Bookmark = { id: number; title: string; type: string };
    const getBookmarks = (): Bookmark[] => {
      try {
        return JSON.parse(localStorage.getItem(bookmarkKey) || "[]");
      } catch {
        return [];
      }
    };
    const saveBookmarks = (arr: Bookmark[]) => localStorage.setItem(bookmarkKey, JSON.stringify(arr));
    const isBookmarked = (id: number) => getBookmarks().some((b) => b.id === id);

    const bookmarkSection = document.getElementById("lpBookmarksSection");
    const bookmarkList = document.getElementById("lpBookmarksList");

    function renderBookmarks() {
      const bms = getBookmarks();

      document.querySelectorAll<HTMLElement>(".lp-lesson__bookmark-btn").forEach((btn) => {
        const id = Number.parseInt(btn.dataset.lessonId ?? "0", 10);
        btn.classList.toggle("lp-lesson__bookmark-btn--active", isBookmarked(id));
        btn.setAttribute("aria-pressed", String(isBookmarked(id)));
      });

      if (!bookmarkSection || !bookmarkList) return;
      if (bms.length === 0) {
        bookmarkSection.hidden = true;
        return;
      }

      bookmarkSection.hidden = false;
      bookmarkList.replaceChildren(
        ...bms.map((b) => {
          const a = document.createElement("a");
          a.href = `/student/learn?course=${courseId}&lesson=${b.id}`;
          a.className = "lp-bookmark-item" + (lessonId === b.id ? " lp-bookmark-item--active" : "");
          const type = document.createElement("span");
          type.className = "lp-bookmark-item__type";
          type.textContent = b.type;
          const title = document.createElement("span");
          title.className = "lp-bookmark-item__title";
          title.textContent = b.title;
          a.append(type, title);
          return a;
        }),
      );
    }

    function toggleBookmark(btn: HTMLElement) {
      const id = Number.parseInt(btn.dataset.lessonId ?? "0", 10);
      const title = btn.dataset.lessonTitle ?? "";
      const type = btn.dataset.lessonType ?? "";
      let bms = getBookmarks();
      if (isBookmarked(id)) bms = bms.filter((b) => b.id !== id);
      else bms.push({ id, title, type });
      saveBookmarks(bms);
      renderBookmarks();
    }

    (window as unknown as { toggleBookmark?: (btn: HTMLElement) => void }).toggleBookmark = toggleBookmark;
    renderBookmarks();

    const onBookmarkClick = (ev: Event) => {
      const btn = (ev.target as HTMLElement | null)?.closest(".js-bookmark-btn") as HTMLElement | null;
      if (!btn) return;
      ev.preventDefault();
      toggleBookmark(btn);
    };
    document.addEventListener("click", onBookmarkClick);

    // ── 11. Alert dismiss ─────────────────────────────────────────────────
    const dismissers = Array.from(document.querySelectorAll<HTMLElement>(".lp-alert__dismiss"));
    const onDismiss = (ev: Event) => {
      (ev.currentTarget as HTMLElement).closest(".lp-alert")?.remove();
    };
    dismissers.forEach((btn) => btn.addEventListener("click", onDismiss));

    // ── 12. Shortcuts modal ───────────────────────────────────────────────
    const modal = document.getElementById("lpShortcutsModal");
    const modalBackdrop = document.getElementById("shortcutsModalBackdrop");
    const modalClose = document.getElementById("shortcutsModalClose");
    const shortcutsHelpBtn = document.getElementById("shortcutsHelpBtn");

    function openModal() {
      if (!modal) return;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      (modalClose as HTMLElement | null)?.focus();
    }
    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
      document.body.style.overflow = "";
    }

    shortcutsHelpBtn?.addEventListener("click", openModal);
    modalClose?.addEventListener("click", closeModal);
    modalBackdrop?.addEventListener("click", closeModal);

    // ── 13. Keyboard shortcuts ────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toUpperCase();
      if (tag && ["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        if (e.key === "Escape") {
          if (document.activeElement?.id === "curriculumSearch") {
            if (searchInput) {
              searchInput.value = "";
              searchInput.blur();
              filterCurriculum("");
            }
          }
          if (modal && !modal.hidden) closeModal();
        }
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          if (prevLessonId) router.push(`/student/learn?course=${courseId}&lesson=${prevLessonId}`);
          break;
        case "ArrowRight":
          if (nextLessonId) router.push(`/student/learn?course=${courseId}&lesson=${nextLessonId}`);
          break;
        case "b":
        case "B": {
          const activeBtn = document.querySelector<HTMLElement>(".lp-lesson--active .lp-lesson__bookmark-btn");
          if (activeBtn) toggleBookmark(activeBtn);
          break;
        }
        case "d":
        case "D":
          darkToggle?.dispatchEvent(new MouseEvent("click"));
          break;
        case "s":
        case "S":
          e.preventDefault();
          searchInput?.focus();
          break;
        case "?":
          if (modal?.hidden) openModal();
          else closeModal();
          break;
        case "Escape":
          if (modal && !modal.hidden) {
            closeModal();
            break;
          }
          if (layout?.classList.contains(OPEN) && window.innerWidth < DESKTOP_BREAKPOINT) closeSidebar();
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      toggleBtn?.removeEventListener("click", onToggle);
      closeBtn?.removeEventListener("click", onClose);
      overlay?.removeEventListener("click", onOverlay);
      openEmpty?.removeEventListener("click", onOpenEmpty);
      window.removeEventListener("resize", onResize);
      toggles.forEach((btn) => btn.removeEventListener("click", onToggleClick));
      window.removeEventListener("scroll", onScroll);
      if (autoScroll) clearTimeout(autoScroll);
      darkToggle?.removeEventListener("click", onDarkClick);
      searchInput?.removeEventListener("input", onSearchInput);
      searchClearBtn?.removeEventListener("click", onSearchClear);
      document.removeEventListener("click", onBookmarkClick);
      dismissers.forEach((btn) => btn.removeEventListener("click", onDismiss));
      shortcutsHelpBtn?.removeEventListener("click", openModal);
      modalClose?.removeEventListener("click", closeModal);
      modalBackdrop?.removeEventListener("click", closeModal);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [courseId, lessonId, prevLessonId, nextLessonId, router]);
}