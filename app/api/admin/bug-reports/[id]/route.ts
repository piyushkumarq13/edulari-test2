import { handleBugDetailPost } from "@/lib/api/admin/bug-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bugId = Number(id);
  if (!Number.isInteger(bugId) || bugId <= 0) {
    return handleBugDetailPost(req, 0);
  }
  return handleBugDetailPost(req, bugId);
}
