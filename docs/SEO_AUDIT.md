# Edulari SEO audit

Phase 10 audit, run against a production build (`npm run build && npm start`) with
`npm run seo:audit` (`scripts/seo-audit.mjs`). Re-run after changing any page's metadata,
JSON-LD, `app/sitemap.ts`, `app/robots.ts` or the redirects in `next.config.ts`.

**Result: no failures.** Every public route has a unique title, a unique meta description,
a canonical URL, Open Graph and Twitter tags, and structured data matching the PHP template
it replaces. Every private route is `noindex`. All legacy URLs redirect to their clean
equivalent.

## Method

The script fetches each route from a running production build and parses the rendered HTML.
It is deliberately not a unit test: it checks what a crawler actually receives, including
the redirect status codes.

The expected number of JSON-LD blocks per page is **read from the old PHP template**, not
assumed. A page must not gain or lose structured data relative to the file it replaces
(AGENTS.md section 2), so the audit fails on a mismatch in either direction.

## Public routes

| Route | Status | Title | Description | Canonical | og:url | Twitter | JSON-LD |
|---|---|---|---|---|---|---|---|
| `/` | 200 | yes | 130 chars | yes | yes | yes | 2 — WebSite, Organization |
| `/about` | 200 | yes | 133 chars | yes | yes | yes | 2 — AboutPage, BreadcrumbList |
| `/browse-courses` | 200 | yes | 116 chars | yes | yes | yes | 1 — BreadcrumbList |
| `/categories` | 200 | yes | 146 chars | yes | yes | yes | 1 — BreadcrumbList |
| `/category/web-development` | 200 | yes | 72 chars | yes | yes | yes | 1 — BreadcrumbList |
| `/course/modern-react-typescript` | 200 | yes | 98 chars | yes | yes | yes | 2 — Course, BreadcrumbList |
| `/contact` | 200 | yes | 109 chars | yes | yes | yes | 1 — ContactPage |
| `/help-center` | 200 | yes | 108 chars | yes | yes | yes | 1 — FAQPage |
| `/report-bug` | 200 | yes | 80 chars | yes | yes | yes | 0 (none upstream; `noindex, nofollow`) |
| `/track-contact` | 200 | yes | 85 chars | yes | yes | yes | 0 (none upstream) |
| `/track-report` | 200 | yes | 75 chars | yes | yes | yes | 0 (none upstream) |
| `/verify-certificate` | 200 | yes | 93 chars | yes | yes | yes | 0 (none upstream) |

- Unique titles: **12/12**. Unique descriptions: **12/12**.
- `/instructor-profile/[slug]` is data-dependent and is only audited when `INSTRUCTOR_SLUG`
  is set in `scripts/ui-compare/.env.compare`. It is skipped, not failed, when it is unset.

## Private and authenticated routes

All of these return HTTP 200 with `robots: noindex`, so they can be linked internally
without appearing in search results:

`/login`, `/register`, `/forgot-password`, `/reset-password`, `/account-activation`,
`/verify-email`, `/password-reset-after-verify`, `/register-success`.

The student, instructor and admin areas are additionally blocked in `robots.txt`.

> Note: `login.php` / `register.php` shipped `index, follow` upstream. The port uses
> `noindex` because AGENTS.md section 11 requires it for auth flows. This is a deliberate
> deviation, recorded here and in `docs/PROGRESS.md`.

## Redirects

| Request | Result |
|---|---|
| `/index.php` | 308 -> `/` |
| `/public/index.php` | 308 -> `/` |
| `/public/index` | 308 -> `/` |
| `/about.php` | 308 -> `/about` |
| `/browse-courses.php` | 308 -> `/browse-courses` |
| `/categories.php` | 308 -> `/categories` |
| `/contact.php` | 308 -> `/contact` |
| `/login.php` | 308 -> `/login` |
| `/register.php` | 308 -> `/register` |
| `/cart.php` | 308 -> `/cart` |
| `/help-center.php` | 308 -> `/help-center` |
| `/public/about` | 308 -> `/about` |
| `?i=1` on any path | 308 -> the same path without the query |

`permanent: true` emits **308**, the correct modern equivalent of the PHP's `R=301`; 308 is
preserved by caches, which 301 is not. Next.js does not allow a 301 through `redirects()`.

**Ordering bug fixed in Phase 10.** `next.config.ts` originally listed the generic
`/:path*.php` -> `/:path*` rule **first**, so `/index.php` became `/index` and
`/public/index.php` became `/public/index` before the specific rules could run. The rules are
now ordered exactly like `.htaccess`: `?i=1`, then `/index`, then `/public/...`, and the
generic `.php` strip **last**.

## sitemap.xml

| Check | Result |
|---|---|
| Valid XML with a `<urlset>` | yes |
| `<loc>` entries | 24 |
| Includes published courses | yes |
| Includes categories | yes |
| All `loc` values are `https://` | yes |

Generated dynamically by `app/sitemap.ts` (the PHP wrote a file; a serverless app cannot).
It contains only published courses, so a course is added the moment an instructor publishes
it.

## robots.txt

| Check | Result |
|---|---|
| Contains a `Sitemap:` directive | yes — `https://edulari.zya.me/sitemap.xml` |
| Disallows `/admin` | yes |
| Disallows `/instructor` | yes |
| Disallows `/student` | yes |
| Disallows `/api` | yes |

## 404 page

An unknown path returns **404** (not a soft 404), so removed pages are reported correctly
to search engines.

## Headers

Verified from the running build on every response:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` |
| `Content-Security-Policy` | nonce-based script policy, see `docs/SECURITY_AUDIT.md` |

## Issues found and fixed in Phase 10

| # | Issue | Fix |
|---|-------|-----|
| 1 | 22 JSON-LD blocks hardcoded `https://edulari.example.com` while `<link rel="canonical">` correctly used `NEXT_PUBLIC_SITE_URL`. Breadcrumbs pointed Google at a domain that does not exist, which invalidates the structured data. | All JSON-LD now calls `siteUrl()` (`lib/format.ts`), so the two can never disagree. Affects `/`, `/about`, `/categories`, `/category/[slug]`, `/course/[slug]`, `/instructor-profile/[slug]`. |
| 2 | `/browse-courses` and `/contact` had **lost** their JSON-LD during the port, although the PHP emits a `BreadcrumbList` and a `ContactPage`. | Both restored verbatim. |
| 3 | Redirect rule ordering sent `/index.php` -> `/index` and `/public/index.php` -> `/public/index`. | Rules reordered to match `.htaccess`; the generic `.php` strip now runs last. |
| 4 | The `?i=1` strip only covered `/`, but the PHP rewrites `^(.*)$`. A visitor arriving at `/browse-courses?i=1` kept the parameter. | Rule now matches `/:path*`. |

## Core Web Vitals risks

| Risk | Finding | Status |
|---|---|---|
| **CLS from images** | The two logo `<img>` tags (navbar, footer) have no `width`/`height`. | **Accepted** — this matches `navbar.php` and `footer.php` exactly, and both the PHP and the port size the logo in CSS with fixed dimensions, so the box is reserved. Adding attributes would deviate from the template without changing layout. |
| **CLS from fonts** | Inter is loaded from Google Fonts with a `display=swap` swap. | The `FREEZE_CSS` used by `ui-compare` disables transitions during measurement; in production the fallback metric-compatible stack keeps the shift small. Worth watching in Search Console after launch. |
| **JS payload** | The homepage ships **~574 KB uncompressed** of first-party JS across 9 chunks (largest chunk 229 KB). gzipped on the wire. | **Open risk.** This is Next.js's React runtime plus the homepage's interactive components. It is within normal range for a React app but is the main lever if Lighthouse flags TBT. The largest single optimisation available would be reducing homepage client components (hero typing, testimonials carousel, scroll-reveal, back-to-top) — but each exists for PHP parity, so they were not removed. |
| **Render-blocking CSS** | `base.css` + `navbar.css` + the page stylesheet are all in the critical path, exactly as the PHP linked them. | **Accepted** for parity. Vercel serves them from the edge with long cache headers. |

## Manual follow-up

1. Submit `https://edulari.zya.me/sitemap.xml` in Google Search Console (the verification
   file `google85c125c508318c1a.html` is already in `public/`).
2. After launch, watch **Core Web Vitals** in Search Console for real-user CLS and INP, since
   this audit can only inspect the server response, not real device behaviour.
3. Re-run `npm run seo:audit` after any change to `next.config.ts` redirects or page metadata.