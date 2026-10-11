import { sql, withTransaction } from "./client";

export type Enrollment = { id: number; progress_percentage: number; enrolled_at: Date; completed_at: Date | null };

export async function isEnrolled(studentId: number, courseId: number): Promise<Enrollment | false> {
  const rows = await sql<Enrollment[]>`
    SELECT id, progress_percentage, enrolled_at, completed_at
    FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId}
  `;
  return rows.length ? rows[0] : false;
}

export async function enrollStudent(studentId: number, courseId: number, isInstructor: boolean) {
  if (isInstructor) return { success: false as const, message: "Instructors cannot enroll in courses." };
  if (await isEnrolled(studentId, courseId)) {
    return { success: false as const, message: "Already enrolled in this course" };
  }
  const rows = await sql<{ id: number }[]>`
    INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
    VALUES (${courseId}, ${studentId}, now(), 0) RETURNING id
  `;
  if (rows.length) return { success: true as const, enrollment_id: rows[0].id };
  return { success: false as const, message: "Enrollment failed" };
}

export async function unenrollStudent(studentId: number, courseId: number) {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId}
  `;
  if (!rows.length) return { success: false as const, message: "Enrollment not found." };

  const enrollmentId = rows[0].id;
  try {
    await withTransaction(async (t) => {
      await t`DELETE FROM lesson_progress WHERE enrollment_id = ${enrollmentId}`;
      await t`DELETE FROM quiz_attempts WHERE enrollment_id = ${enrollmentId}`;
      await t`DELETE FROM assignment_submissions WHERE enrollment_id = ${enrollmentId}`;
      await t`DELETE FROM enrollments WHERE id = ${enrollmentId}`;
    });
    return { success: true as const };
  } catch (err) {
    console.error("Unenroll error:", err instanceof Error ? err.message : err);
    return { success: false as const, message: "Unenroll failed. Please try again." };
  }
}

export async function isInWishlist(studentId: number, courseId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`SELECT id FROM wishlists WHERE student_id = ${studentId} AND course_id = ${courseId}`;
  return rows.length > 0;
}

export async function addToWishlist(studentId: number, courseId: number, isInstructor: boolean): Promise<boolean> {
  if (isInstructor) return false;
  if (await isInWishlist(studentId, courseId)) return true;
  await sql`INSERT INTO wishlists (student_id, course_id) VALUES (${studentId}, ${courseId})`;
  return true;
}

export async function removeFromWishlist(studentId: number, courseId: number) {
  await sql`DELETE FROM wishlists WHERE student_id = ${studentId} AND course_id = ${courseId}`;
  return true;
}

export async function addToCart(studentId: number, courseId: number, isInstructor: boolean): Promise<boolean> {
  if (isInstructor) return false;
  const existing = await sql<{ id: number }[]>`SELECT id FROM cart WHERE student_id = ${studentId} AND course_id = ${courseId}`;
  if (existing.length) return true;
  if (await isEnrolled(studentId, courseId)) return false;
  await sql`INSERT INTO cart (student_id, course_id) VALUES (${studentId}, ${courseId})`;
  return true;
}

export async function removeFromCart(studentId: number, courseId: number) {
  await sql`DELETE FROM cart WHERE student_id = ${studentId} AND course_id = ${courseId}`;
  return true;
}

export async function clearCart(studentId: number) {
  await sql`DELETE FROM cart WHERE student_id = ${studentId}`;
  return true;
}

/** Port of the cart.php "Move to Wishlist" action (addToWishlist + removeFromCart). */
export async function moveToWishlist(studentId: number, courseId: number): Promise<boolean> {
  await withTransaction(async (t) => {
    await t`INSERT INTO wishlists (student_id, course_id) VALUES (${studentId}, ${courseId}) ON CONFLICT DO NOTHING`;
    await t`DELETE FROM cart WHERE student_id = ${studentId} AND course_id = ${courseId}`;
  });
  return true;
}

/**
 * Port of the wishlist.php "Add to Cart" action.
 *
 * Free courses are enrolled straight away (no payment step); paid courses go to the
 * cart. Either way the course leaves the wishlist. Already-enrolled courses are
 * reported so the caller can show the PHP's "You're already enrolled" flash.
 */
export async function wishlistAddToCart(
  studentId: number,
  courseId: number,
): Promise<{ success: boolean; enrolled: boolean; already_enrolled: boolean; not_found: boolean }> {
  const priceRows = await sql<{ price: number }[]>`SELECT price FROM courses WHERE id = ${courseId}`;
  if (!priceRows.length) return { success: false, enrolled: false, already_enrolled: false, not_found: true };

  const isFree = Number(priceRows[0].price) === 0;

  if (isFree) {
    if (await isEnrolled(studentId, courseId)) {
      return { success: true, enrolled: false, already_enrolled: true, not_found: false };
    }
    await enrollStudent(studentId, courseId, false);
    await removeFromWishlist(studentId, courseId);
    return { success: true, enrolled: true, already_enrolled: false, not_found: false };
  }

  await addToCart(studentId, courseId, false);
  await removeFromWishlist(studentId, courseId);
  return { success: true, enrolled: false, already_enrolled: false, not_found: false };
}

/**
 * Port of the wishlist.php "Move All to Cart" action: free items are enrolled,
 * paid items are added to the cart, already-enrolled items are skipped and counted
 * nowhere.
 */
export async function moveAllToCart(studentId: number): Promise<{ moved: number; enrolled: number; toCart: number }> {
  const rows = await sql<{ course_id: number; price: number }[]>`
    SELECT w.course_id, c.price
    FROM wishlists w
    JOIN courses c ON c.id = w.course_id
    WHERE w.student_id = ${studentId}
  `;

  let enrolled = 0;
  let toCart = 0;

  for (const row of rows) {
    if (await isEnrolled(studentId, row.course_id)) continue;

    if (Number(row.price) === 0) {
      await enrollStudent(studentId, row.course_id, false);
      enrolled++;
    } else {
      await addToCart(studentId, row.course_id, false);
      toCart++;
    }
    await removeFromWishlist(studentId, row.course_id);
  }

  return { moved: enrolled + toCart, enrolled, toCart };
}
