/**
 * Verbatim copy of the <style> block that course.php writes between lines 358 and 441,
 * i.e. after the <link> tags in <head> so it wins the cascade over course.css.
 *
 * This is the old site's own CSS, including its own `!important` on body - it is not a
 * Next.js workaround. Omitting it left the course page on the old sidebar offset
 * (body padding-left, .cp-page-wrap padding-top, .cp-alert margins, breadcrumb bar
 * padding and its two responsive breakpoints).
 *
 * Kept as a string constant rather than a .css file so the cascade position is
 * explicit and the content stays diffable against the PHP.
 */
const COURSE_PAGE_STYLES = `
        /* Override: make course page use navbar layout (like browse-courses) */

        /* Remove sidebar-based body offset; navbar is fixed 64px */
        body {
            padding-left: 0 !important;
            background: var(--bg-secondary, #f8f9fa);
        }

        /* Page wrapper: top padding accounts for fixed 64px navbar */
        .cp-page-wrap {
            padding-top: 64px;
        }

        /* Alerts should sit inside the padded area */
        .cp-alert {
            margin: 1.25rem 1.5rem 0;
        }

        /* Hero starts right below navbar */
        .cp-hero {
            margin-top: 0;
        }

        /* Inner content area (layout + sections) get horizontal padding */
        .cp-layout,
        .cp-alert {
            max-width: 1400px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            box-sizing: border-box;
        }

        /* Breadcrumb bar below navbar */
        .cp-breadcrumb-bar {
            background: #fff;
            border-bottom: 1px solid var(--border, #e5e7eb);
            padding: 0.6rem 1.5rem;
        }
        .cp-breadcrumb-bar-inner {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            gap: 0.375rem;
            min-width: 0;
            overflow: hidden;
        }
        .cp-bc-sep {
            width: 14px; height: 14px;
            flex-shrink: 0;
            color: var(--text-tertiary, #9ca3af);
        }
        .cp-bc-link {
            font-size: 0.875rem;
            color: var(--text-secondary, #6b7280);
            text-decoration: none;
            white-space: nowrap;
            flex-shrink: 0;
            transition: color .15s;
        }
        .cp-bc-link:hover { color: var(--primary, #6C63FF); }
        .cp-bc-current {
            font-size: 0.875rem;
            color: var(--text-primary, #111827);
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
        }

        /* Responsive adjustments */
        @media (max-width: 960px) {
            .cp-layout { padding-left: 1rem; padding-right: 1rem; }
            .cp-breadcrumb-bar { padding: 0.5rem 1rem; }
            .cp-alert { margin: 1rem 1rem 0; }
        }
        @media (max-width: 640px) {
            .cp-layout { padding-left: 0.75rem; padding-right: 0.75rem; }
            .cp-bc-current { display: none; }
            .cp-bc-sep:last-of-type { display: none; }
        }
`;

export default COURSE_PAGE_STYLES;
