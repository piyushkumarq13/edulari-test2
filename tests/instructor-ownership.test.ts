// lib/config.ts validates the environment at import time, so these must be set before the
// modules under test are loaded (import hoisting means this has to be a side-effect import).
import "./helpers/env";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "@/lib/db/client";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  toggleCoursePublish,
  getCourseById,
  getCourseStats,
  getInstructorCourses,
} from "@/lib/db/instructor/courses";
import { createSection, getCourseSections, updateSection, deleteSection } from "@/lib/db/instructor/sections";
import {
  createLesson,
  updateLesson,
  deleteLesson,
  getLessonById,
  getSectionLessons,
  nextLessonOrder,
  normaliseVideoUrl,
  youtubeIdFromUrl,
} from "@/lib/db/instructor/lessons";
import { getCourseDetailedAnalytics, getCourseStudentProgress } from "@/lib/db/instructor/analytics";

let aliceId = 0;
let bobId = 0;
let aliceCourse = 0;

beforeAll(async () => {
  const suffix = Date.now();
  const [a] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Owner Alice', ${`own-a-${suffix}@edulari.test`}, 'x', 'instructor', true, true)
    RETURNING id`;
  const [b] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Owner Bob', ${`own-b-${suffix}@edulari.test`}, 'x', 'instructor', true, true)
    RETURNING id`;
  aliceId = a.id;
  bobId = b.id;
  const courseId = await createCourse({ instructor_id: aliceId, title: `Ownership ${suffix}` });
  aliceCourse = courseId!;
});

afterAll(async () => {
  const ids = [aliceId, bobId].filter(Boolean);
  if (ids.length) {
    await sql`DELETE FROM courses WHERE instructor_id IN ${sql(ids)}`;
    await sql`DELETE FROM users WHERE id IN ${sql(ids)}`;
  }
});

describe("course ownership", () => {
  it("hides another instructor's course", async () => {
    expect(await getCourseById(aliceCourse, aliceId)).toBeTruthy();
    expect(await getCourseById(aliceCourse, bobId)).toBeNull();
  });

  it("refuses an update from another instructor", async () => {
    const result = await updateCourse(aliceCourse, { title: "Hijacked" }, bobId);
    expect(result.ok).toBe(false);
    expect((await getCourseById(aliceCourse))!.title).not.toBe("Hijacked");
  });

  it("refuses publish and unpublish from another instructor", async () => {
    expect(await toggleCoursePublish(aliceCourse, bobId, true)).toBe(false);
    expect((await getCourseById(aliceCourse))!.is_published).toBe(false);
  });

  it("refuses deletion from another instructor", async () => {
    expect(await deleteCourse(aliceCourse, bobId)).toBe(false);
    expect(await getCourseById(aliceCourse)).toBeTruthy();
  });

  it("lets the owner publish", async () => {
    expect(await toggleCoursePublish(aliceCourse, aliceId, true)).toBe(true);
    expect((await getCourseById(aliceCourse))!.is_published).toBe(true);
    expect((await getCourseById(aliceCourse))!.published_at).toBeTruthy();
    await toggleCoursePublish(aliceCourse, aliceId, false);
    expect((await getCourseById(aliceCourse))!.published_at).toBeNull();
  });

  it("never lists another instructor's courses", async () => {
    const mine = await getInstructorCourses(aliceId);
    expect(mine.every((c) => String(c.id) === String(aliceCourse))).toBe(true);
    const theirs = await getInstructorCourses(bobId);
    expect(theirs.some((c) => String(c.id) === String(aliceCourse))).toBe(false);
  });

  it("returns null stats and analytics for a course you do not own", async () => {
    expect(await getCourseStats(aliceCourse, bobId)).toBeNull();
    expect(await getCourseDetailedAnalytics(aliceCourse, bobId)).toBeNull();
    expect(await getCourseStudentProgress(aliceCourse, bobId)).toBeNull();
  });
});

describe("section ownership", () => {
  it("returns an empty list when the course is not yours", async () => {
    expect(await getCourseSections(aliceCourse, bobId)).toEqual([]);
  });

  it("scopes update and delete by course", async () => {
    const sectionId = await createSection(aliceCourse, "Scoped", "", 0);
    expect(await updateSection(sectionId!, 999999, { title: "Nope" })).toBe(false);
    expect(await deleteSection(sectionId!, 999999)).toBe(false);
    expect((await getCourseSections(aliceCourse, aliceId))[0].title).toBe("Scoped");
    expect(await deleteSection(sectionId!, aliceCourse)).toBe(true);
  });
});

describe("lesson ownership and ordering", () => {
  it("scopes update and delete by course", async () => {
    const sectionId = await createSection(aliceCourse, "Lessons", "", 0);
    const lessonId = await createLesson({
      section_id: sectionId!,
      course_id: aliceCourse,
      title: "Intro",
      content_type: "video",
    });
    expect(await updateLesson(lessonId!, 999999, { title: "Nope" })).toBe(false);
    expect(await deleteLesson(lessonId!, 999999)).toBe(false);
    expect(await updateLesson(lessonId!, aliceCourse, { title: "Renamed" })).toBe(true);
    expect((await getLessonById(lessonId!, aliceCourse))!.title).toBe("Renamed");
    await deleteLesson(lessonId!, aliceCourse);
    await deleteSection(sectionId!, aliceCourse);
  });

  it("appends the next lesson order as the section count", async () => {
    const sectionId = await createSection(aliceCourse, "Ordering", "", 0);
    expect(await nextLessonOrder(sectionId!, aliceCourse)).toBe(0);
    const first = await createLesson({ section_id: sectionId!, course_id: aliceCourse, title: "L1", content_type: "text", sort_order: await nextLessonOrder(sectionId!, aliceCourse) });
    expect(await nextLessonOrder(sectionId!, aliceCourse)).toBe(1);
    await deleteLesson(first!, aliceCourse);
    await deleteSection(sectionId!, aliceCourse);
  });

  it("does not read another course's lessons through a section id", async () => {
    const sectionId = await createSection(aliceCourse, "Isolated", "", 0);
    expect(await getSectionLessons(sectionId!, 999999)).toEqual([]);
    await deleteSection(sectionId!, aliceCourse);
  });
});

describe("video url normalisation", () => {
  it("extracts a YouTube id from the link shapes the PHP accepted", () => {
    expect(youtubeIdFromUrl("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeIdFromUrl("https://www.youtube.com/embed/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeIdFromUrl("https://www.youtube-nocookie.com/shorts/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeIdFromUrl('<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>')).toBe("abcdefghijk");
  });

  it("returns null for a non-YouTube link", () => {
    expect(youtubeIdFromUrl("https://vimeo.com/12345")).toBeNull();
    expect(youtubeIdFromUrl("https://example.com/video.mp4")).toBeNull();
    expect(youtubeIdFromUrl("")).toBeNull();
  });

  it("rewrites a YouTube link to the canonical watch URL", () => {
    expect(normaliseVideoUrl("https://youtu.be/abcdefghijk")).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });

  it("leaves a direct or Vimeo link untouched", () => {
    expect(normaliseVideoUrl("https://example.com/video.mp4")).toBe("https://example.com/video.mp4");
    expect(normaliseVideoUrl("https://vimeo.com/12345")).toBe("https://vimeo.com/12345");
  });
});

describe("deleteCourse cascade", () => {
  it("removes the course together with its sections and lessons", async () => {
    const courseId = await createCourse({ instructor_id: bobId, title: `Cascade ${Date.now()}` });
    const sectionId = await createSection(courseId!, "S", "", 0);
    await createLesson({ section_id: sectionId!, course_id: courseId!, title: "L", content_type: "text" });
    expect(await deleteCourse(courseId!, bobId)).toBe(true);
    expect(await getCourseById(courseId!)).toBeNull();
    const remaining = await sql<{ c: string }[]>`SELECT COUNT(*)::text AS c FROM course_sections WHERE course_id = ${courseId}`;
    expect(Number(remaining[0].c)).toBe(0);
    const lessons = await sql<{ c: string }[]>`SELECT COUNT(*)::text AS c FROM lessons WHERE course_id = ${courseId}`;
    expect(Number(lessons[0].c)).toBe(0);
  });
});