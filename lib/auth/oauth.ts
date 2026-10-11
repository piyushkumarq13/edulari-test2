import { sql } from "@/lib/db/client";

export type OAuthProfile = { provider: "google" | "github"; oauthId: string; email: string; name: string; avatarUrl?: string };

export function buildAuthUrl(provider: "google" | "github", redirectUri: string, state: string): string {
  const base = provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize";
  const clientId = provider === "google" ? process.env.GOOGLE_OAUTH_CLIENT_ID : process.env.GITHUB_OAUTH_CLIENT_ID;
  const scope = provider === "google" ? "openid email profile" : "read:user user:email";
  const params = new URLSearchParams({ client_id: clientId ?? "", redirect_uri: redirectUri, response_type: "code", scope, state });
  return `${base}?${params.toString()}`;
}

export async function exchangeCode(provider: "google" | "github", code: string, redirectUri: string): Promise<{ access_token: string } | null> {
  const id = provider === "google" ? process.env.GOOGLE_OAUTH_CLIENT_ID : process.env.GITHUB_OAUTH_CLIENT_ID;
  const secret = provider === "google" ? process.env.GOOGLE_OAUTH_CLIENT_SECRET : process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const tokenUrl = provider === "google" ? "https://oauth2.googleapis.com/token" : "https://github.com/login/oauth/access_token";
  const body = new URLSearchParams({ code, client_id: id ?? "", client_secret: secret ?? "", redirect_uri: redirectUri, grant_type: "authorization_code" });
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return { access_token: json.access_token };
}

export async function fetchProfile(provider: "google" | "github", accessToken: string): Promise<OAuthProfile | null> {
  if (provider === "google") {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return { provider, oauthId: String(u.id), email: String(u.email), name: String(u.name ?? ""), avatarUrl: u.picture };
  }
  const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "edulari" } });
  if (!r.ok) return null;
  const u = await r.json();
  let email = u.email;
  if (!email) {
    const er = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "edulari" } });
    if (er.ok) {
      const emails = await er.json();
      const primary = (emails as Array<{ primary: boolean; email: string }>).find((e) => e.primary) ?? (emails as Array<{ primary: boolean; email: string }>)[0];
      email = primary?.email ?? null;
    }
  }
  if (!email) return null;
  return { provider, oauthId: String(u.id), email, name: String(u.name ?? u.login ?? ""), avatarUrl: u.avatar_url };
}

export async function linkOrCreate(profile: OAuthProfile): Promise<{ id: number; email: string; role: string } | null> {
  // 1) Match by oauth provider+id.
  const byOauth = await sql<{ id: number; email: string; role: string }[]>`
    SELECT id, email, role FROM users WHERE oauth_provider = ${profile.provider} AND oauth_id = ${profile.oauthId}
  `;
  if (byOauth.length > 0) return byOauth[0];
  // 2) Match by email → link oauth to existing account and mark verified.
  const byEmail = await sql<{ id: number; role: string }[]>`SELECT id, role FROM users WHERE email = ${profile.email}`;
  if (byEmail.length > 0) {
    await sql`UPDATE users SET oauth_provider = ${profile.provider}, oauth_id = ${profile.oauthId}, avatar_url = ${profile.avatarUrl ?? null}, email_verified = true WHERE id = ${byEmail[0].id}`;
    return { id: byEmail[0].id, email: profile.email, role: byEmail[0].role };
  }
  // 3) Create new student account.
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, oauth_provider, oauth_id, avatar_url, role, email_verified, is_active, profile_completed, registration_date)
    VALUES (${profile.name}, ${profile.email}, ${profile.provider}, ${profile.oauthId}, ${profile.avatarUrl ?? null}, 'student', true, true, false, now())
    RETURNING id
  `;
  return { id: inserted[0].id, email: profile.email, role: "student" };
}
