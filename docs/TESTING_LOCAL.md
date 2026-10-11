# Running and testing Edulari locally

Plain text. Written after the Phase 5 credentials pass so you can exercise the whole
site before Phase 6 starts.

## 1. One-time setup

```
cd "C:\Users\piyus\Desktop\htdocs (7)\Edulari"
npm install
npm run db:migrate      # applies any pending db/migrations/*.sql
npm run seed            # default app_settings rows
npm run seed:content    # 12 demo courses + 4 categories + a demo student
```

`seed:content` is idempotent (keyed on slug/email). To wipe and redo it:

```
npm run seed:content -- --reset
```

## 2. Start the site

```
npm run dev             # http://localhost:3000
```

or, closer to production:

```
npm run build && npm start
```

## 3. Logins

| Role | Email | Password |
|---|---|---|
| Admin | the address you used for `npm run create-admin` | the one you set |
| Student (demo) | `student@edulari.test` | `Edulari!Test2026` |

The demo student is already email-verified, so you can go straight into
`/browse-courses` -> add to cart -> `/checkout`.

## 4. What is verified working

Run this any time - it performs authenticated reads against each service and sends
nothing:

```
npm run check:integrations
```

Last run:

- SMTP `smtp.gmail.com:587` - authenticated
- Razorpay - **test mode**, authenticated, orders list readable, webhook secret present
- AI provider `openrouter` - one-token completion accepted
- Google + GitHub OAuth clients - configured
- Postgres - reachable, 48 public tables

Automated suites (all passing):

```
npm run typecheck
npm run lint
npm test                 # 11 files, 65 tests
npm run parity-check     # 19 PHP templates, 0 missing class/id
npm run verify-columns   # 250 column references against information_schema
npm run smoke            # migrations, RLS, grants, indexes
npm run build

npm start                # in one shell
npm run smoke:phase5     # 62 live checks against the running server
```

## 5. Known gap: Backblaze B2 (uploads / media)

**Not usable yet.** The bucket credentials copied from `private/config/b2_config.php`
authenticate successfully against Backblaze, but the configured **bucket no longer
exists in that account** (`b2_get_bucket` answers 404 for both the bucket id and the
bucket name).

Consequence: avatars, course thumbnails, instructor documents and the `/media`
proxy will fail. Everything else - browse, cart, checkout, enroll, receipts, email,
AI, OAuth - is unaffected, because `lib/storage/b2.ts` only builds its S3 client
lazily when a B2 operation is actually attempted.

To fix:

1. Log in at https://secure.backblazeb2.com
2. Create a bucket (note its name + id)
3. Create an Application Key scoped to that bucket
4. Update these four in `.env.local`:
   `B2_BUCKET_NAME`, `B2_BUCKET_ID`, `B2_KEY_ID`, `B2_APPLICATION_KEY`
5. Derive the endpoint from the bucket region:

```
npm run derive:b2
```

   This calls the Backblaze API with the new credentials and writes `B2_ENDPOINT`
   (`https://s3.<region>.backblazeb2.com`) and `B2_REGION`.

If the bucket is somehow found but still misbehaving:

```
node scripts/b2-diagnose.mjs
```

It prints which Backblaze endpoints the key is permitted to call, and nothing else.

## 6. OAuth redirect URIs must be re-registered

The port uses a different callback path than the old PHP site:

| Provider | Old PHP | Edulari (Next.js) |
|---|---|---|
| Google | `/auth/google/callback` | `/api/auth/oauth/google/callback` |
| GitHub | `/auth/github/callback` | `/api/auth/oauth/github/callback` |

The redirect URI is built from `NEXT_PUBLIC_SITE_URL`. To use Google/GitHub sign-in:

- Add the new callback URL alongside the old one in Google Cloud Console and in the
  GitHub OAuth app (both consoles accept multiple redirect URIs).
- Keep `NEXT_PUBLIC_SITE_URL` matching the host those URIs are registered for.
  It currently holds the production site, so OAuth works against production URLs. For
  pure localhost testing, change it to `http://localhost:3000` and register
  `http://localhost:3000/api/auth/oauth/google/callback` (Google allows
  `http://localhost` origins).

## 7. Payments

The copied Razorpay key is a **test** key and `RAZORPAY_LIVE=false` is pinned, so no
real money can move. Use `4111 1111 1111 1111` (any future expiry / CVV) or the UPI id
`success@razorpay`.

Full matrix - happy path, webhook delivery, duplicate/webhook races, amount tampering,
signature forgery, abandoned orders, role rules - is in `docs/TESTING_PAYMENTS.md`.

Webhooks need a public HTTPS URL, so for local webhook testing expose the port with a
tunnel (`ngrok http 3000`) and register
`https://<tunnel-host>/api/razorpay/webhook` in the Razorpay dashboard using the same
secret as `RAZORPAY_WEBHOOK_SECRET`. Without that, Layer 2 is simply skipped and
Layer 3 (reconciliation, also triggered on every request by `proxy.ts`) handles it.

## 8. Email

`npm run check:integrations` only does the SMTP AUTH handshake - it sends nothing.
To see a real message, register through `/register` or use `/forgot-password`; both
send to the address you type. Check the Gmail account behind `SMTP_USERNAME`, and the
spam folder (a Gmail app password is in use, so "send as" lands in that mailbox).

## 9. Re-running the credential copy

`scripts/migrate-secrets.mjs` is what populated `.env.local` from the PHP files. It is
safe to re-run: it never overwrites a key that already has a value, and it prints only
key names.

```
npm run migrate:secrets
```

`.env.local` is gitignored (`.gitignore` line `.env*`), so nothing here can be
committed by accident. Do not run `git add -f .env.local`.
