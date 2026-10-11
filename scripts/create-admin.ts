import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import bcrypt from "bcryptjs";

try {
  const envFile = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
} catch {}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q: string) =>
  new Promise<string>((resolve) => rl.question(q, (a) => resolve(a.trim())));

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    console.error("DIRECT_URL is not set in .env.local");
    process.exit(1);
  }

  const name = await ask("Name: ");
  const email = await ask("Email: ");
  const password = await ask("Password: ");

  if (!name || !email || !password) {
    console.error("Name, email and password are required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10); // PHP PASSWORD_DEFAULT bcrypt cost
  const sql = postgres(directUrl, { prepare: false, max: 1 });
  try {
    const existing = await sql`SELECT id FROM public.users WHERE email = ${email}`;
    if (existing.length > 0) {
      console.log("A user with that email already exists. Aborting.");
      process.exitCode = 1;
      return;
    }
    await sql`
      INSERT INTO public.users (name, email, password, role, email_verified, is_active, profile_completed, registration_date)
      VALUES (${name}, ${email}, ${hash}, 'admin', true, true, true, now())
    `;
    console.log("Admin user created.");
  } finally {
    await sql.end();
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  rl.close();
  process.exit(1);
});
