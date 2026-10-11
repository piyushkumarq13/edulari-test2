import type { CurriculumSection, FullLesson } from "@/lib/db/learning";

/** Serializable shapes handed from the server component to the learn-page client tree. */

export type LearnUser = {
  name: string;
  avatarUrl: string | null;
  initials: string;
};

export type LearnCourse = {
  id: number;
  slug: string;
  title: string;
};

export type LearnEnrollment = {
  id: number;
  progressPercentage: number;
};

export type LearnQuizResult = {
  score: number;
  total: number;
  percentage: number;
  passed: number;
};

export type LearnReviewOption = { id: number; option_text: string; is_correct: boolean };
export type LearnReviewItem = {
  question: string;
  type: string;
  options: LearnReviewOption[];
  selected_id: number | null;
  correct_id: number | null;
  is_correct: boolean;
  points: number;
};

export type LearnProps = {
  user: LearnUser;
  course: LearnCourse;
  enrollment: LearnEnrollment;
  sections: CurriculumSection[];
  totalLessons: number;
  completedLessons: number;
  currentLesson: FullLesson | null;
  currentLessonId: number;
  quizResult: LearnQuizResult | null;
  quizReview: LearnReviewItem[] | null;
  flashAssignmentSubmitted: boolean;
  courseCompleted: boolean;
  certificateEligible: boolean;
  hasCertificate: boolean;
  csrfToken: string;
};

/** learn.php's formatDuration(), hoisted so the sidebar can use it. */
export function formatDuration(secs: number): string {
  if (secs <= 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/** learn.php's avatar initials: first letter of the first two space-separated parts. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(" ");
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

export function sectionProgress(lessons: { lesson_completed_at: Date | string | null }[]): {
  completed: number;
  total: number;
} {
  return {
    completed: lessons.filter((l) => !!l.lesson_completed_at).length,
    total: lessons.length,
  };
}