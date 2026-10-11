import { NextResponse } from "next/server";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { sql } from "@/lib/db/client";
import { logSecurity } from "@/lib/security/events";

export const dynamic = "force-dynamic";

/** Strip anything that is not a plain log token, exactly as the PHP did. */
function cleanType(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "unknown";
}

/**
 * Log an anti-cheat violation. Mirrors the log_violation branch of /test/index.php: the
 * PHP wrote to php_errors.log; the port records the same facts in security_events.
 */
export async function POST(request: Request) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const fd = await request.formData().catch(() => null);
  if (!fd) return NextResponse.json({ ok: false, error: "invalid_request" });

  const token = String(fd.get("token") ?? "").trim();
  const csrf = String(fd.get("csrf_token") ?? "");
  if (!verifyCsrfToken(await readCsrfToken(), csrf)) {
    return NextResponse.json({ ok: false, error: "csrf" });
  }

  const type = cleanType(String(fd.get("violation_type") ?? ""));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

  let userId = 0;
  if (token) {
    const rows = await sql<{ user_id: number }[]>`
      SELECT user_id FROM test_tokens WHERE token = ${token}`;
    userId = Number(rows[0]?.user_id ?? 0);
  }

  void logSecurity("TEST_VIOLATION", { tokenPrefix: token.slice(0, 8), type, ip, userId });
  return NextResponse.json({ ok: true });
}
