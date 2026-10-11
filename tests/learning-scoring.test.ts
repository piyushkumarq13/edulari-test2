import { describe, it, expect } from "vitest";
import { computeProgressPercentage } from "@/lib/learning/progress";
import { buildQuizReview, scoreQuiz, isPassed, DEFAULT_PASSING_PERCENTAGE } from "@/lib/learning/quiz";
import {
  badgeClass,
  badgeLabel,
  computeCourseGrade,
  fillClassFor,
  groupAttemptsByLesson,
  letterGradeFor,
  round1,
  summarizeGrades,
  type GradableLesson,
} from "@/lib/learning/grades";
import type { QuizQuestion } from "@/lib/db/learning";

/**
 * Progress / quiz-scoring / grade maths ports of private/functions/student.php and
 * public/student/grades.php, exercised without a database.
 */

/** Distractor option is `900 + id`; the correct one is `correctId`. */
function q(id: number, points: number, correctId: number, type = "multiple_choice"): QuizQuestion {
  return {
    id,
    lesson_id: 1,
    question: `Q${id}`,
    question_type: type,
    points,
    sort_order: 0,
    options: [
      { id: 900 + id, option_text: "A", is_correct: false, sort_order: 0 },
      { id: correctId, option_text: "B", is_correct: true, sort_order: 1 },
    ],
  };
}

const DISTRACTOR = (id: number) => 900 + id;

describe("updateCourseProgress", () => {
  it("rounds completed/total to a whole percent", () => {
    expect(computeProgressPercentage(1, 3)).toBe(33);
    expect(computeProgressPercentage(2, 3)).toBe(67);
    expect(computeProgressPercentage(5, 6)).toBe(83);
  });

  it("returns 0 when the course has no lessons", () => {
    expect(computeProgressPercentage(0, 0)).toBe(0);
    expect(computeProgressPercentage(3, 0)).toBe(0);
  });

  it("reaches exactly 100 when every lesson is done", () => {
    expect(computeProgressPercentage(6, 6)).toBe(100);
  });
});

describe("submitQuizAttempt scoring", () => {
  it("sums points for every question, answered or not", () => {
    const questions = [q(1, 5, 101), q(2, 5, 102), q(3, 10, 103)];
    const r = scoreQuiz(questions, {});
    expect(r.totalPoints).toBe(20);
    expect(r.earnedPoints).toBe(0);
    expect(r.percentage).toBe(0);
  });

  it("scores a fully correct multiple-choice attempt", () => {
    const questions = [q(1, 2, 101), q(2, 3, 102)];
    const r = scoreQuiz(questions, { 1: "101", 2: "102" });
    expect(r.earnedPoints).toBe(5);
    expect(r.percentage).toBe(100);
    expect(r.scored.every((s) => s.isCorrect)).toBe(true);
    expect(r.scored.map((s) => s.selectedOptionId)).toEqual([101, 102]);
  });

  it("awards nothing for a wrong option but records which was chosen", () => {
    const questions = [q(1, 4, 101)];
    const wrong = scoreQuiz(questions, { 1: String(DISTRACTOR(1)) });
    expect(wrong.earnedPoints).toBe(0);
    expect(wrong.percentage).toBe(0);
    expect(wrong.scored[0].isCorrect).toBe(false);
    expect(wrong.scored[0].selectedOptionId).toBe(DISTRACTOR(1));
    expect(wrong.totalPoints).toBe(4);
  });

  it("scores true_false by the literal 'true'/'false' answer", () => {
    const questions: QuizQuestion[] = [
      {
        id: 1, lesson_id: 1, question: "T?", question_type: "true_false", points: 2, sort_order: 0,
        options: [
          { id: 11, option_text: "True", is_correct: true, sort_order: 0 },
          { id: 12, option_text: "False", is_correct: false, sort_order: 1 },
        ],
      },
    ];
    expect(scoreQuiz(questions, { 1: "true" }).earnedPoints).toBe(2);
    expect(scoreQuiz(questions, { 1: "false" }).earnedPoints).toBe(0);
    // The stored option id is the True/False option, not the submitted string.
    expect(scoreQuiz(questions, { 1: "false" }).scored[0].selectedOptionId).toBe(12);
    expect(scoreQuiz(questions, { 1: "true" }).scored[0].isCorrect).toBe(true);
  });

  it("keeps two decimals on the percentage", () => {
    const questions = [q(1, 3, 101), q(2, 3, 102), q(3, 3, 103)];
    const r = scoreQuiz(questions, { 1: "101", 2: "102", 3: "101" });
    expect(r.percentage).toBe(66.67);
  });

  it("treats a zero-point quiz as 0% rather than dividing by zero", () => {
    const questions: QuizQuestion[] = [
      { id: 1, lesson_id: 1, question: "Q", question_type: "multiple_choice", points: 0, sort_order: 0, options: [] },
    ];
    expect(scoreQuiz(questions, {}).percentage).toBe(0);
  });

  it("ignores answers for questions that do not exist", () => {
    const questions = [q(1, 1, 101)];
    const r = scoreQuiz(questions, { 999: "101" });
    expect(r.earnedPoints).toBe(0);
  });
});

describe("quiz pass mark", () => {
  it("uses the course threshold, defaulting to 70", () => {
    expect(DEFAULT_PASSING_PERCENTAGE).toBe(70);
    expect(isPassed(70, 70)).toBe(true);
    expect(isPassed(69.99, 70)).toBe(false);
    expect(isPassed(100, 100)).toBe(true);
  });
});

describe("buildQuizReview", () => {
  it("marks the correct option and the student's selection", () => {
    const questions = [q(1, 2, 101)];
    const review = buildQuizReview(questions, { 1: String(DISTRACTOR(1)) });
    expect(review[0].correct_id).toBe(101);
    expect(review[0].selected_id).toBe(DISTRACTOR(1));
    expect(review[0].is_correct).toBe(false);
    expect(review[0].options).toHaveLength(2);
  });

  it("reports both ids as null for an unanswered question", () => {
    const review = buildQuizReview([q(1, 2, 101)], {});
    expect(review[0].selected_id).toBeNull();
    expect(review[0].is_correct).toBe(false);
  });
});

function gradable(partial: Partial<GradableLesson>): GradableLesson {
  return {
    lesson_id: 1, lesson_title: "L", content_type: "quiz",
    attempt_id: null, quiz_score: null, total_points: null, quiz_pct: null,
    quiz_passed: null, quiz_completed_at: null, submission_id: null,
    marks_obtained: null, assignment_status: null, submitted_at: null,
    feedback: null, max_marks: null, passing_marks: null,
    ...partial,
  };
}

describe("computeCourseGrade", () => {
  it("returns null average and grade-none when nothing is gradable", () => {
    const g = computeCourseGrade([], 70);
    expect(g.weightedAvg).toBeNull();
    expect(g.letterGrade).toBe("—");
    expect(g.gradeClass).toBe("grade-none");
    expect(g.passStatus).toBeNull();
  });

  it("weights a quiz by its total_points and a graded assignment by max_marks", () => {
    const g = computeCourseGrade(
      [
        gradable({ content_type: "quiz", attempt_id: 5, total_points: 20, quiz_pct: "100", quiz_passed: true }),
        gradable({ content_type: "assignment", submission_id: 9, assignment_status: "graded", marks_obtained: 30, max_marks: 40 }),
      ],
      70,
    );
    // (20 * 1.0 + 30) / 60 = 83.33 -> 83.3
    expect(g.weightedAvg).toBe(83.3);
    expect(g.letterGrade).toBe("B");
    expect(g.passStatus).toBe("pass");
    expect(g.quizCount).toBe(1);
    expect(g.quizPassed).toBe(1);
    expect(g.assignCount).toBe(1);
    expect(g.assignGraded).toBe(1);
  });

  it("falls back to weight 10 when a quiz has no total_points", () => {
    const g = computeCourseGrade([gradable({ content_type: "quiz", attempt_id: 1, total_points: 0, quiz_pct: "50", quiz_passed: false })], 70);
    expect(g.weightedAvg).toBe(50);
  });

  it("excludes a pending assignment from the average", () => {
    const g = computeCourseGrade([gradable({ content_type: "assignment", submission_id: 3, assignment_status: "pending", max_marks: 50 })], 70);
    expect(g.weightedAvg).toBeNull();
    expect(g.assignCount).toBe(1);
    expect(g.assignGraded).toBe(0);
  });

  it("excludes an assignment graded against max_marks = 0", () => {
    const g = computeCourseGrade([gradable({ content_type: "assignment", submission_id: 3, assignment_status: "graded", marks_obtained: 5, max_marks: 0 })], 70);
    expect(g.weightedAvg).toBeNull();
    expect(g.assignGraded).toBe(0);
  });

  it("fails a course below the passing threshold", () => {
    const g = computeCourseGrade([gradable({ content_type: "quiz", attempt_id: 1, total_points: 10, quiz_pct: "60", quiz_passed: false })], 70);
    expect(g.passStatus).toBe("fail");
    expect(g.letterGrade).toBe("D");
  });
});

describe("letter grades", () => {
  it("uses the PHP ladder", () => {
    expect(letterGradeFor(95)).toEqual({ letterGrade: "A", gradeClass: "grade-a" });
    expect(letterGradeFor(90)).toEqual({ letterGrade: "A", gradeClass: "grade-a" });
    expect(letterGradeFor(85)).toEqual({ letterGrade: "B", gradeClass: "grade-b" });
    expect(letterGradeFor(75)).toEqual({ letterGrade: "C", gradeClass: "grade-c" });
    expect(letterGradeFor(65)).toEqual({ letterGrade: "D", gradeClass: "grade-d" });
    expect(letterGradeFor(10)).toEqual({ letterGrade: "F", gradeClass: "grade-f" });
    expect(letterGradeFor(null)).toEqual({ letterGrade: "—", gradeClass: "grade-none" });
  });
});

describe("summarizeGrades", () => {
  it("sums per-course counters and averages only the non-null averages", () => {
    const s = summarizeGrades([
      computeCourseGrade([gradable({ content_type: "quiz", attempt_id: 1, total_points: 10, quiz_pct: "90", quiz_passed: true })], 70),
      computeCourseGrade([gradable({ content_type: "quiz", attempt_id: 2, total_points: 10, quiz_pct: "70", quiz_passed: true })], 70),
      computeCourseGrade([], 70),
    ]);
    expect(s.globalTotalQuizzes).toBe(2);
    expect(s.globalQuizzesPassed).toBe(2);
    expect(s.globalAvg).toBe(80);
  });

  it("returns a null average when no course has a grade", () => {
    expect(summarizeGrades([computeCourseGrade([], 70)]).globalAvg).toBeNull();
  });
});

describe("grade display helpers", () => {
  it("maps a score to its fill class", () => {
    expect(fillClassFor(95)).toBe("fill-a");
    expect(fillClassFor(85)).toBe("fill-b");
    expect(fillClassFor(75)).toBe("fill-c");
    expect(fillClassFor(65)).toBe("fill-d");
    expect(fillClassFor(10)).toBe("fill-f");
    expect(fillClassFor(null)).toBe("fill-none");
  });

  it("normalises unknown statuses to none / an em dash", () => {
    expect(badgeClass("pass")).toBe("pass");
    expect(badgeClass("fail")).toBe("fail");
    expect(badgeClass("graded")).toBe("graded");
    expect(badgeClass("pending")).toBe("pending");
    expect(badgeClass("weird")).toBe("none");
    expect(badgeClass(null)).toBe("none");
    expect(badgeLabel("none")).toBe("—");
  });

  it("rounds to one decimal", () => {
    expect(round1(66.666)).toBe(66.7);
    expect(round1(80)).toBe(80);
  });

  it("groups attempts by lesson preserving order", () => {
    const grouped = groupAttemptsByLesson([
      { lesson_id: 1, score: 3, total_points: 5, percentage: "60.00", passed: false, completed_at: null },
      { lesson_id: 1, score: 5, total_points: 5, percentage: "100.00", passed: true, completed_at: null },
      { lesson_id: 2, score: 1, total_points: 5, percentage: "20.00", passed: false, completed_at: null },
    ]);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(1)![0].percentage).toBe("60.00");
    expect(grouped.get(2)).toHaveLength(1);
  });
});