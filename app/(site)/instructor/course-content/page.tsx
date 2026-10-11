import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@/styles/css/instructor/course-content.css";
import "@/styles/css/md-editor.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCourseById } from "@/lib/db/instructor/courses";
import { getCourseSections } from "@/lib/db/instructor/sections";
import { getSectionLessons } from "@/lib/db/instructor/lessons";
import { getQuizQuestions, getQuizTotalPoints } from "@/lib/db/instructor/quizzes";
import { getAssignmentByLesson } from "@/lib/db/instructor/assignments";
import CourseContentClient, { type SectionWithLessons } from "@/components/instructor/course/CourseContentClient";
import CoursePublishButton from "@/components/instructor/course/CoursePublishButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Course Content – Edulari",
  description: "Manage sections and lessons for your course.",
  noindex: true,
  canonical: false,
});

export default async function CourseContentPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; msg?: string; created?: string }>;
}) {
  const user = await requireInstructorApproved();
  const sp = await searchParams;
  const courseId = Number(sp.id ?? 0);

  const course = Number.isFinite(courseId) && courseId > 0 ? await getCourseById(courseId, user.id) : null;
  if (!course) redirect("/instructor/courses");

  const [sections, csrfToken] = await Promise.all([
    getCourseSections(courseId, user.id),
    readCsrfToken(),
  ]);

  const withLessons: SectionWithLessons[] = [];
  for (const section of sections) {
    const lessons = await getSectionLessons(section.id, courseId);
    const mapped = [] as SectionWithLessons["lessons"];
    for (const lesson of lessons) {
      let quizCount = 0;
      let totalPoints = 0;
      let quizQuestions: SectionWithLessons["lessons"][number]["quiz_questions"];
      let assignment: SectionWithLessons["lessons"][number]["assignment"] = null;
      if (lesson.content_type === "quiz") {
        const questions = await getQuizQuestions(lesson.id);
        quizCount = questions.length;
        totalPoints = await getQuizTotalPoints(lesson.id);
        quizQuestions = questions.map((q) => ({
          question: q.question,
          question_type: q.question_type,
          points: q.points,
          options: (q.options ?? []).map((o) => ({
            id: o.id,
            option_text: o.option_text,
            is_correct: Boolean(o.is_correct),
          })),
        }));
      }
      if (lesson.content_type === "assignment") {
        const a = await getAssignmentByLesson(lesson.id);
        if (a) {
          assignment = {
            max_marks: a.max_marks,
            due_days: a.due_days,
            passing_marks: a.passing_marks,
            allow_late_submission: Boolean(a.allow_late_submission),
            instructions: a.instructions,
          };
        }
      }
      mapped.push({
        id: lesson.id,
        section_id: lesson.section_id,
        title: lesson.title,
        content_type: lesson.content_type,
        content_text: lesson.content_text,
        video_url: lesson.video_url,
        video_duration: lesson.video_duration,
        is_free_preview: Boolean(lesson.is_free_preview),
        quiz_questions: quizQuestions,
        quiz_count: quizCount,
        total_points: totalPoints,
        assignment,
      });
    }
    withLessons.push({ section, lessons: mapped });
  }

  const totalLessons = withLessons.reduce((n, s) => n + s.lessons.length, 0);
  const totalSections = withLessons.length;

  return (
    <main className="in-page-wrap">
      <div className="cc-page-inner">
        <nav className="cc-breadcrumb" aria-label="Breadcrumb">
          <a href="/instructor/courses" className="cc-breadcrumb-link">My Courses</a>
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="cc-breadcrumb-current">Course Content</span>
        </nav>

        <div className="cc-page-header">
          <div className="cc-page-header-text">
            <h1 className="cc-page-title">{course.title}</h1>
            <p className="cc-page-subtitle">Manage sections and lessons for your course.</p>
          </div>
          <div className="cc-page-header-actions">
            <a href={`/instructor/edit-course?id=${courseId}`} className="cc-btn cc-btn--secondary">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit Course Info
            </a>
            {!course.is_published ? (
              <CoursePublishButton courseId={courseId} csrfToken={csrfToken} />
            ) : null}
          </div>
        </div>

        {sp.msg ? (
          <div className="cc-alert cc-alert--success" role="alert">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {sp.msg}
          </div>
        ) : null}

        <div className="cc-summary-strip">
          <div className="cc-summary-item">
            <span className="cc-summary-value">{totalSections}</span>
            <span className="cc-summary-label">Section{totalSections !== 1 ? "s" : ""}</span>
          </div>
          <div className="cc-summary-divider" aria-hidden="true" />
          <div className="cc-summary-item">
            <span className="cc-summary-value">{totalLessons}</span>
            <span className="cc-summary-label">Lesson{totalLessons !== 1 ? "s" : ""}</span>
          </div>
          <div className="cc-summary-divider" aria-hidden="true" />
          <div className="cc-summary-item">
            <span className={`cc-summary-badge ${course.is_published ? "cc-badge--published" : "cc-badge--draft"}`}>
              {course.is_published ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div className="cc-layout">
          <div className="cc-content-col">
            <CourseContentClient
              courseId={courseId}
              csrfToken={csrfToken}
              sections={withLessons}
              sectionList={sections.map((s) => ({ id: s.id, title: s.title }))}
            />
          </div>

          <aside className="cc-sidebar">
            <div className="cc-sidebar-card">
              <h3 className="cc-sidebar-title">
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Content Tips
              </h3>
              <ul className="cc-tips-list">
                <li>Break content into short, focused sections.</li>
                <li>Start with an intro lesson as a free preview.</li>
                <li>Mix video, text, and quizzes for engagement.</li>
                <li>Add assignments to reinforce key concepts.</li>
                <li>Keep video lessons under 15 minutes each.</li>
              </ul>
            </div>
            <div className="cc-sidebar-card cc-sidebar-card--types">
              <h3 className="cc-sidebar-title">Lesson Types</h3>
              <div className="cc-type-list">
                <div className="cc-type-item">
                  <span className="cc-type-badge cc-type-badge--video">Video</span>
                  <span>Embed YouTube, Vimeo or direct links</span>
                </div>
                <div className="cc-type-item">
                  <span className="cc-type-badge cc-type-badge--text">Text</span>
                  <span>Rich article or reading material</span>
                </div>
                <div className="cc-type-item">
                  <span className="cc-type-badge cc-type-badge--pdf">PDF</span>
                  <span>Upload downloadable documents</span>
                </div>
                <div className="cc-type-item">
                  <span className="cc-type-badge cc-type-badge--quiz">Quiz</span>
                  <span>Multiple choice or True/False</span>
                </div>
                <div className="cc-type-item">
                  <span className="cc-type-badge cc-type-badge--assignment">Assignment</span>
                  <span>Graded tasks with due dates</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}