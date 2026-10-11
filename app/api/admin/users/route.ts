import { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { addUserAction, bulkActionAction } from "@/lib/api/admin/users";

export const runtime = "nodejs";

/** Port of the add-user and bulk-action branches in admin/users.php. */
export async function POST(req: Request) {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;

  const { fields, form } = await readFields(req);
  if (!(await csrfOk(fields.csrf_token))) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please try again." });
  }

  const action = fields.action ?? "";
  if (action === "add_user") {
    return NextResponse.json(await addUserAction(fields, auth.user, req));
  }
  if (action === "bulk_action") {
    return NextResponse.json(await bulkActionAction(form, auth.user, req));
  }
  return NextResponse.json({ ok: false, error: "Unknown action." });
}
