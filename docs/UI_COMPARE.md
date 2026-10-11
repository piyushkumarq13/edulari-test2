# UI parity comparison (npm run ui-compare)

Plain text. This is the tool behind the UI PARITY GATE in `AGENTS.md` §14: any phase
that builds pages must run it for its pages and reach zero mismatches above tolerance.

You cannot view images, so this tool works entirely on numbers: computed styles and
bounding boxes read out of both live DOMs, plus a pixelmatch percentage and the five
largest differing regions with the element responsible.

## 1. What it compares

For every page in `scripts/ui-compare/config.mjs` at every viewport:

- **Computed styles** for every paired element: display/position/offsets, width/height,
  min/max, margins, paddings, borders + border colours + radii, box-sizing, overflow,
  font-family/size/weight/style/line-height/letter-spacing, text-align/transform/
  decoration/white-space, colour, background colour/image/size/position/repeat,
  box-shadow, opacity, transform, z-index, visibility, gap/row-gap/column-gap, grid
  template, flex properties, list-style, vertical-align, object-fit, aspect-ratio,
  transition-duration, animation-name.
- **Geometry**: x, y, width, height of every element.
- **Page level**: total page height, horizontal overflow (`scrollWidth - clientWidth`),
  HTTP status, redirects, `<title>`, meta description, the list of stylesheets actually
  applied, the font families in use, and every image's rendered vs natural size.
- **Elements present in only one DOM** (missing / extra), so a dropped wrapper or an
  extra navbar shows up even when no style happens to differ.
- **Screenshots**: full page on both sides, compared with `pixelmatch`; the diff PNG
  and the percentage are written per page+viewport.

Tolerances: positions and sizes within **1px**; colours compared **exactly**; everything
else string-exact.

## 2. Run the OLD PHP site locally

The old site needs PHP and MySQL/MariaDB. **Neither is currently installed on this
machine** (checked: no `php` on PATH, no `C:\xampp\php\php.exe`, no `mysql` service),
so the numeric comparison cannot run until they are.

Install XAMPP (https://www.apachefriends.org) and start Apache + MySQL from it, then:

1. Copy the old site OUTSIDE both projects:

       Copy-Item -Recurse "C:\Users\piyus\Desktop\htdocs (7)\htdocs" `
                            "C:\Users\piyus\Desktop\htdocs (7)\_oldsite_run"

2. In the COPY ONLY, edit `private\db.php` to point at a local database
   (`127.0.0.1`, user `root`, empty password, database `edulari_local`) and create it:

       C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE edulari_local CHARACTER SET utf8mb4"
       C:\xampp\mysql\bin\mysql.exe -u root edulari_local < "C:\Users\piyus\Desktop\htdocs (7)\Edulari\docs\schema\mysql_schema.txt"

3. Make outgoing calls harmless in the copy: set `SMTP_HOST` in `private\config.php` to
   an unroutable value (`127.0.0.1`) and replace `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
   with dummy strings. Never point the copy at the live credentials or production DB.

4. Serve the copy on port 8080. PHP's built-in server has no `.htaccess`, so use the
   bundled router, which reproduces the clean-URL rewrites from the two `.htaccess`
   files (`.php` stripped, `/course/{slug}`, `/category/{slug}`, `/index.php` -> `/`):

       C:\xampp\php\php.exe -S 127.0.0.1:8080 -t "C:\Users\piyus\Desktop\htdocs (7)\_oldsite_run\public" `
                              "C:\Users\piyus\Desktop\htdocs (7)\Edulari\scripts\ui-compare\php-router.php"

5. Log in once on `http://127.0.0.1:8080` so the PHP site creates its session/cookies.

## 3. Run the NEW site

    npm run build
    npm start                 # http://127.0.0.1:3000

## 4. Seed identical data on both sides

The new side already has demo content:

    npm run seed:content      # 4 categories, 12 courses (2 free), 6 lessons each,
                              # student@edulari.test / Edulari!Test2026

Mirror it into `edulari_local` with a generated SQL dump so both sites render the same
titles, prices, ratings and lesson counts:

    npm run seed:content -- --dump-sql "C:\Users\piyus\Desktop\htdocs (7)\Edulari\scripts\ui-compare\seed-mysql.sql"

    C:\xampp\mysql\bin\mysql.exe -u root edulari_local < "...\scripts\ui-compare\seed-mysql.sql"

The dump uses bcrypt hashes produced by `bcryptjs`, which `password_verify()` in PHP
accepts, so the same password works on both.

Then, for pages whose URL needs an id, copy the value from the old site into the config
file: an instructor profile slug and one paid order id (`INSTRUCTOR_SLUG`, `ORDER_ID`).

## 5. Configure

    Copy-Item scripts/ui-compare/.env.compare.example scripts/ui-compare/.env.compare

Fill in `COMPARE_EMAIL` / `COMPARE_PASSWORD` (the seeded student), `INSTRUCTOR_SLUG` and
`ORDER_ID`. The file is git-ignored and its values are never printed by the tool.

## 6. Run

    npm run ui-compare                                   # everything
    npm run ui-compare -- --page cart --viewport 375     # one page / viewport
    npm run ui-compare -- --site new                     # new site only (no PHP needed)
    npm run ui-compare -- --no-screenshots               # DOM only, much faster

`--site new` is the mode to use while the old site is not running: it still records the
full stylesheet list, fonts in use, page height, horizontal overflow and a screenshot per
page+viewport, which is enough to catch a missing stylesheet, a wrong font stack or an
extra navbar by itself.

Exit code is 0 only when there are zero mismatches above tolerance.

## 7. Read the output

- `docs/UI_PARITY_REPORT.md` - per-page totals, and every mismatch sorted by impact
  (page, viewport, selector, property, old value, new value).
- `docs/ui-parity/JSON/<page>-<viewport>.json` - full detail including the elements that
  exist in only one DOM and the applied stylesheet lists.
- `docs/ui-parity/shots/<page>-<viewport>-{old,new,diff}.png` - the screenshots.

Impact weights: `display`/`position`/`font-*` 100, page height and horizontal overflow
90-95, box and box-spacing 80, colours/shadows/gaps 60, grid/flex 50, everything else 20.
Start at the top.

## 8. Freezing conditions

The same CSS is injected into both sides before measuring (`FREEZE_CSS` in `config.mjs`):
animations and transitions to 0s, `scroll-behavior: auto`, scroll-reveal elements forced
to their end state. Each page then waits for `networkidle`, `document.fonts.ready` and
400 ms, scrolls to 0, and the freeze is re-injected in case hydration re-enabled a
transition. Both contexts also use `reducedMotion: "reduce"`, `en-IN` locale and the
`Asia/Kolkata` timezone.

Time- and random-derived content is masked to an empty string on both sides
(`MASK_SELECTORS`): `time`, the purchase-history dates, the `[data-count]` counters and
the receipt/stat numbers.

## 9. Known unavoidable differences

- `head.php` writes `initial-scale=1.0`; Next emits `initial-scale=1`. Same parse.
- Next always injects its own `<script>`/`<link>` for the client runtime and CSS chunks;
  the PHP emits plain `<link>` tags. Class names, order and content of the CSS files
  themselves are identical, which is what the stylesheet-order audit checks.
- Client components render after hydration under Cache Components, so the first paint of
  `/cart`, `/wishlist`, `/checkout` and `/student/purchase-history` is filled in by the
  browser. The comparator waits for `networkidle` + `document.fonts.ready`, so both sides
  are measured in their settled state.
