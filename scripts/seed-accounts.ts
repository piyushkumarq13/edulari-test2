/**
 * scripts/seed-accounts.ts — npm run seed:accounts
 *
 * Creates one verified, active account per role so every area can be logged into directly:
 *
 *   student   -> can browse, enrol, take courses
 *   instructor-> role = 'instructor' PLUS an approved instructor_applications row, which is
 *                what requireInstructorApproved() checks. A bare users.role = 'instructor'
 *                row is NOT enough: the instructor panel redirects to /instructor-register.
 *   admin     -> /admin/**
 *
 *   npm run seed:accounts
 *
 * Idempotent: every write is keyed on the email, so running it twice updates in place and
 * never duplicates a row. Passwords are bcrypt cost 10 (PHP PASSWORD_DEFAULT).
 *
 * The credentials below are development/demo accounts. Change the password before using
 * these addresses for anything real, and never run this against production.
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

const DEMO_PASSWORD = "Pkc841428";

type Spec = {
  role: "student" | "instructor" | "admin";
  name: string;
  email: string;
  profileCompleted: boolean;
};

const ACCOUNTS: Spec[] = [
  {
    role: "student",
    name: "Piyush Official",
    email: "piyushofficial67@gmail.com",
    profileCompleted: true,
  },
  {
    role: "instructor",
    name: "Akash Kumar",
    email: "akashkumar568k@gmail.com",
    profileCompleted: true,
  },
  {
    role: "admin",
    name: "Piyush Chaurasiya",
    email: "piyushchaurasiya805@gmail.com",
    profileCompleted: true,
  },
];

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL / DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const hash = hashPassword(DEMO_PASSWORD);
  const sql = postgres(url, { prepare: false, max: 1 });
  const created: string[] = [];
  const updated: string[] = [];

  try {
    for (const a of ACCOUNTS) {
      const existing = await sql<{ id: number }[]>`
        SELECT id FROM public.users WHERE email = ${a.email}
      `;

      let userId: number;
      if (existing.length === 0) {
        const rows = await sql<{ id: number }[]>`
          INSERT INTO public.users
            (name, email, password, role, email_verified, is_active, profile_completed, registration_date, last_login)
          VALUES (${a.name}, ${a.email}, ${hash}, ${a.role}, true, true, ${a.profileCompleted}, now(), NULL)
          RETURNING id
        `;
        userId = rows[0].id;
        created.push(`${a.role.padEnd(10)} ${a.email}`);
      } else {
        userId = existing[0].id;
        // Re-running resets the password and makes sure the account is usable.
        await sql`
          UPDATE public.users
          SET name = ${a.name}, password = ${hash}, role = ${a.role},
              email_verified = true, is_active = true, profile_completed = ${a.profileCompleted},
              block_reason = NULL, block_note = NULL
          WHERE id = ${userId}
        `;
        updated.push(`${a.role.padEnd(10)} ${a.email}`);
      }

      // The instructor panel is gated on the latest application being 'approved'.
      // Upsert rather than insert so a re-run cannot leave a duplicate pending row
      // shadowing the approval.
      if (a.role === "instructor") {
        const app = await sql<{ id: number; status: string }[]>`
          SELECT id, status FROM public.instructor_applications
          WHERE user_id = ${userId} ORDER BY submitted_at DESC LIMIT 1
        `;
        if (app.length === 0) {
          // professional_exp and course_ideas are NOT NULL; the rest have defaults but are
          // filled in so the instructor profile page is not blank.
          await sql`
            INSERT INTO public.instructor_applications
              (user_id, institution, field_of_study, highest_education, professional_exp,
               notable_works, primary_subject, secondary_subjects, skill_level,
               target_audience, course_ideas, full_legal_name, revenue_share_ack,
               terms_agreed, content_policy, profile_headline, profile_bio, profile_years_exp,
               status, submitted_at, reviewed_at, test_score)
            VALUES (
              ${userId}, 'Independent', 'Computer Science', 'B.Tech', '5',
              '', 'Computer Science', 'Web Development, Data Structures', 'expert',
              'Beginners to intermediate developers',
              'Practical, project-based web development courses.',
              ${a.name}, true, true, true,
              'Software engineer and instructor',
              'Teaches practical, project-based engineering courses.', '5',
              'approved', now(), now(), 90
            )
          `;
        } else if (app[0].status !== "approved") {
          await sql`
            UPDATE public.instructor_applications
            SET status = 'approved', reviewed_at = now()
            WHERE id = ${app[0].id}
          `;
        }
      }
    }

    // Print the resulting state so the operator can confirm what exists.
    const rows = await sql<{ name: string; email: string; role: string }[]>`
      SELECT name, email, role FROM public.users
      WHERE email IN ${sql(ACCOUNTS.map((a) => a.email))}
      ORDER BY role
    `;
    console.log("Accounts in the database now:");
    for (const r of rows) console.log(`  ${r.role.padEnd(10)} ${r.email.padEnd(38)} ${r.name}`);

    if (created.length) console.log(`\ncreated: ${created.length}\n  ${created.join("\n  ")}`);
    if (updated.length) console.log(`\nupdated: ${updated.length}\n  ${updated.join("\n  ")}`);

    const app = await sql<{ status: string }[]>`
      SELECT ia.status FROM public.instructor_applications ia
      JOIN public.users u ON u.id = ia.user_id
      WHERE u.email = ${ACCOUNTS[1].email}
      ORDER BY ia.submitted_at DESC LIMIT 1
    `;
    console.log(`\ninstructor application status: ${app[0]?.status ?? "none"}`);
    console.log(`\npassword for all three: ${DEMO_PASSWORD}`);
    console.log("Change these before using the addresses for anything real.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});