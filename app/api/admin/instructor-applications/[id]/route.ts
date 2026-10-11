import { handleApplicationDetailPost } from "@/lib/api/admin/instructor-applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return handleApplicationDetailPost(req, 0);
  }
  return handleApplicationDetailPost(req, applicationId);
}