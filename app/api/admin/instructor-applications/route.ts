import { handleApplicationsListPost } from "@/lib/api/admin/instructor-applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleApplicationsListPost(req);
}