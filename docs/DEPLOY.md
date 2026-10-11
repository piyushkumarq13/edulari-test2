# Edulari deployment guide

How to deploy the Next.js port to Vercel with Supabase Postgres, Backblaze B2, Razorpay,
SMTP and Google/GitHub OAuth.

Read this end to end before the first production deploy. Section 9 (**secret rotation**) is
mandatory, not optional — the old PHP site had credentials hardcoded in
`private/secrets.php`, and some of those values must be assumed compromised.

---

## 1. Prerequisites

- Node.js 20+
- A Supabase project (Postgres only — this app does not use Supabase Auth or Storage)
- A Backblaze B2 bucket
- A Razorpay account (test mode is fine for a rehearsal)
- SMTP credentials
- Google and/or GitHub OAuth apps

## 2. Supabase

1. Create a project. Choose the region closest to your Vercel function region —
   **Mumbai (ap-south-1)** matches the `bom1` region in `vercel.json`.
2. Copy **both** connection strings from *Project Settings → Database → Connection string*:
   - `DATABASE_URL` — the **Session Pooler** (port 5432, user `postgres.<project-ref>`)
   - `DIRECT_URL` — used only by the migration script

   > In this IPv4-only environment both values are the same Session Pooler string. Do not
   > split them into transaction-pooler vs direct.

3. Run the migrations against `DIRECT_URL`:

   ```bash
   npm run db:migrate
   ```

   This applies every numbered file in `db/migrations/` in order and records them in
   `schema_migrations`. It is re-runnable: applied files are skipped.

4. Create the first administrator:

   ```bash
   npm run create-admin
   ```

   Interactive: name, email, password.

5. Confirm Row Level Security is on for every table and that `anon` / `authenticated` have
   no grants:

   ```bash
   npm run smoke
   ```

## 3. Environment variables

Copy `.env.example` to `.env.local` for local work, and add every value to the Vercel
project under **Settings → Environment Variables**. `.env.local` is git-ignored and must
never be committed.

### Required — the app refuses to boot without these

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Supabase Session Pooler connection string |
| `DIRECT_URL` | Supabase connection string used by `npm run db:migrate` |
| `DATA_ENCRYPTION_KEY` | AES-256-GCM key for instructor PAN/bank data. **32 bytes or base64 of 32 bytes.** Generate: `openssl rand -base64 32`. Changing it makes existing encrypted columns unreadable. |
| `SESSION_SECRET` | HMAC key signing the flash and pending-order cookies. Min 16 chars. Generate: `openssl rand -hex 32`. |
| `CSRF_SECRET` | Reserved for CSRF. Min 16 chars. Generate: `openssl rand -hex 32`. |
| `NEXT_PUBLIC_SITE_URL` | The public origin, e.g. `https://edulari.zya.me`. Used for canonical URLs, JSON-LD, sitemap, robots and email links. |
| `CRON_SECRET` | Bearer token that protects `/api/cron/*`. Generate: `openssl rand -hex 32`. |

`lib/config.ts` validates all of these with zod at startup and throws with the offending
**names** (never values) if something is missing or too short.

### Sessions

| Variable | Default | Notes |
|---|---|---|
| `SESSION_COOKIE_NAME` | `edulari_session` | |
| `SESSION_LIFETIME` | `86400` | Seconds (24 h) |

### Email (SMTP)

| Variable | Notes |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Credentials |
| `SMTP_SECURE` | `true` for port 465 |
| `SMTP_AUTH` | `true` unless the relay rejects auth |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Envelope sender; must be a sender the relay allows |
| `EMAIL_DRY_RUN` | Set `true` to log instead of sending. **Must be `false` in production.** |

### Payments (Razorpay)

| Variable | Notes |
|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | From Razorpay Dashboard → Account & Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Set when you create the webhook (section 6) |
| `RAZORPAY_LIVE` | `false` for test mode, `true` for live keys |

### Storage (Backblaze B2)

| Variable | Notes |
|---|---|
| `B2_ENDPOINT` | e.g. `https://s3.us-west-002.backblazeb2.com` |
| `B2_REGION` | e.g. `us-west-002` |
| `B2_BUCKET_NAME` | Bucket holding media |
| `B2_BUCKET_ID` | Optional |
| `B2_KEY_ID`, `B2_APPLICATION_KEY` | B2 → Buckets → Account → Application Keys |

See section 7 for bucket CORS and privacy.

### OAuth

| Variable | Notes |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | See section 5 |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | See section 5 |

### AI providers (course AI chat + competency questions)

| Variable | Notes |
|---|---|
| `ACTIVE_AI_PROVIDER` | `groq`, `openrouter` or `nvidia_kimi` |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_ENDPOINT` | Course chat uses Groq |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_ENDPOINT`, `OPENROUTER_SITE_NAME` | |
| `NVIDIA_KIMI_API_KEY`, `NVIDIA_KIMI_MODEL`, `NVIDIA_KIMI_ENDPOINT` | |
| `AI_REQUEST_TIMEOUT`, `AI_CONNECT_TIMEOUT`, `AI_MAX_EXEC_TIME` | Seconds |

Only the key for the **active** provider is required at runtime, but set all three keys so
you can switch providers without a redeploy.

### Site settings

`SITE_NAME`, `ADMIN_EMAIL`, `CURRENCY_CODE`, `CURRENCY_SYMBOL`, `APP_TIMEZONE`
(default `Asia/Kolkata`).

## 4. Vercel project

1. `npm i -g vercel` then `vercel`, or import the repository at
   **vercel.com/new**.
2. **Framework preset:** Next.js. **Build command:** `npm run build`. **Output:** default.
3. **Region:** Mumbai (`bom1`). This is set in `vercel.json`; keep it consistent with your
   Supabase region to minimise round-trip latency for Indian users.
4. Add every environment variable from section 3 to **Production**, **Preview** and
   **Development** as appropriate.
5. Attach the custom domain under **Settings → Domains**. Vercel provisions TLS
   automatically and redirects HTTP to HTTPS, which covers the force-HTTPS rule the old
   `.htaccess` had.
6. Deploy.

## 5. OAuth redirect URIs

Register these exact URLs with each provider (they must match, including the trailing
nothing). Replace the origin with your production domain.

**Google** — Google Cloud Console → APIs & Services → Credentials → your OAuth client:

- Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/oauth/google/callback`
- Authorized JavaScript origin: `https://YOUR_DOMAIN`

**GitHub** — Settings → Developer settings → OAuth Apps → New OAuth App:

- Homepage URL: `https://YOUR_DOMAIN`
- Authorization callback URL: `https://YOUR_DOMAIN/api/auth/oauth/github/callback`

The outbound start URL is `https://YOUR_DOMAIN/api/auth/oauth/google` (and `/github`).

## 6. Razorpay webhook

Razorpay Dashboard → Settings → Webhooks → Add new webhook:

| Field | Value |
|---|---|
| URL | `https://YOUR_DOMAIN/api/razorpay/webhook` |
| Secret | A strong random string — set the same value as `RAZORPAY_WEBHOOK_SECRET` |
| Active events | `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`, `order.paid` |

The handler reads the **raw** request body and verifies `X-Razorpay-Signature` with
HMAC-SHA256 and a timing-safe compare before parsing, so the secret is mandatory.

Verify with `curl`:

```bash
curl -X POST https://YOUR_DOMAIN/api/razorpay/webhook \
  -H "X-Razorpay-Signature: test" -d '{}'
# -> 400/401 (signature rejected), never 200
```

## 7. Backblaze B2 bucket

### Privacy

- **Private documents** (instructor government ID, marksheets, assignment attachments) must
  live in a **private** bucket. They are only served through `/api/media`, which checks the
  session and the ownership/role rules on every request. Disable public sharing for this
  bucket.
- **Public assets** (avatars, course thumbnails) may be public, or private and served
  through the same proxy. Keeping them private behind `/api/media` preserves the PHP URL
  scheme, which is what the cached URLs in the database expect.

### CORS for presigned uploads

Large uploads use a presigned `PUT` straight to B2, so the bucket needs a CORS rule that
allows your origin:

```json
[
  {
    "AllowedOrigins": ["https://YOUR_DOMAIN"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Apply it in B2 → Bucket → CORS Policies. Replace `YOUR_DOMAIN` and add
`http://localhost:3000` only while developing.

After a presigned upload the server re-reads the object (HEAD for size, ranged GET for magic
bytes) and **deletes it** if the content is not what was expected, so a bad upload never
reaches the database.

## 8. SMTP

Use a transactional provider (SES, SendGrid, Mailgun, Brevo…). Confirm:

- `SMTP_FROM_EMAIL` is a verified sender/domain on that account.
- SPF and DKIM DNS records are published.
- `EMAIL_DRY_RUN` is `false`.

Test delivery from **Admin → Settings → Test SMTP** after deploy; the result is shown in the
page and written to `security_events`.

## 9. Secret rotation — REQUIRED before go-live

The old site kept live credentials in `private/secrets.php` and `private/config.php`. Those
files were on the deployed web server, so **treat every one of those values as public**.
Rotate all of them. Nothing in this repo ever copied them, but that does not undo the
exposure of the PHP site.

Rotate, in this order:

| # | Secret | Where to rotate |
|---|---|---|
| 1 | Database password | Supabase → Settings → Database → reset password. Update `DATABASE_URL` and `DIRECT_URL` in Vercel. |
| 2 | SMTP password | Your mail provider → new app password. Update `SMTP_PASSWORD`. |
| 3 | Razorpay key secret | Razorpay → Settings → regenerate key secret. Update `RAZORPAY_KEY_SECRET`. Re-verify the webhook still validates (section 6). |
| 4 | Razorpay webhook secret | Razorpay → edit the webhook, set a new secret. Update `RAZORPAY_WEBHOOK_SECRET`. |
| 5 | Google OAuth client secret | Google Cloud Console → recreate the client secret. Update `GOOGLE_CLIENT_SECRET`. |
| 6 | GitHub OAuth client secret | GitHub → regenerate client secret. Update `GITHUB_CLIENT_SECRET`. |
| 7 | B2 application key | B2 → Account → Application Keys → delete the old key, create a new one. Update `B2_APPLICATION_KEY`. |
| 8 | AI provider keys (Groq, OpenRouter, NVIDIA) | Each provider's dashboard → revoke and reissue. |
| 9 | `CRON_SECRET` | Generate a new value and update Vercel. |
| 10 | `SESSION_SECRET` | Generate a new value. This invalidates outstanding flash/pending-order cookies (safe). |
| 11 | `DATA_ENCRYPTION_KEY` | **Only if** you are not carrying over encrypted instructor rows. If you are migrating that data, re-encrypt it with the new key instead of replacing it, or the PAN/bank columns become unreadable. |

Also delete the old PHP site's `private/secrets.php` and `private/config.php` from the
server once the new site is live, and make sure no backup of them is reachable.

## 10. Google Search Console

1. The verification file is already in `public/` (`google85c125c508318c1a.html`). Visit
   `https://YOUR_DOMAIN/google85c125c508318c1a.html` — it should return the verification
   token.
2. Add the property in Search Console and verify with that file.
3. Submit `https://YOUR_DOMAIN/sitemap.xml`.

## 11. PWA

`app/manifest.ts` is served at `/manifest.webmanifest` and the icons come from
`public/assets/images/favicon/`, copied from the old site. The old site shipped no service
worker, and none was invented, so "Add to Home Screen" works via the manifest alone. Test
on a real device — the manifest alone will not give offline support.

## 12. Rollback

- **Vercel keeps every deployment.** Settings → Deployments → ⋯ → **Promote to Production**
  rolls back instantly, and instant rollback also works from the CLI (`vercel rollback`).
- Because migrations are append-only and re-runnable, rolling the code back is safe; the
  schema is a superset. Do not delete tables during a rollback.
- Keep the old PHP site running (read-only) until the new site has been verified in
  production, so there is a fallback.

## 13. Post-launch checklist

- [ ] Every environment variable from section 3 is set in Vercel **Production**.
- [ ] `npm run build` succeeds locally.
- [ ] `npm run smoke` passes (database: migrations, RLS, grants).
- [ ] `npm run smoke:routes` passes against the production URL.
- [ ] `npm run seo:audit` passes against the production URL.
- [ ] All 11 secrets in section 9 rotated.
- [ ] OAuth login works with both providers.
- [ ] A test payment completes end to end and the webhook validates.
- [ ] An instructor can register, upload documents, and an admin can approve them, and the
      document is readable only by the admin.
- [ ] Email delivery confirmed from Admin → Settings → Test SMTP.
- [ ] Sitemap submitted to Search Console.
- [ ] `robots.txt` reachable and disallowing `/admin`, `/student`, `/instructor`, `/api`.
- [ ] Maintenance mode toggled from Admin → Settings and verified to return 503 to a
      non-admin and to stay open for an admin.
- [ ] A cron route responds 401 without the secret.
- [ ] Old PHP site set to read-only / decommissioned.

## 14. Maintenance cadence

| Job | Schedule (UTC) | Route |
|---|---|---|
| Payment reconciliation | every 5 minutes | `/api/cron/reconcile-payments` |
| Token cleanup | 03:00 daily | `/api/cron/token-cleanup` |
| Maintenance auto-disable | 03:30 daily | `/api/cron/maintenance` |
| Instructor document purge | 04:00 daily | `/api/cron/instructor-maintenance` |

> **Vercel Hobby plan limit:** Hobby allows **one cron invocation per day**, so the
> `*/5 * * * *` payment reconciliation schedule will not run as written on a Hobby account.
> Payment reconciliation is also triggered lazily from `proxy.ts` on ordinary requests
> (the "lazy cron" pattern ported from `payment_reconciliation.php`), so enrolment recovery
> still works without the schedule. To get the true 5-minute schedule, upgrade to a Pro
> account, or keep the lazy trigger as the primary mechanism.
>
> Vercel also sends cron requests with `Authorization: Bearer $CRON_SECRET` automatically
> when the variable is set, which is exactly what the routes verify.