import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import {
  badgeClass,
  badgeLabel,
  computeCourseGrade,
  fillClassFor,
  getEnrollmentsWithCourse,
  getGradableLessons,
  getQuizAttemptHistory,
  groupAttemptsByLesson,
  round1,
  summarizeGrades,
  type CourseGrade,
} from "@/lib/learning/grades";
import { formatDayMonthYear } from "@/lib/format";
import GradesClient, { type CourseGradePanel } from "./GradesClient";
import "@/styles/css/student/grades.css";

export const metadata: Metadata = pageMetadata({
  title: "My Grades — Edulari",
  description: "Track your quiz scores, assignment results and overall academic performance.",
  path: "/student/grades",
  noindex: true,
});

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;

  const enrollments = await getEnrollmentsWithCourse(user.id);

  const panels: CourseGradePanel[] = [];
  const grades: CourseGrade[] = [];

  for (const enr of enrollments) {
    const eid = Number(enr.enrollment_id);
    const cid = Number(enr.course_id);

    const [lessons, attempts] = await Promise.all([
      getGradableLessons(eid, cid),
      getQuizAttemptHistory(eid),
    ]);
    const attemptsByLesson = groupAttemptsByLesson(attempts);
    const passingPercentage = Number(enr.passing_percentage ?? 70);
    const grade = computeCourseGrade(lessons, passingPercentage);
    grades.push(grade);

    panels.push({
      enrollmentId: eid,
      courseId: cid,
      courseTitle: enr.course_title,
      thumbnail: enr.thumbnail,
      instructorName: enr.instructor_name,
      categoryName: enr.category_name,
      progressPercentage: Number(enr.progress_percentage ?? 0),
      passingPercentage,
      enrolledAtLabel: formatDayMonthYear(enr.enrolled_at),
      grade,
      lessons: lessons.map((l) => {
        const isQuiz = l.content_type === "quiz";
        const isAssign = l.content_type === "assignment";
        let scoreText = "—";
        let scoreNum: number | null = null;
        let dateText = "—";
        let status = "none" as ReturnType<typeof badgeClass>;

        if (isQuiz && l.attempt_id !== null) {
          scoreNum = Number(l.quiz_pct ?? 0);
          scoreText = `${round1(Number(l.quiz_score ?? 0))}/${Number(l.total_points ?? 0)}`;
          dateText = l.quiz_completed_at ? formatDayMonthYear(l.quiz_completed_at) : "—";
          status = badgeClass(l.quiz_passed ? "pass" : "fail");
        } else if (isAssign) {
          dateText = l.submitted_at ? formatDayMonthYear(l.submitted_at) : "—";
          status = badgeClass(l.assignment_status ?? "none");
          if (l.assignment_status === "graded" && Number(l.max_marks ?? 0) > 0) {
            scoreNum = round1((Number(l.marks_obtained ?? 0) / Number(l.max_marks ?? 0)) * 100);
            scoreText = `${l.marks_obtained ?? ""}/${Number(l.max_marks ?? 0)}`;
          } else if (l.submission_id !== null) {
            scoreText = "Submitted";
          }
        }

        const attemptsForLesson = attemptsByLesson.get(Number(l.lesson_id)) ?? [];

        return {
          lessonId: Number(l.lesson_id),
          lessonTitle: l.lesson_title,
          isQuiz,
          scoreText,
          scoreNum,
          fillClass: fillClassFor(scoreNum),
          dateText,
          statusClass: status,
          statusLabel: badgeLabel(status),
          attempts: attemptsForLesson.map((a) => ({
            score: round1(Number(a.score)),
            totalPoints: Number(a.total_points),
            percentage: Number(a.percentage),
            statusClass: badgeClass(a.passed ? "pass" : "fail"),
            statusLabel: badgeLabel(a.passed ? "pass" : "fail"),
            dateText: a.completed_at ? formatDayMonthYear(a.completed_at) : "—",
          })),
        };
      }),
      feedbackItems: lessons
        .filter((l) => l.content_type === "assignment" && l.submission_id !== null)
        .map((l) => ({
          lessonTitle: l.lesson_title,
          statusClass: badgeClass(l.assignment_status ?? "none"),
          statusLabel: badgeLabel(l.assignment_status ?? "none"),
          marks: Number(l.marks_obtained ?? 0),
          maxMarks: Number(l.max_marks ?? 0),
          passingMarks: l.passing_marks,
          submittedAtLabel: l.submitted_at ? formatDayMonthYear(l.submitted_at) : "—",
          feedback: l.feedback,
          isGraded: l.assignment_status === "graded",
          isPending: l.assignment_status === "pending",
        })),
    });
  }

  const summary = summarizeGrades(grades);

  const rawCourse = sp.course ?? "0";
  const parsed = Number.parseInt(rawCourse, 10);
  const activeCourseId = parsed > 0 ? parsed : (panels[0]?.courseId ?? 0);

  return (
    <GradesClient
      panels={panels}
      activeCourseId={activeCourseId}
      summary={summary}
      enrollmentCount={enrollments.length}
    />
  );
}