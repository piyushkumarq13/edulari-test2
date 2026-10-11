import { getReviewCourseSlug, deleteReview } from "@/lib/db/admin/reviews";
import { revalidatePublicCoursePages } from "@/lib/revalidate";

/**
 * The single write action POSTed by public/admin/reviews.php. The PHP answered
 * `success: (bool)$deleted`, so an unknown review id is reported as a failure.
 *
 * The PHP did no cache work; here a deleted review changes the course's rating on its public
 * page, so that page (and the listings embedding it) is revalidated.
 */
export async function deleteReviewAction(reviewId: number): Promise<{ success: boolean; message: string }> {
  const slug = await getReviewCourseSlug(reviewId);
  const deleted = await deleteReview(reviewId);
  if (deleted) {
    await revalidatePublicCoursePages(slug);
    return { success: true, message: "Review deleted." };
  }
  return { success: false, message: "Delete failed." };
}
