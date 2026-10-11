// lib/config.ts validates the environment at import time, so these must be set before the
// modules under test are loaded (import hoisting means this has to be a side-effect import).
import "./helpers/env";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "@/lib/db/client";
import { createSlug, ensureUniqueSlug, createCourse, getCourseById, updateCourse } from "@/lib/db/instructor/courses";

let aliceId = 0;
let bobId = 0;

beforeAll(async () => {
  const suffix = Date.now();
  const [a] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Slug Alice', ${`slug-a-${suffix}@edulari.test`}, 'x', 'instructor', true, true)
    RETURNING id`;
  const [b] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Slug Bob', ${`slug-b-${suffix}@edulari.test`}, 'x', 'instructor', true, true)
    RETURNING id`;
  aliceId = a.id;
  bobId = b.id;
});

afterAll(async () => {
  const ids = [aliceId, bobId].filter(Boolean);
  if (ids.length) {
    await sql`DELETE FROM courses WHERE instructor_id IN ${sql(ids)}`;
    await sql`DELETE FROM users WHERE id IN ${sql(ids)}`;
  }
});

describe("createSlug", () => {
  it("lowercases and replaces every non-alphanumeric run with one dash", () => {
    expect(createSlug("Complete Web Development Bootcamp")).toBe("complete-web-development-bootcamp");
    expect(createSlug("React & Node.js: The Guide")).toBe("react-node-js-the-guide");
  });

  it("trims leading and trailing dashes", () => {
    expect(createSlug("  --Hello World--  ")).toBe("hello-world");
  });

  it("collapses repeated dashes", () => {
    expect(createSlug("a   b")).toBe("a-b");
  });

  it("leaves an already-slugified title untouched", () => {
    expect(createSlug("already-a-slug")).toBe("already-a-slug");
  });
});

describe("slug uniqueness", () => {
  it("reuses a free slug", async () => {
    const slug = await ensureUniqueSlug(`Unique Free ${Date.now()}`);
    expect(slug.startsWith("unique-free-")).toBe(true);
  });

  it("suffixes a taken slug with the unix timestamp", async () => {
    // The PHP appended time(), so two calls inside the same second legitimately collide.
    // Insert a row first, then assert the fallback differs from the clean slug.
    const title = `Taken ${Date.now()}`;
    const [courseId] = await sql<{ id: number }[]>`
      INSERT INTO courses (instructor_id, title, slug, created_at, updated_at)
      VALUES (${aliceId}, ${title}, ${createSlug(title)}, now(), now())
      RETURNING id`;
    const second = await ensureUniqueSlug(title);
    expect(second).not.toBe(createSlug(title));
    expect(second).toMatch(/^taken-\d+-\d+$/);
    await sql`DELETE FROM courses WHERE id = ${courseId.id}`;
  });

  it("keeps a course's own slug when re-saving an unchanged title", async () => {
    const title = `Stable ${Date.now()}`;
    const courseId = await createCourse({ instructor_id: aliceId, title, category_id: null });
    expect(courseId).toBeTruthy();
    const own = await ensureUniqueSlug(title, courseId!);
    expect(own).toBe(createSlug(title));
    await sql`DELETE FROM courses WHERE id = ${courseId}`;
  });

  it("gives two courses with the same title different slugs", async () => {
    const title = `Twin ${Date.now()}`;
    const first = await createCourse({ instructor_id: aliceId, title });
    const second = await createCourse({ instructor_id: aliceId, title });
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    const rows = await sql<{ slug: string }[]>`SELECT slug FROM courses WHERE id IN ${sql([first!, second!])}`;
    expect(new Set(rows.map((r) => r.slug)).size).toBe(2);
    await sql`DELETE FROM courses WHERE id IN ${sql([first!, second!])}`;
  });
});

describe("createCourse defaults", () => {
  it("starts unpublished with a certificate and a passing score of 70", async () => {
    const courseId = await createCourse({ instructor_id: aliceId, title: `Defaults ${Date.now()}` });
    const course = await getCourseById(courseId!);
    expect(course).toBeTruthy();
    expect(course!.is_published).toBe(false);
    expect(course!.certificate_enabled).toBe(true);
    expect(course!.passing_percentage).toBe(70);
    expect(course!.level).toBe("beginner");
    expect(course!.language).toBe("English");
    await sql`DELETE FROM courses WHERE id = ${courseId}`;
  });

  it("records the instructor that owns it", async () => {
    const courseId = await createCourse({ instructor_id: bobId, title: `Owned ${Date.now()}` });
    expect((await getCourseById(courseId!, bobId))?.instructor_id).toBe(bobId);
    await sql`DELETE FROM courses WHERE id = ${courseId}`;
  });

  it("reports no changes when the submitted values match the stored row", async () => {
    const title = `Stable Title ${Date.now()}`;
    const courseId = (await createCourse({ instructor_id: aliceId, title }))!;
    const before = await getCourseById(courseId, aliceId);

    const same = await updateCourse(
      courseId,
      {
        title,
        short_description: before!.short_description ?? "",
        description: before!.description ?? "",
        category_id: before!.category_id === null ? null : Number(before!.category_id),
        level: before!.level ?? "beginner",
        language: before!.language ?? "english",
        duration_hours: String(before!.duration_hours ?? 0),
        price: String(before!.price ?? 0),
        certificate_enabled: before!.certificate_enabled ? 1 : 0,
        passing_percentage: before!.passing_percentage ?? 0,
      },
      aliceId,
    );

    expect(same.ok).toBe(true);
    // Postgres reports a row for every UPDATE, so updateCourse compares values first; without
    // that the "No changes to save." branch would never be reachable.
    expect(same.rowsAffected).toBe(0);
    expect((await getCourseById(courseId, aliceId))?.slug).toBe(before!.slug);

    const changed = await updateCourse(courseId, { title: `${title} Renamed` }, aliceId);
    expect(changed.rowsAffected).toBe(1);
    expect((await getCourseById(courseId, aliceId))?.slug).not.toBe(before!.slug);

    await sql`DELETE FROM courses WHERE id = ${courseId}`;
  });
});