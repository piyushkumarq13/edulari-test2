import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import {
  getCourseContentForStudent,
  getLessonForStudent,
  getCourseDetail,
  type CurriculumLesson,
  type CurriculumSection,
  type FullLesson,
} from "@/lib/db/learning";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import { hasMetCertificateCriteria, getCertificateByEnrollment } from "@/lib/learning/certificates";
import { buildQuizReviewFromStored, getAttemptForReview } from "@/lib/learning/quiz";
import LearnClient from "./LearnClient";
import { initialsOf } from "./types";
import type { LearnProps } from "./types";
import "@/styles/css/student/learn.css";
import "@/styles/css/markdown-styles.css";
import "@/styles/css/course-ai.css";

export const metadata: Metadata = pageMetadata({
  title: "Learn — Edulari",
  description: "Continue your course: lessons, quizzes, assignments and your certificate.",
  path: "/student/learn",
  noindex: true,
});

/** learn.php: `intval($_GET['course'] ?? 0)`. */
function intParam(sp: Record<string, string | undefined>, key: string): number {
  const raw = sp[key];
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;

  const courseId = intParam(sp, "course");
  let lessonId = intParam(sp, "lesson");

  const courseData = await getCourseContentForStudent(courseId, user.id);
  if (!courseData) {
    const course = await getCourseDetail(courseId);
    redirect(course ? `/course/${course.slug}` : "/browse-courses");
  }

  const enrollment = courseData.enrollment;
  const sections: CurriculumSection[] = courseData.sections;

  const allLessons: CurriculumLesson[] = sections.flatMap((s) => s.lessons);
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => !!l.lesson_completed_at).length;

  // Resolve the current lesson exactly like learn.php: requested id, else the first
  // incomplete lesson, else the first lesson of the first section.
  let currentLesson: FullLesson | null = null;
  if (lessonId) currentLesson = await getLessonForStudent(lessonId, courseId, user.id);

  if (!currentLesson && sections.length > 0) {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (!lesson.lesson_completed_at) {
          currentLesson = await getLessonForStudent(Number(lesson.id), courseId, user.id);
          lessonId = Number(lesson.id);
          break;
        }
      }
      if (currentLesson) break;
    }
    if (!currentLesson && sections[0].lessons.length > 0) {
      const first = sections[0].lessons[0];
      currentLesson = await getLessonForStudent(Number(first.id), courseId, user.id);
      lessonId = Number(first.id);
    }
  }

  const courseInfo = await getCourseDetail(courseId);
  const [certificateEligible, existingCertificate, csrfToken] = await Promise.all([
    hasMetCertificateCriteria(user.id, courseId),
    getCertificateByEnrollment(user.id, courseId),
    readCsrfToken(),
  ]);

  // Post/redirect/get for the quiz: ?attempt=<id> rebuilds the result + review.
  const attemptId = intParam(sp, "attempt");
  let quizResult: LearnProps["quizResult"] = null;
  let quizReview: LearnProps["quizReview"] = null;

  if (attemptId > 0 && currentLesson) {
    const { attempt, answers } = await getAttemptForReview(attemptId, Number(enrollment.id), Number(currentLesson.id));
    if (attempt && currentLesson.questions) {
      quizResult = {
        score: Number(attempt.score),
        total: Number(attempt.total_points),
        percentage: Number(attempt.percentage),
        passed: attempt.passed ? 1 : 0,
      };
      quizReview = buildQuizReviewFromStored(currentLesson.questions, answers);
    }
  }

  const props: LearnProps = {
    user: {
      name: user.name,
      avatarUrl: getAvatarUrl(user.profile_image ?? "") || null,
      initials: initialsOf(user.name),
    },
    course: {
      id: Number(courseInfo?.id ?? courseId),
      slug: courseInfo?.slug ?? "",
      title: courseInfo?.title ?? "Course",
    },
    enrollment: {
      id: Number(enrollment.id),
      progressPercentage: Number(enrollment.progress_percentage ?? 0),
    },
    sections,
    totalLessons,
    completedLessons,
    currentLesson,
    currentLessonId: lessonId,
    quizResult,
    quizReview,
    flashAssignmentSubmitted: sp.msg === "assignment_submitted",
    courseCompleted: sp.completed === "1",
    certificateEligible,
    hasCertificate: existingCertificate !== null,
    csrfToken,
  };

  return <LearnClient {...props} />;
}