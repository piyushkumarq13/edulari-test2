/**
 * Phase 2 task 7 verification: every column referenced by a SQL statement in the
 * new code must exist in the Postgres schema.
 *
 * Extracts `alias.column` references from every tagged-template sql query in
 * app/, lib/ and scripts/, maps each alias to a table via that query's
 * FROM/JOIN/INTO/UPDATE clauses, then checks the column against
 * information_schema. Also checks bare column identifiers in single-table
 * select lists (casts, subqueries and string literals are stripped first).
 *
 * Run: npm run verify-columns
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const root = process.argv[2] ?? process.cwd();

try {
  const envFile = path.join(root, ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* non-fatal */ }

function walk(dir: string, visit: (p: string) => void): void {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, visit);
    else if (/\.(ts|tsx)$/.test(e)) visit(p);
  }
}

/** Pull out the body of every sql`...` tagged template, dropping ${} interpolations. */
function extractQueries(src: string): string[] {
  const out: string[] = [];
  const re = /sql(?:<[^>]*>)?`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1].replace(/\$\{[^}]*\}/g, " "));
  return out;
}

const FUNCTIONS = new Set([
  "count", "avg", "sum", "coalesce", "extract", "cast", "now", "lower", "upper",
  "round", "greatest", "least", "nullif", "gen_random_uuid", "date_trunc", "filter",
]);

/** SQL keywords that can appear in a select list and are not columns. */
const SQL_WORDS = new Set([
  "as", "text", "int", "integer", "bigint", "smallint", "bool", "boolean", "varchar",
  "timestamptz", "jsonb", "json", "numeric", "real", "float", "double", "precision",
  "select", "from", "where", "group", "by", "order", "limit", "offset", "having",
  "and", "or", "not", "null", "true", "false", "case", "when", "then", "else", "end",
  "distinct", "all", "on", "using", "join", "inner", "left", "right", "full", "cross",
  "insert", "into", "values", "update", "set", "delete", "returning", "with", "asc",
  "desc", "exists", "in", "is", "default", "collate", "interval", "over", "partition",
  "lateral", "unnest", "array", "row", "at", "time", "zone", "day", "hour", "minute",
  "second", "month", "year", "epoch", "only", "similar", "ilike", "like", "escape",
  "any", "some", "ascending", "descending", "nulls", "first", "last", "conflict",
]);

/** Words that can follow FROM/JOIN and are never an alias. */
const NOT_ALIAS = new Set([
  "set", "where", "on", "select", "group", "order", "limit", "offset", "inner",
  "left", "right", "full", "cross", "using", "values", "and", "or", "as", "having",
  "returning", "from", "join", "only", "lateral",
]);

type Query = { file: string; sql: string };

const problems: string[] = [];
let checkedRefs = 0;

const files: string[] = [];
for (const d of ["app", "lib", "scripts"]) walk(path.join(root, d), (p) => { files.push(p); });

const queries: Query[] = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const q of extractQueries(src)) {
    if (!/\bfrom\b/i.test(q) && !/\bupdate\b/i.test(q) && !/\binsert into\b/i.test(q)) continue;
    queries.push({ file: path.relative(root, f), sql: q });
  }
}

const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("DATABASE_URL / DIRECT_URL is not set. Add it to .env.local and retry.");
  process.exit(1);
}
const sql = postgres(dbUrl, { prepare: false, max: 1 });

async function run(): Promise<void> {
  const colRows = (await sql`
    SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
  `) as Array<{ table_name: string; column_name: string }>;

  const byTable = new Map<string, Set<string>>();
  for (const r of colRows) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, new Set<string>());
    byTable.get(r.table_name)!.add(r.column_name);
  }

  for (const { file, sql: q } of queries) {
    // table -> alias
    const aliasMap = new Map<string, string>();
    const relRe = /\b(?:from|join|into|update)\s+(?:public\.)?([a-z_][a-z0-9_]*)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?/gi;
    let rm: RegExpExecArray | null;
    while ((rm = relRe.exec(q)) !== null) {
      const table = rm[1]!;
      let alias: string | undefined = rm[2];
      if (!alias || FUNCTIONS.has(alias.toLowerCase()) || NOT_ALIAS.has(alias.toLowerCase())) alias = undefined;
      if (!aliasMap.has(table)) aliasMap.set(table, alias ?? table);
    }

    const seen = new Set<string>();

    const refRe = /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi;
    let m2: RegExpExecArray | null;
    while ((m2 = refRe.exec(q)) !== null) {
      const a = m2[1]!.toLowerCase();
      const col = m2[2]!.toLowerCase();
      if (FUNCTIONS.has(a) || FUNCTIONS.has(col)) continue;
      const table = aliasMap.get(a);
      if (!table || !byTable.has(table)) continue;
      const key = `${table}.${col}`;
      if (seen.has(key)) continue;
      seen.add(key);
      checkedRefs++;
      if (!byTable.get(table)!.has(col)) problems.push(`${file}: ${key} (missing column)`);
    }

    // bare column identifiers in single-table select lists.
    // Skipped when the query has a derived table (`FROM ( ... ) alias`): the heuristic assumes
    // one physical table drives the select list, which is not true once a subquery is in play,
    // and it would then blame the subquery's output aliases on the inner table.
    const hasDerivedTable = /\bfrom\s*\(/i.test(q);
    // Only safe when the sole table is unaliased: with `FROM lessons l` the select list is
    // written in terms of the alias, and the bare-token pass would then report `l` itself as a
    // missing column of `lessons`.
    const soleAlias = aliasMap.size === 1 ? [...aliasMap.entries()][0]![1] : null;
    if (soleAlias !== null && soleAlias === [...aliasMap.keys()][0] && !hasDerivedTable) {
      const table = [...aliasMap.keys()][0]!;
      const cols = byTable.get(table);
      if (cols) {
        const bare = /select\s+([\s\S]+?)\s+from\s/i.exec(q);
        if (bare) {
          const list = bare[1]!
            .replace(/::\s*[a-z_][a-z0-9_ ]*/gi, " ")
            .replace(/\([^()]*\)/g, " ")
            .replace(/'[^']*'/g, " ")
            .replace(/"[^"]*"/g, " ")
            // Drop output aliases (`... AS foo`, `... foo`) so they are not mistaken
            // for columns of the single table in the FROM clause.
            .replace(/\bas\s+[a-z_][a-z0-9_]*/gi, " ")
            .replace(/[^a-z0-9_,\s]/gi, " ");
          for (const raw of list.split(/[\s,]+/)) {
            const col = raw.toLowerCase();
            if (!/^[a-z_][a-z0-9_]*$/.test(col)) continue;
            if (FUNCTIONS.has(col) || SQL_WORDS.has(col)) continue;
            const key = `${table}.${col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            checkedRefs++;
            if (!cols.has(col)) problems.push(`${file}: ${key} (missing column)`);
          }
        }
      }
    }
  }

  await sql.end({ timeout: 5 });
}

void run()
  .then(() => {
    console.log(`scanned ${queries.length} SQL statement(s) in ${files.length} file(s)`);
    console.log(`checked ${checkedRefs} column reference(s)`);
    if (problems.length === 0) {
      console.log("\nOK: every referenced column exists in the schema.");
    } else {
      console.log(`\n${problems.length} problem(s):`);
      for (const p of problems) console.log("  " + p);
    }
    process.exit(problems.length === 0 ? 0 : 1);
  })
  .catch((err: unknown) => {
    console.error("verify-columns failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
