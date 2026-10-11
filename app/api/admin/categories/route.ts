import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeAdmin, csrfOk } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import {
  bulkDeleteCategories,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/db/admin/categories";

export const runtime = "nodejs";

/**
 * POST handler for public/admin/categories.php (create / update / delete / bulk_delete).
 *
 * The PHP form posted back to the page, which re-rendered an inline success/error alert. Under the
 * App Router the same three forms post here and the handler answers with a 303 Post/Redirect/Get
 * back to /admin/categories, carrying the message (or error) in the query string, which the page
 * then renders as the identical alert. This keeps refresh from resubmitting.
 */
const BASE = "/admin/categories";

function redirectBack(req: Request, params: Record<string, string> = {}): NextResponse {
  const url = new URL(BASE, req.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  const form = await req.formData();
  const token = form.get("csrf_token");
  if (!(await csrfOk(typeof token === "string" ? token : ""))) {
    return redirectBack(req, { error: "Invalid request token. Please refresh and try again." });
  }

  const action = String(form.get("action") ?? "");

  if (action === "create") {
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (name === "") return redirectBack(req, { error: "Category name is required." });

    const ok = await createCategory(name, description);
    if (!ok) return redirectBack(req, { error: "Failed to create category. Please try again." });

    await auditAdmin(user, "admin.category.create", { name }, req);
    revalidatePath("/categories");
    return redirectBack(req, { msg: `Category ${name} created successfully.` });
  }

  if (action === "update") {
    const categoryId = Number.parseInt(String(form.get("category_id") ?? "0"), 10) || 0;
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (name === "" || categoryId <= 0) {
      return redirectBack(req, { error: "Category name and a valid ID are required." });
    }

    await updateCategory(categoryId, name, description);
    await auditAdmin(user, "admin.category.update", { category_id: categoryId, name }, req);
    revalidatePath("/categories");
    return redirectBack(req, { msg: "Category updated successfully." });
  }

  if (action === "delete") {
    const categoryId = Number.parseInt(String(form.get("category_id") ?? "0"), 10) || 0;
    if (categoryId <= 0) return redirectBack(req, { error: "Invalid category ID." });

    const { courseCount } = await deleteCategory(categoryId);
    await auditAdmin(user, "admin.category.delete", { category_id: categoryId, course_count: courseCount }, req);
    revalidatePath("/categories");
    const note = courseCount > 0 ? ` ${courseCount} course(s) were unassigned.` : "";
    return redirectBack(req, { msg: `Category deleted successfully.${note}` });
  }

  if (action === "bulk_delete") {
    const ids = form
      .getAll("selected_ids[]")
      .map((v) => Number.parseInt(String(v), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (ids.length === 0) return redirectBack(req, { error: "No categories selected for deletion." });

    const count = await bulkDeleteCategories(ids);
    await auditAdmin(user, "admin.category.bulk_delete", { ids, deleted: count }, req);
    revalidatePath("/categories");
    return redirectBack(req, { msg: `${count} category/categories deleted successfully.` });
  }

  // Unknown action: the PHP silently fell through and re-rendered the page with no alert.
  return redirectBack(req);
}
