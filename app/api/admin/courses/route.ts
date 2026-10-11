import { adminCoursesPost } from "@/lib/api/admin/courses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return adminCoursesPost(req);
}
