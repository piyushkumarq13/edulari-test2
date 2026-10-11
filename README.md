# Edulari

Rebuild of the existing PHP e-learning platform (Edulari) as a Next.js + Node.js application.
This is a 1:1 migration of every page, route, endpoint, validation rule, email and security
feature of the PHP site.

## Rules

Read `AGENTS.md` at the start of every session, then `docs/PROGRESS.md`.
All work happens inside this folder only; the old PHP site is read-only.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (`strict: true`)
- Supabase Postgres via `postgres` (postgres.js) — **database only**, no Supabase Auth/Storage
- Custom auth (bcryptjs + custom sessions + Google/GitHub OAuth), no auth framework
- Nodemailer (SMTP), Backblaze B2 (S3 API), Razorpay, `zod`, `marked` + `sanitize-html`
- No UI frameworks. The PHP site's CSS is reused verbatim in `styles/css/`

## Setup

```bash
npm install
cp .env.example .env.local      # fill in the values; see docs/DEPLOY.md
npm run db:migrate              # applies db/migrations/*.sql in order
npm run create-admin            # interactive first admin
npm run seed:content            # optional demo courses/categories
npm run dev
```

Every required variable is documented in `docs/DEPLOY.md` section 3 and validated at
startup by `lib/config.ts` (it throws naming only the offending variable, never its value).

## Commands

### Build and verify

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (vitest) |

### Database

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply pending migrations using `DIRECT_URL` |
| `npm run create-admin` | Create an admin interactively |
| `npm run seed` / `seed:content` | Seed data |
| `npm run verify-columns` | Check every column referenced in SQL exists |

### Smoke tests

| Command | What it does |
|---|---|
| `npm run smoke` | Database checks: migrations, RLS, grants, core tables (needs the DB) |
| `npm run smoke:routes` | HTTP checks against a running build: public 200, protected redirects, cron 401, CSRF 403. Needs `npm start` |
| `npm run seo:audit` | Fetches every public route and verifies title/description/canonical/OG/Twitter/JSON-LD, sitemap, robots, redirects. Needs `npm start` |
| `npm run smoke:phase5` … `smoke:phase8` | Per-phase live checks |

### Parity and UI

| Command | What it does |
|---|---|
| `npm run parity-check` | Every class/id in each PHP template exists in the port (68 templates) |
| `npm run php-stylesheet-order` | Per-page stylesheet order vs the PHP `$extraCss` |
| `npm run php-chrome-map` | Which templates render navbar/footer |
| `npm run css-usage` | Which loaded sheets actually match the markup |
| `npm run css-conflicts` | Whether stylesheet order matters |
| `npm run ui-compare -- --site new` | Screenshot/metrics capture; add `--page <id>` or `--viewport <w>` |

### Integrations

| Command | What it does |
|---|---|
| `npm run check:integrations` | Verifies B2/Razorpay/SMTP/OAuth configuration |
| `npm run derive:b2` | Derives the B2 endpoint/region from the bucket |
| `npm run migrate:secrets` | Helper for moving secret values out of PHP into env |

## Documentation

| File | Contents |
|---|---|
| `AGENTS.md` | The migration rules |
| `docs/PROGRESS.md` | Phase status and decisions — **read this first** |
| `docs/feature-matrix.md` | Every PHP file mapped to its new location, with status |
| `docs/DEPLOY.md` | Deployment, environment variables, secret rotation, post-launch checklist |
| `docs/SECURITY_AUDIT.md` | Security audit with evidence per control |
| `docs/SEO_AUDIT.md` | SEO audit: metadata, JSON-LD, sitemap, robots, redirects |
| `docs/UI_PARITY_REPORT.md` | Latest UI parity run |
| `docs/UI_COMPARE.md` | How to run the UI comparison |
| `docs/DB_SETUP.md` | Database setup |
| `docs/TESTING_PAYMENTS.md` | How to test Razorpay end to end |
| `docs/analysis/**` | Per-phase specifications |
| `docs/schema/mysql_schema.txt` | The original MySQL schema, for reference |