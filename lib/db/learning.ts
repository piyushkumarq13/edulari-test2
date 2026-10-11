import { sql } from "./client";

/**
 * Read side of private/functions/{lessons,sections,quizzes,assignments}.php plus the
 * student-facing joins of private/functions/student.php. Every statement is a 1:1 port
 * of the original PDO query (see docs/analysis/phase6.md §4).
 */

export type Enrollment = {
  id: number;
  course_id: number;
  student_id: number;
  progress_percentage: number;
  enrolled_at: Date | null;
  completed_at: Date | null;
};

/** Port of getLessonForStudent()'s base row. */
export type Lesson = {
  id: number;
  section_id: number;
  course_id: number;
  title: string;
  content_type: string;
  content_text: string | null;
  video_url: string | null;
  video_duration: number;
  pdf_file: string | null;
  is_free_preview: boolean;
  sort_order: number;
  section_title: string | null;
  lesson_completed_at: Date | null;
  time_spent_seconds: number | null;
};

/** Port of the per-lesson columns getCourseContentForStudent() joins in. */
export type CurriculumLesson = Lesson & {
  quiz_score: number | null;
  quiz_percentage: string | null;
  quiz_passed: boolean | null;
  quiz_completed_at: Date | null;
  assignment_status: string | null;
  assignment_marks: number | null;
};

export type CurriculumSection = {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: CurriculumLesson[];
};

export type QuizOption = {
  id: number;
  question_id?: number;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
};

export type QuizQuestion = {
  id: number;
  lesson_id: number;
  question: string;
  question_type: string;
  points: number;
  sort_order: number;
  options: QuizOption[];
};

export type QuizAttempt = {
  id: number;
  enrollment_id: number;
  lesson_id: number;
  score: number;
  total_points: number;
  percentage: string;
  passed: boolean;
  started_at: Date | null;
  completed_at: Date | null;
};

export type Assignment = {
  id: number;
  lesson_id: number;
  instructions: string;
  max_marks: number;
  passing_marks: number;
  due_days: number;
  allow_late_submission: boolean;
};

export type AssignmentSubmission = {
  id: number;
  enrollment_id: number;
  lesson_id: number;
  submission_text: string | null;
  attachment_file: string | null;
  submitted_at: Date | null;
  marks_obtained: number | null;
  feedback: string | null;
  status: string;
  graded_at: Date | null;
};

export type LessonNavigation = { prev: { id: number; title: string } | null; next: { id: number; title: string } | null };

/** Port of isEnrolled(). */
export async function findEnrollment(studentId: number, courseId: number): Promise<Enrollment | null> {
  const rows = await sql<Enrollment[]>`
    SELECT id, course_id, student_id, progress_percentage, enrolled_at, completed_at
    FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId}
  `;
  return rows[0] ?? null;
}

/** Port of getCourseContentForStudent() — returns null when the student is not enrolled. */
export async function getCourseContentForStudent(
  courseId: number,
  studentId: number,
): Promise<{ enrollment: Enrollment; sections: CurriculumSection[] } | null> {
  const enrollment = await findEnrollment(studentId, courseId);
  if (!enrollment) return null;

  const sections = await sql<Omit<CurriculumSection, "lessons">[]>`
    SELECT id, course_id, title, description, sort_order
    FROM course_sections WHERE course_id = ${courseId}
    ORDER BY sort_order, id
  `;

  if (sections.length === 0) return { enrollment, sections: [] };

  const lessons = await sql<CurriculumLesson[]>`
    SELECT l.*,
      s.title AS section_title,
      lp.completed_at AS lesson_completed_at,
      lp.time_spent_seconds,
      qa.score AS quiz_score,
      qa.percentage AS quiz_percentage,
      qa.passed AS quiz_passed,
      qa.completed_at AS quiz_completed_at,
      ass.status AS assignment_status,
      ass.marks_obtained AS assignment_marks
    FROM lessons l
    JOIN course_sections s ON l.section_id = s.id
    LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.enrollment_id = ${enrollment.id}
    LEFT JOIN quiz_attempts qa ON l.id = qa.lesson_id AND qa.enrollment_id = ${enrollment.id}
    LEFT JOIN assignment_submissions ass ON l.id = ass.lesson_id AND ass.enrollment_id = ${enrollment.id}
    WHERE l.course_id = ${courseId}
    ORDER BY s.sort_order, l.sort_order, l.id
  `;

  const bySection = new Map<number, CurriculumLesson[]>();
  for (const lesson of lessons) {
    const list = bySection.get(Number(lesson.section_id)) ?? [];
    list.push(lesson);
    bySection.set(Number(lesson.section_id), list);
  }

  return {
    enrollment,
    sections: sections.map((s) => ({ ...s, lessons: bySection.get(Number(s.id)) ?? [] })),
  };
}

/** Port of getLessonNavigation(): all lessons ordered by section sort then lesson sort. */
/** Port of getLessonNavigation(). The PHP takes an unused $sectionId; it is dropped. */
export async function getLessonNavigation(courseId: number, currentLessonId: number): Promise<LessonNavigation> {
  const rows = await sql<{ id: number; title: string }[]>`
    SELECT l.id, l.title
    FROM lessons l
    JOIN course_sections s ON l.section_id = s.id
    WHERE l.course_id = ${courseId}
    ORDER BY s.sort_order, l.sort_order
  `;

  const idx = rows.findIndex((r) => Number(r.id) === currentLessonId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? { id: Number(rows[idx - 1].id), title: rows[idx - 1].title } : null,
    next: idx < rows.length - 1 ? { id: Number(rows[idx + 1].id), title: rows[idx + 1].title } : null,
  };
}

export type FullLesson = Lesson & {
  questions?: QuizQuestion[];
  previous_attempt?: QuizAttempt | null;
  assignment?: Assignment | null;
  submission?: AssignmentSubmission | null;
  navigation: LessonNavigation;
};

/**
 * Port of getLessonForStudent(). Verifies the enrollment, then loads the extra content
 * the lesson's content_type needs, exactly like the PHP switch.
 */
export async function getLessonForStudent(
  lessonId: number,
  courseId: number,
  studentId: number,
): Promise<FullLesson | null> {
  const enrollment = await findEnrollment(studentId, courseId);
  if (!enrollment) return null;

  const rows = await sql<Lesson[]>`
    SELECT l.*, s.title AS section_title,
      lp.completed_at AS lesson_completed_at,
      lp.time_spent_seconds
    FROM lessons l
    JOIN course_sections s ON l.section_id = s.id
    LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.enrollment_id = ${enrollment.id}
    WHERE l.id = ${lessonId} AND l.course_id = ${courseId}
  `;
  if (rows.length === 0) return null;

  const lesson: FullLesson = { ...rows[0], navigation: { prev: null, next: null } };

  if (lesson.content_type === "quiz") {
    lesson.questions = await getQuizQuestions(lessonId);
    const attempts = await sql<QuizAttempt[]>`
      SELECT * FROM quiz_attempts
      WHERE enrollment_id = ${enrollment.id} AND lesson_id = ${lessonId}
      ORDER BY completed_at DESC LIMIT 1
    `;
    lesson.previous_attempt = attempts[0] ?? null;
  }

  if (lesson.content_type === "assignment") {
    const assignments = await sql<Assignment[]>`SELECT * FROM assignments WHERE lesson_id = ${lessonId}`;
    lesson.assignment = assignments[0] ?? null;
    const subs = await sql<AssignmentSubmission[]>`
      SELECT * FROM assignment_submissions WHERE enrollment_id = ${enrollment.id} AND lesson_id = ${lessonId}
    `;
    lesson.submission = subs[0] ?? null;
  }

  lesson.navigation = await getLessonNavigation(courseId, lessonId);
  return lesson;
}

/** Port of getQuizQuestions() — questions ordered by sort_order, options likewise. */
export async function getQuizQuestions(lessonId: number): Promise<QuizQuestion[]> {
  const questions = await sql<Omit<QuizQuestion, "options">[]>`
    SELECT id, lesson_id, question, question_type, points, sort_order
    FROM quiz_questions WHERE lesson_id = ${lessonId}
    ORDER BY sort_order, id
  `;
  if (questions.length === 0) return [];

  const options = await sql<QuizOption[]>`
    SELECT id, question_id, option_text, is_correct, sort_order
    FROM quiz_options
    WHERE question_id IN ${sql(questions.map((q) => Number(q.id)))}
    ORDER BY sort_order, id
  `;

  const byQuestion = new Map<number, QuizOption[]>();
  for (const opt of options) {
    const list = byQuestion.get(Number(opt.question_id)) ?? [];
    list.push(opt);
    byQuestion.set(Number(opt.question_id), list);
  }

  return questions.map((q) => ({ ...q, options: byQuestion.get(Number(q.id)) ?? [] }));
}

/**
 * Port of getStudentCourses(): `e.*, c.*` with the lesson counts. The LEFT JOIN on
 * certificates is the Phase 6 fix for my-courses.php/dashboard.php reading
 * certificate_issued / certificate_url off a `courses` row that has neither column.
 */
export type StudentCourse = {
  enrollment_id: number;
  course_id: number;
  progress_percentage: number;
  enrolled_at: Date | null;
  completed_at: Date | null;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  price: string;
  level: string;
  category_name: string | null;
  category_slug: string | null;
  instructor_name: string | null;
  certificate_enabled: boolean;
  total_lessons: number;
  completed_lessons: number;
  certificate_id: string | null;
};

export async function getStudentCourses(studentId: number): Promise<StudentCourse[]> {
  return sql<StudentCourse[]>`
    SELECT e.id AS enrollment_id, e.course_id, e.progress_percentage, e.enrolled_at, e.completed_at,
      c.id AS course_id, c.title, c.slug, c.description, c.thumbnail, c.price, c.level,
      c.certificate_enabled,
      cat.name AS category_name, cat.slug AS category_slug,
      u.name AS instructor_name,
      (SELECT COUNT(*)::int FROM lessons WHERE course_id = c.id) AS total_lessons,
      (SELECT COUNT(*)::int FROM lesson_progress lp
         JOIN enrollments en ON lp.enrollment_id = en.id
        WHERE en.course_id = c.id AND en.student_id = ${studentId}) AS completed_lessons,
      cert.certificate_id
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    LEFT JOIN certificates cert ON cert.enrollment_id = e.id
    WHERE e.student_id = ${studentId}
    ORDER BY e.enrolled_at DESC
  `;
}

/** Port of getStudentCourses()'s AVG(rating) that my-courses.php reads off the row. */
export async function getCourseRatingMap(courseIds: number[]): Promise<Record<number, number>> {
  if (courseIds.length === 0) return {};
  const rows = await sql<{ course_id: number; avg_rating: string | null }[]>`
    SELECT course_id, AVG(rating) AS avg_rating FROM course_reviews
    WHERE course_id IN ${sql(courseIds)} GROUP BY course_id
  `;
  const out: Record<number, number> = {};
  for (const r of rows) if (r.avg_rating !== null) out[Number(r.course_id)] = Number(r.avg_rating);
  return out;
}

/** Port of getCourseDetails() — the public course row the learn/certificate pages read. */
export type CourseDetail = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  instructor_id: number;
  certificate_enabled: boolean;
  passing_percentage: number;
  category_name: string | null;
  instructor_name: string | null;
};

export async function getCourseDetail(courseId: number): Promise<CourseDetail | null> {
  const rows = await sql<CourseDetail[]>`
    SELECT c.id, c.title, c.slug, c.description, c.instructor_id,
      c.certificate_enabled, c.passing_percentage,
      cat.name AS category_name,
      u.name AS instructor_name
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    WHERE c.id = ${courseId}
  `;
  return rows[0] ?? null;
}

/** Port of schedule-api.php's get_lessons, enrollment-gated. */
export async function getCourseLessonsForStudent(
  courseId: number,
  studentId: number,
): Promise<{ id: number; title: string; content_type: string; section_title: string | null }[]> {
  const enrolled = await findEnrollment(studentId, courseId);
  if (!enrolled) return [];
  return sql`
    SELECT l.id, l.title, l.content_type, s.title AS section_title
    FROM lessons l
    LEFT JOIN course_sections s ON l.section_id = s.id
    WHERE l.course_id = ${courseId}
    ORDER BY s.sort_order, l.sort_order, l.id
  `;
}

/** getStudentProfile() (private/auth.php) — the student_profiles row for a user. */
export type StudentProfile = {
  id: number;
  user_id: number;
  highest_education: string | null;
  college_name: string | null;
  field_of_study: string | null;
  courses_interested: string | null;
  skills: string | null;
  learning_goal: string | null;
  experience_level: string | null;
  bio: string | null;
  phone: string | null;
};

export async function getStudentProfile(userId: number): Promise<StudentProfile | null> {
  const rows = await sql<StudentProfile[]>`SELECT * FROM student_profiles WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export const SKILL_OPTIONS = [
  "Python", "JavaScript", "HTML & CSS", "Java", "C++", "SQL", "React", "Node.js",
  "Data Analysis", "Machine Learning", "UI/UX Design", "Digital Marketing",
  "Excel", "Project Management", "Communication", "Graphic Design",
];

export const EDUCATION_OPTIONS: [string, string][] = [
  ["high_school", "High School / 10+2"],
  ["diploma", "Diploma"],
  ["bachelors", "Bachelor's Degree"],
  ["masters", "Master's Degree"],
  ["phd", "PhD / Doctorate"],
  ["other", "Other"],
];

export const GOAL_OPTIONS: [string, string][] = [
  ["career_change", "Switch Careers"],
  ["skill_upgrade", "Upgrade My Skills"],
  ["personal_interest", "Personal Interest"],
  ["academic", "Academic Requirement"],
  ["other", "Other"],
];

export const LEVEL_OPTIONS: [string, string][] = [
  ["beginner", "Beginner — I'm new to most topics"],
  ["intermediate", "Intermediate — I know the basics"],
  ["advanced", "Advanced — I want deep expertise"],
];