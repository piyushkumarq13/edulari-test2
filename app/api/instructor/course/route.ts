import { createCourseAction } from "@/lib/api/instructor/course-actions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return createCourseAction(req);
}