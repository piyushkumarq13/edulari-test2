// lib/config.ts validates the environment at import time, so these must be set before the
// modules under test are loaded (import hoisting means this has to be a side-effect import).
import "./helpers/env";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "@/lib/db/client";
import { createCourse } from "@/lib/db/instructor/courses";
import { createSection } from "@/lib/db/instructor/sections";
import { createLesson } from "@/lib/db/instructor/lessons";
import {
  createQuizQuestion,
  getQuizQuestions,
  getQuizTotalPoints,
  updateQuizOptions,
  deleteQuizQuestion,
  replaceQuizQuestions,
} from "@/lib/db/instructor/quizzes";
import { createAssignment, getAssignmentByLesson, updateAssignment, getAssignmentById } from "@/lib/db/instructor/assignments";
import { parseQuizQuestions } from "@/lib/api/instructor/parse-quiz";

let ownerId = 0;
let lessonId = 0;

beforeAll(async () => {
  const suffix = Date.now();
  const [u] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Quiz Owner', ${`quiz-${suffix}@edulari.test`}, 'x', 'instructor', true, true)
    RETURNING id`;
  ownerId = u.id;
  const courseId = await createCourse({ instructor_id: ownerId, title: `Quiz Course ${suffix}` });
  const sectionId = await createSection(courseId!, "Q", "", 0);
  const l = await createLesson({ section_id: sectionId!, course_id: courseId!, title: "Quiz lesson", content_type: "quiz" });
  lessonId = l!;
});

afterAll(async () => {
  await sql`DELETE FROM courses WHERE instructor_id = ${ownerId}`;
  await sql`DELETE FROM users WHERE id = ${ownerId}`;
});

describe("multiple choice questions", () => {
  it("stores one option row per entry and marks only the chosen one correct", async () => {
    const q = await createQuizQuestion({
      lesson_id: lessonId,
      question: "Which is 2 + 2?",
      question_type: "multiple_choice",
      points: 5,
      options: [
        { text: "3", is_correct: 0 },
        { text: "4", is_correct: 1 },
        { text: "5", is_correct: 0 },
        { text: "6", is_correct: 0 },
      ],
    });
    expect(q).toBeTruthy();
    const loaded = (await getQuizQuestions(lessonId)).find((x) => x.id === q)!;
    const opts = loaded.options ?? [];
    expect(opts).toHaveLength(4);
    expect(opts.filter((o) => o.is_correct)).toHaveLength(1);
    expect(opts.find((o) => o.is_correct)!.option_text).toBe("4");
    expect(loaded.points).toBe(5);
    await deleteQuizQuestion(q!);
  });

  it("defaults to one point when none is given", async () => {
    const q = await createQuizQuestion({ lesson_id: lessonId, question: "Points?" });
    expect((await getQuizQuestions(lessonId)).find((x) => x.id === q)!.points).toBe(1);
    await deleteQuizQuestion(q!);
  });

  it("replaces every option on update", async () => {
    const q = await createQuizQuestion({
      lesson_id: lessonId,
      question: "Replaceable",
      options: [{ text: "a", is_correct: 1 }, { text: "b", is_correct: 0 }],
    });
    await updateQuizOptions(q!, [{ text: "x", is_correct: 0 }, { text: "y", is_correct: 1 }]);
    const loaded = (await getQuizQuestions(lessonId)).find((x) => x.id === q)!;
    const opts = loaded.options ?? [];
    expect(opts.map((o) => o.option_text)).toEqual(["x", "y"]);
    expect(opts[1].is_correct).toBe(true);
    await deleteQuizQuestion(q!);
  });
});

describe("true/false questions", () => {
  it("stores exactly True and False with the chosen one correct", async () => {
    const q = await createQuizQuestion({
      lesson_id: lessonId,
      question: "The sky is blue",
      question_type: "true_false",
      correct_answer: "true",
    });
    const loaded = (await getQuizQuestions(lessonId)).find((x) => x.id === q)!;
    const opts = loaded.options ?? [];
    expect(opts.map((o) => o.option_text)).toEqual(["True", "False"]);
    expect(opts[0].is_correct).toBe(true);
    expect(opts[1].is_correct).toBe(false);
    await deleteQuizQuestion(q!);
  });

  it("marks False correct when the answer says so", async () => {
    const q = await createQuizQuestion({
      lesson_id: lessonId,
      question: "Water is dry",
      question_type: "true_false",
      correct_answer: "false",
    });
    const loaded = (await getQuizQuestions(lessonId)).find((x) => x.id === q)!;
    const opts = loaded.options ?? [];
    expect(opts[0].is_correct).toBe(false);
    expect(opts[1].is_correct).toBe(true);
    await deleteQuizQuestion(q!);
  });

  it("defaults to True for an unrecognised answer", async () => {
    const q = await createQuizQuestion({
      lesson_id: lessonId,
      question: "Default",
      question_type: "true_false",
      correct_answer: "maybe",
    });
    const loaded = (await getQuizQuestions(lessonId)).find((x) => x.id === q)!;
    const opts = loaded.options ?? [];
    expect(opts[0].is_correct).toBe(true);
    await deleteQuizQuestion(q!);
  });
});

describe("quiz totals and replacement", () => {
  it("sums the points of every question", async () => {
    await replaceQuizQuestions(lessonId, [
      { lesson_id: lessonId, question: "A", points: 3, options: [{ text: "x", is_correct: 1 }] },
      { lesson_id: lessonId, question: "B", points: 7, question_type: "true_false", correct_answer: "false" },
    ]);
    expect(await getQuizTotalPoints(lessonId)).toBe(10);
    const all = await getQuizQuestions(lessonId);
    expect(all).toHaveLength(2);
    expect(all.map((q) => q.question)).toEqual(["A", "B"]);
  });

  it("wipes the previous questions on replace", async () => {
    await replaceQuizQuestions(lessonId, [
      { lesson_id: lessonId, question: "Only one", points: 1 },
    ]);
    const all = await getQuizQuestions(lessonId);
    expect(all).toHaveLength(1);
    expect(all[0].question).toBe("Only one");
  });
});

describe("quiz form parsing", () => {
  const form = (entries: Array<[string, string]>) => {
    const fd = new FormData();
    for (const [k, v] of entries) fd.append(k, v);
    return fd;
  };

  it("maps quiz_questions[i][...] onto the createQuizQuestion shape", () => {
    const parsed = parseQuizQuestions(
      form([
        ["quiz_questions[0][question]", "Q one"],
        ["quiz_questions[0][type]", "multiple_choice"],
["quiz_questions[0][points]", "2"],
          ["quiz_questions[0][options][0]", "a"],
          ["quiz_questions[0][options][1]", "b"],
          ["quiz_questions[0][correct_option]", "0"],
          ["quiz_questions[1][question]", "Q two"],
          ["quiz_questions[1][type]", "multiple_choice"],
          ["quiz_questions[1][points]", "1"],
          ["quiz_questions[1][options][0]", "x"],
          ["quiz_questions[1][options][1]", "y"],
          ["quiz_questions[1][correct_option]", "1"],
        ]),
      );
      expect(parsed).toHaveLength(2);
      expect(parsed[0].options).toEqual([{ text: "a", is_correct: 1 }, { text: "b", is_correct: 0 }]);
      expect(parsed[1].options).toEqual([{ text: "x", is_correct: 0 }, { text: "y", is_correct: 1 }]);
      expect(parsed[1].points).toBe(1);
    });

    it("keeps the index order rather than the insertion order", () => {
      const parsed = parseQuizQuestions(
        form([
          ["quiz_questions[2][question]", "third"],
          ["quiz_questions[2][type]", "true_false"],
          ["quiz_questions[2][correct_answer]", "true"],
          ["quiz_questions[0][question]", "first"],
          ["quiz_questions[0][type]", "true_false"],
          ["quiz_questions[0][correct_answer]", "true"],
          ["quiz_questions[1][question]", "second"],
          ["quiz_questions[1][type]", "true_false"],
          ["quiz_questions[1][correct_answer]", "true"],
        ]),
      );
      expect(parsed.map((p) => p.question)).toEqual(["first", "second", "third"]);
    });

    it("skips a card whose question text is blank", () => {
      const parsed = parseQuizQuestions(
        form([
          ["quiz_questions[0][question]", "   "],
          ["quiz_questions[0][type]", "multiple_choice"],
          ["quiz_questions[1][question]", "kept"],
          ["quiz_questions[1][type]", "true_false"],
          ["quiz_questions[1][correct_answer]", "true"],
        ]),
      );
      expect(parsed).toHaveLength(1);
      expect(parsed[0].question).toBe("kept");
    });

  it("reads the true/false answer", () => {
    const parsed = parseQuizQuestions(
      form([
        ["quiz_questions[0][question]", "tf"],
        ["quiz_questions[0][type]", "true_false"],
        ["quiz_questions[0][correct_answer]", "false"],
      ]),
    );
    expect(parsed[0].correct_answer).toBe("false");
  });

  it("returns nothing when the form has no questions", () => {
    expect(parseQuizQuestions(form([["lesson_title", "x"]]))).toEqual([]);
  });

  it("rejects a multiple-choice question with fewer than two options", () => {
    expect(() =>
      parseQuizQuestions(
        form([
          ["quiz_questions[0][question]", "q"],
          ["quiz_questions[0][type]", "multiple_choice"],
          ["quiz_questions[0][correct_option]", "0"],
          ["quiz_questions[0][options][0]", "only one"],
        ]),
      ),
    ).toThrow(/at least two answer options/);
  });

  it("rejects a multiple-choice question whose correct option is out of range", () => {
    expect(() =>
      parseQuizQuestions(
        form([
          ["quiz_questions[0][question]", "q"],
          ["quiz_questions[0][type]", "multiple_choice"],
          ["quiz_questions[0][correct_option]", "9"],
          ["quiz_questions[0][options][0]", "a"],
          ["quiz_questions[0][options][1]", "b"],
        ]),
      ),
    ).toThrow(/exactly one correct answer/);
  });

  it("rejects non-positive or non-numeric points", () => {
    for (const points of ["0", "-3", "abc"]) {
      expect(() =>
        parseQuizQuestions(
          form([
            ["quiz_questions[0][question]", "q"],
            ["quiz_questions[0][type]", "true_false"],
            ["quiz_questions[0][points]", points],
          ]),
        ),
      ).toThrow(/between 1 and 100/);
    }
  });
});

describe("assignments", () => {
  it("applies the PHP defaults", async () => {
    const id = await createAssignment({ lesson_id: lessonId });
    const a = await getAssignmentByLesson(lessonId);
    expect(a!.id).toBe(id);
    expect(a!.max_marks).toBe(100);
    expect(a!.passing_marks).toBe(40);
    expect(a!.due_days).toBe(7);
    expect(a!.allow_late_submission).toBe(false);
  });

  it("updates the stored values", async () => {
    const a = await getAssignmentByLesson(lessonId);
    await updateAssignment(a!.id, { max_marks: 50, passing_marks: 20, due_days: 3, allow_late_submission: 1 });
    const after = await getAssignmentById(a!.id);
    expect(after!.max_marks).toBe(50);
    expect(after!.passing_marks).toBe(20);
    expect(after!.due_days).toBe(3);
    expect(after!.allow_late_submission).toBe(true);
  });
});

describe("quiz lesson cleanup", () => {
  it("removes its questions when the lesson is deleted by the course cascade", async () => {
    const courseId = await createCourse({ instructor_id: ownerId, title: `Quiz cascade ${Date.now()}` });
    const sectionId = await createSection(courseId!, "S", "", 0);
    const l = await createLesson({ section_id: sectionId!, course_id: courseId!, title: "Q", content_type: "quiz" });
    await createQuizQuestion({ lesson_id: l!, question: "temp" });
    const { deleteCourse } = await import("@/lib/db/instructor/courses");
    await deleteCourse(courseId!, ownerId);
    const left = await sql<{ c: string }[]>`SELECT COUNT(*)::text AS c FROM quiz_questions WHERE lesson_id = ${l}`;
    expect(Number(left[0].c)).toBe(0);
  });
});

describe("lesson deletion removes its assignment", async () => {
  it("via the course cascade", async () => {
    const courseId = await createCourse({ instructor_id: ownerId, title: `Assign cascade ${Date.now()}` });
    const sectionId = await createSection(courseId!, "S", "", 0);
    const l = await createLesson({ section_id: sectionId!, course_id: courseId!, title: "A", content_type: "assignment" });
    await createAssignment({ lesson_id: l!, instructions: "do it" });
    const { deleteCourse } = await import("@/lib/db/instructor/courses");
    await deleteCourse(courseId!, ownerId);
    const left = await sql<{ c: string }[]>`SELECT COUNT(*)::text AS c FROM assignments WHERE lesson_id = ${l}`;
    expect(Number(left[0].c)).toBe(0);
  });
});
