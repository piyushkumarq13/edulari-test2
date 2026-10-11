/**
 * Dev-only demo content, so the Phase 5 student flows (browse -> cart -> checkout ->
 * enroll -> receipt) have something real to exercise before the admin/instructor
 * course-management screens exist (Phase 6+).
 *
 *   npm run seed:content          # insert if missing
 *   npm run seed:content -- --reset   # delete the demo rows first, then insert
 *
 * This is a DEVELOPMENT convenience, not app data and not a code stub: the app reads
 * exactly the same rows it would read in production. It is idempotent - every insert
 * is keyed on the demo slug/email, so running it twice does not duplicate anything.
 *
 * It also creates one demo student so you can log straight into the buying journey
 * without waiting for an email verification round trip. The password is printed.
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/passwords";

for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
}

const RESET = process.argv.includes("--reset");
const DUMP_SQL = (() => {
  const i = process.argv.indexOf("--dump-sql");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
})();
const DEMO_EMAIL = process.env.DEMO_STUDENT_EMAIL ?? "student@edulari.test";
const DEMO_PASSWORD = process.env.DEMO_STUDENT_PASSWORD ?? "Edulari!Test2026";

const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DIRECT_URL or DATABASE_URL is not set in .env.local");
  process.exit(1);
}
const CONNECTION_URL: string = rawUrl;
const sql = postgres(CONNECTION_URL, { prepare: false, max: 1 });

type CategorySeed = readonly [name: string, slug: string, description: string];
type CourseSeed = readonly [
  slugBase: string,
  categorySlug: string,
  title: string,
  price: number,
  level: string,
  durationHours: number,
  blurb: string,
];

const CATEGORIES: CategorySeed[] = [
  ["Web Development", "web-development", "HTML, CSS, JavaScript, frameworks and everything that runs in a browser."],
  ["Data Science", "data-science", "Python, statistics, machine learning and data engineering."],
  ["Design", "design", "UI/UX, graphic design, motion and design systems."],
  ["Business", "business", "Marketing, finance, productivity and entrepreneurship."],
];

// slug, category slug, title, price, level, duration hours, blurb
const COURSES: CourseSeed[] = [
  ["modern-react-typescript", "web-development", "Modern React with TypeScript", 2499, "intermediate", 14, "Build production React apps with hooks, suspense, server components and a strict TypeScript setup."],
  ["css-layout-mastery", "web-development", "CSS Layout Mastery", 1499, "beginner", 8, "Grid, flexbox, container queries and the layout bugs that ruin otherwise good designs."],
  ["nodejs-apis-postgres", "web-development", "Node.js APIs with PostgreSQL", 2999, "advanced", 18, "Design, secure and ship a JSON API on Node with Postgres, transactions and query planning."],
  ["python-for-data", "data-science", "Python for Data Analysis", 1999, "beginner", 10, "NumPy, pandas and matplotlib for turning messy spreadsheets into decisions."],
  ["machine-learning-foundations", "data-science", "Machine Learning Foundations", 3499, "intermediate", 20, "From linear regression to gradient boosting, with the maths kept readable."],
  ["sql-analytics", "data-science", "SQL Analytics in Practice", 1299, "beginner", 7, "Window functions, CTEs and the query patterns analysts actually use."],
  ["ui-design-systems", "design", "Design Systems That Scale", 2799, "intermediate", 12, "Tokens, components, documentation and the governance that keeps a system alive."],
  ["figma-masterclass", "design", "Figma Masterclass", 1799, "beginner", 9, "Auto layout, components, prototyping and handing off to developers."],
  ["digital-marketing", "business", "Digital Marketing Fundamentals", 999, "beginner", 6, "SEO, email, paid and social - with a budget you can actually afford."],
  ["freelance-business", "business", "Running a Freelance Business", 2199, "intermediate", 11, "Pricing, contracts, taxes and finding clients without cold-calling."],
  ["free-frontend-basics", "web-development", "Frontend Basics (Free)", 0, "beginner", 5, "A free starter course on semantic HTML, CSS and browser devtools."],
  ["free-python-starter", "data-science", "Python Starter (Free)", 0, "beginner", 4, "Write your first program and learn the core syntax without paying anything."],
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const adminRows = await sql`SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`;
  if (!adminRows.length) {
    console.error("No admin user found. Run `npm run create-admin` first - courses need an instructor_id.");
    process.exit(1);
  }
  const instructorId = String(adminRows[0].id);
  console.log(`attributing demo courses to user ${instructorId} (${adminRows[0].email})\n`);

  if (RESET) {
    const slugs = COURSES.map((c) => slugify(c[0]));
    await sql`DELETE FROM courses WHERE slug IN ${sql(slugs)}`;
    await sql`DELETE FROM categories WHERE slug IN ${sql(CATEGORIES.map((c) => c[1]))}`;
    console.log("--reset: removed previous demo categories/courses");
  }

  // ── Categories ───────────────────────────────────────────────────────────
  const categoryIds = new Map<string, string>();
  for (const [name, slug, description] of CATEGORIES) {
    const rows = await sql`
      INSERT INTO categories (name, slug, description)
      VALUES (${name}, ${slug}, ${description})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
      RETURNING id`;
    categoryIds.set(slug, String(rows[0].id));
  }
  console.log(`categories: ${categoryIds.size}`);

  // ── Courses + sections + lessons ─────────────────────────────────────────
  let created = 0;
  let existed = 0;
  for (const [slugBase, catSlug, title, price, level, hours, blurb] of COURSES) {
    const slug = slugify(slugBase);
    const existing = await sql`SELECT id FROM courses WHERE slug = ${slug}`;
    if (existing.length) {
      existed++;
      continue;
    }

    const categoryId = categoryIds.get(catSlug);
    if (!categoryId) {
      console.error(`unknown category slug in COURSES: ${catSlug}`);
      process.exit(1);
    }

    const rows = await sql`
      INSERT INTO courses
        (instructor_id, category_id, title, slug, description, short_description, level,
         price, duration_hours, is_published, is_featured, certificate_enabled, created_at, published_at)
      VALUES (${instructorId}, ${categoryId}, ${title}, ${slug}, ${blurb}, ${blurb.slice(0, 160)},
              ${level}, ${price}, ${hours}, true, ${slugBase === "modern-react-typescript"}, true, now(), now())
      RETURNING id`;
    const courseId = String(rows[0].id);
    created++;

    // Two sections, three lessons each, so /student/learn has real navigation.
    for (let s = 1; s <= 2; s++) {
      const section = await sql`
        INSERT INTO course_sections (course_id, title, sort_order)
        VALUES (${courseId}, ${`Section ${s}: ${s === 1 ? "Foundations" : "Putting it together"}`}, ${s})
        RETURNING id`;
      for (let l = 1; l <= 3; l++) {
        const n = (s - 1) * 3 + l;
        await sql`
          INSERT INTO lessons (course_id, section_id, title, content_type, content_text, sort_order, is_free_preview)
          VALUES (${courseId}, ${String(section[0].id)},
                  ${`${n}. ${l === 1 ? "Overview" : l === 2 ? "Core concepts" : "Hands-on walkthrough"}`},
                  ${l === 1 ? "video" : "text"},
                  ${`## ${title} - lesson ${n}\n\nDemo content for local testing. Replace it from the instructor area once Phase 6 lands.`},
                  ${n}, ${n === 1})`;
      }
    }
  }
  console.log(`courses: ${created} created, ${existed} already present`);

  // ── Demo student so you can log in and buy immediately ────────────────────
  const hash = await hashPassword(DEMO_PASSWORD);
  await sql`
    INSERT INTO users (name, email, password, role, is_active, email_verified, profile_completed, registration_date)
    VALUES (${"Demo Student"}, ${DEMO_EMAIL}, ${hash}, 'student', true, true, true, now())
    ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, email_verified = true, is_active = true`;
  console.log(`\ndemo student:`);
  console.log(`  email    : ${DEMO_EMAIL}`);
  console.log(`  password : ${DEMO_PASSWORD}`);
  console.log(`\nAlso put a few free courses in the cart so you can test the free-enroll path:`);
  console.log(`  the two "Free" courses above are price 0 - add them from /browse-courses`);

  console.log("\ndone.");

  if (DUMP_SQL) {
    // Mirror the same rows into the local MariaDB copy of the old site so
    // `npm run ui-compare` sees identical content on both sides.
    // bcryptjs hashes are accepted by PHP's password_verify().
    const dumpUrl = CONNECTION_URL;
    const sql2 = postgres(dumpUrl, { prepare: false, max: 1 });
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return String(v);
      return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
    };
    const out: string[] = [
      "-- Generated by `npm run seed:content -- --dump-sql`.",
      "-- Mirrors the demo content into the local MariaDB used to run the old PHP site.",
      `-- demo student: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
      "SET FOREIGN_KEY_CHECKS = 0;",
      "",
      "INSERT INTO users (name, email, password, role, is_active, email_verified, profile_completed, registration_date) VALUES",
      `  ('Demo Student', ${esc(DEMO_EMAIL)}, ${esc(hash)}, 'student', 1, 1, 1, NOW())`,
      `  ON DUPLICATE KEY UPDATE password = VALUES(password), email_verified = 1, is_active = 1;`,
      "",
    ];

    const catRows = await sql2`SELECT id, name, slug, description FROM categories ORDER BY id`;
    out.push("-- categories");
    for (const c of catRows) {
      out.push(
        `INSERT INTO categories (name, slug, description) VALUES (${esc(c.name)}, ${esc(c.slug)}, ${esc(c.description)});`,
      );
    }
    out.push("");

    const courseRows = await sql2`
      SELECT c.id, c.title, c.slug, c.description, c.short_description, c.level, c.price,
             c.duration_hours, c.category_id, cat.slug AS cat_slug
      FROM courses c LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.slug LIKE 'p5-%' OR c.slug IN ${sql2(COURSES.map((c2) => slugify(c2[0])))}
      ORDER BY c.id`;
    out.push("-- courses");
    for (const c of courseRows) {
      out.push(
        `INSERT INTO courses (instructor_id, category_id, title, slug, description, short_description, level, price, duration_hours, is_published, is_featured, certificate_enabled, created_at, published_at)` +
          ` SELECT u.id, (SELECT id FROM categories WHERE slug = ${esc(c.cat_slug)}), ${esc(c.title)}, ${esc(c.slug)}, ${esc(c.description)}, ${esc(c.short_description)}, ${esc(c.level)}, ${c.price}, ${c.duration_hours ?? 0}, 1, 0, 1, NOW(), NOW()` +
          ` FROM users u WHERE u.email = ${esc(DEMO_EMAIL)}` +
          ` ON DUPLICATE KEY UPDATE title = VALUES(title), price = VALUES(price);`,
      );
    }
    out.push("");

    const sectionRows = await sql2`
      SELECT s.id, s.course_id, s.title, s.sort_order, c.slug AS course_slug
      FROM course_sections s JOIN courses c ON c.id = s.course_id
      WHERE c.slug IN ${sql2(COURSES.map((c2) => slugify(c2[0])))}
      ORDER BY s.id`;
    out.push("-- course sections");
    for (const s of sectionRows) {
      out.push(
        `INSERT INTO course_sections (course_id, title, sort_order) VALUES ((SELECT id FROM courses WHERE slug = ${esc(s.course_slug)}), ${esc(s.title)}, ${s.sort_order ?? 0});`,
      );
    }
    out.push("");

    const lessonRows = await sql2`
      SELECT l.title, l.content_type, l.content_text, l.sort_order, l.is_free_preview, c.slug AS course_slug
      FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE c.slug IN ${sql2(COURSES.map((c2) => slugify(c2[0])))}
      ORDER BY c.id, l.sort_order`;
    out.push("-- lessons");
    for (const l of lessonRows) {
      out.push(
        `INSERT INTO lessons (course_id, section_id, title, content_type, content_text, sort_order, is_free_preview) VALUES` +
          ` ((SELECT id FROM courses WHERE slug = ${esc(l.course_slug)}),` +
          `  (SELECT MIN(id) FROM course_sections WHERE course_id = (SELECT id FROM courses WHERE slug = ${esc(l.course_slug)})),` +
          `  ${esc(l.title)}, ${esc(l.content_type)}, ${esc(l.content_text)}, ${l.sort_order ?? 0}, ${l.is_free_preview ? 1 : 0});`,
      );
    }
    out.push("", "SET FOREIGN_KEY_CHECKS = 1;", "");

    fs.writeFileSync(DUMP_SQL, out.join("\n"), "utf8");
    console.log(`\nMySQL mirror written to ${DUMP_SQL} (${out.length} lines)`);
    await sql2.end({ timeout: 5 });
  }

  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
