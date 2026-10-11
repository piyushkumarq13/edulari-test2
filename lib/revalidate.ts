import { revalidatePath } from "next/cache";

/**
 * Every instructor write that changes what the public site shows funnels through here.
 * The PHP had no cache layer; in Next.js the course page is ISR, so publishing, editing,
 * deleting or re-categorising a course must invalidate the course page plus the three
 * listings that embed it (home, browse and the category page) or visitors keep seeing the
 * stale price, title or thumbnail.
 */
export async function revalidatePublicCoursePages(slug?: string | null): Promise<void> {
  if (slug) revalidatePath(`/course/${slug}`);
  revalidatePath("/browse-courses");
  revalidatePath("/categories");
  revalidatePath("/");
}

/** A profile edit changes the public instructor page and every card that shows the avatar. */
export async function revalidateInstructorProfile(instructorId: number): Promise<void> {
  revalidatePath(`/instructor-profile/${instructorId}`);
  revalidatePath("/browse-courses");
  revalidatePath("/");
}