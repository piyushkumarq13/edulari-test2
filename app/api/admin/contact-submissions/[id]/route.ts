import { handleContactDetailPost } from "@/lib/api/admin/contact-submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return handleContactDetailPost(req, 0);
  }
  return handleContactDetailPost(req, submissionId);
}
