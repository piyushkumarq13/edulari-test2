# DB Setup (Phase 2)

## 1. Create the Supabase project
- Create a new Supabase project.
- Choose region **ap-south-1** (Mumbai) to be near the Vercel `bom1` region.
- Open the project → **Project Settings → Database**.

## 2. Connection strings
- For queries/migrations from the server use the **Session Pooler** string:
  - Host: `aws-0-ap-south-1.pooler.supabase.com`
  - Port: `5432`
  - User: `postgres.<project-ref>`
  - Database: `postgres`
- Per the IPv4-only constraint, `DATABASE_URL` and `DIRECT_URL` are **identical** (both the Session Pooler string). The old AGENTS.md guidance to use port 6543 for `DATABASE_URL` is superseded by the IPv4-only Session-Pooler rule.
- Note: Supabase is used ONLY as Postgres. Do NOT use Supabase Auth/Storage/Realtime/client SDK — access only via the `postgres` npm package with `prepare: false`.

Set `.env.local`:
```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

## 3. Install deps (if not already)
```
npm install
```

## 4. Apply migrations
```
npm run db:migrate
```
- Applies pending files in `db/migrations/*.sql` in order, each in its own transaction, recording them in `schema_migrations`. Safe to re-run (idempotent).

## 5. Seed defaults
```
npm run seed
```
- Inserts default `app_settings` rows (`last_payment_reconcile_run`, `last_cleanup_run`). Idempotent.

## 6. Create the first admin
```
npm run create-admin
```
- Prompts for name, email, password; creates an `admin` user (`email_verified=true`, `is_active=true`, `profile_completed=true`, bcrypt cost matching the PHP site).

## 7. Smoke check
From the project root in `psql` or any client, run:
```sql
SELECT count(*) FROM schema_migrations;
SELECT setting_key FROM app_settings;
```
Or in Node: `DATABASE_URL` must be set and a query like `SELECT 1` should succeed.
