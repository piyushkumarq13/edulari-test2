# AI Integrations Analysis

Source files (read-only PHP site `C:\Users\piyus\Desktop\htdocs (7)\htdocs`):
- `private/api/api_config.php`
- `private/api/ai_questions.php`
- `private/api/test_token.php` (instructor competency test parts)
- `public/student/course_ai_chat_api.php`
- `public/assets/js/course-ai.js`
- `public/course-ai-shared.php`
- `public/assets/css/course-ai.css` (referenced by shared view)

## Providers / keys (names only)

`private/api/api_config.php`:
- Active provider constant: `ACTIVE_AI_PROVIDER = 'openrouter'` (options documented: `'openrouter' | 'nvidia_kimi'`; dead `case 'google'` still wired in the switch, OpenAI/Anthropic commented out).
- OpenRouter (active): `OPENROUTER_API_KEY` from `$_ENV` (populated by `private/secrets.php`); if missing, `error_log` FATAL and empty-string constant. Model `OPENROUTER_MODEL = 'openrouter/free'`; endpoint `https://openrouter.ai/api/v1/chat/completions`; headers `HTTP-Referer: https://edulari.zya.me` and `X-Title: Edulari`.
- NVIDIA Kimi-K2 (inactive provider, wired): `NVIDIA_KIMI_API_KEY` from `$_ENV`; model `moonshotai/kimi-k2.6`; endpoint `https://integrate.api.nvidia.com/v1/chat/completions`.
- Commented-out placeholders for Google Gemini (`GOOGLE_AI_API_KEY`, `gemini-flash-latest`), OpenAI (`OPENAI_API_KEY`, `gpt-4o-mini`), Anthropic (`ANTHROPIC_API_KEY`, `claude-3-haiku-20240307`). `ai_call_google()` still exists and would reference undefined `GOOGLE_AI_*` constants.
- Test settings: `TEST_QUESTION_COUNT = 10`, `TEST_PASS_SCORE = 80`, `TEST_TOKEN_TTL_MINS = 30`.
- Timeouts: `AI_CONNECT_TIMEOUT = 10`, `AI_REQUEST_TIMEOUT = 45`, `AI_MAX_EXEC_TIME = 60`.
- Course chat uses a different, independent key: `$_ENV['GROQ_API_KEY']` (from `secrets.php`), used inline in `course_ai_chat_api.php` — NOT in `api_config.php`.

## Instructor competency test — question generator (`private/api/ai_questions.php`)

`generateTestQuestions(array $regData): array`
- Wraps the call in `set_time_limit(AI_MAX_EXEC_TIME)` (saved/restored).
- Builds prompt via `buildQuestionPrompt($regData)`, dispatches on `ACTIVE_AI_PROVIDER`:
  - `openrouter` → `ai_call_openrouter($prompt)`
  - `google` → `ai_call_google($prompt)` (provider disabled in config comments but still callable)
  - `nvidia_kimi` → `ai_call_nvidia_kimi($prompt)`
  - default → throws `RuntimeException('Unknown AI provider: ...')`
- Parses with `parseQuestionsFromJSON($raw)`; throws `RuntimeException` up to caller.

Prompt (`buildQuestionPrompt`): instructs "You are an expert educational evaluator...", interpolates from `$_SESSION['instructor_reg_data']`:
- `competency.primary_subject` (default `General`), `competency.secondary_subjects` ('' ), `competency.skill_level` (default `intermediate`), `competency.target_audience` (default `general learners`), `competency.course_ideas` ('')
- `credentials.highest_education`, `credentials.field_of_study`, `credentials.certifications`
- `profile.years_exp` (0), `profile.bio` ('')
- Instructions: exactly `{TEST_QUESTION_COUNT}` MCQs relevant to the subject + teaching methodology; mix conceptual/practical; 4 options A–D; one correct; difficulty matches skill level; output ONLY a raw JSON array, no markdown fences.
- Expected JSON schema: `[{"question": str, "options": {"A": str, "B": str, "C": str, "D": str}, "answer": "A"|"B"|"C"|"D"}]`.

Provider call params:
- OpenRouter: POST chat/completions, `messages=[{role:"user",content:prompt}]`, `temperature 0.7`, `max_tokens 4096`, no `stream` key. Fallback model chain tried in order on any curl error / non-200 / empty content / any error:
  1. `OPENROUTER_MODEL` (`openrouter/free`)
  2. `openai/gpt-oss-120b:free`
  3. `nvidia/nemotron-3-super-120b-a12b:free`
  4. `google/gemma-4-31b-it:free`
  5. `openai/gpt-oss-20b:free`
  Each attempt: SSL-verify first, retry once with `VERIFYPEER=false` on errno 35/60/77. Non-200 → log `error.message` + `error.metadata.provider_name`, try next model. Success logs `OpenRouter success via: {model} (finish_reason)`; warns on `finish_reason === 'length'`. After all fail: `RuntimeException("All AI models failed. Last error: ...")`.
- NVIDIA Kimi: `temperature 0.6`, `top_p 0.9`, `max_tokens 4096`, `stream: false`, Bearer auth header; same SSL-fallback curl pattern; 200 required, `choices[0].message.content` non-empty.
- Google (dead path): `generationConfig {temperature 0.7, maxOutputTokens 2048}`, response from `candidates[0].content.parts[0].text`; same SSL-fallback and error handling; references undefined constants under current config.

Parsing (`parseQuestionsFromJSON`):
1. `error_log` first 1000 chars of raw response.
2. Trim, strip leading/trailing markdown fences (`/^```[\w]*\s*/i`, `/\s*```\s*$/i`), trim.
3. Require first `[`; substring from there; `json_decode`.
4. If decode fails/empty → salvage: regex `/\{(?:[^{}]|(?R))*\}/s` matches candidate objects; keep ones with a truthy `question` key; throw `RuntimeException('Failed to parse questions from AI response.')` if none.
5. Validate each: `question` non-empty, `options.A/B/C/D` all set, `answer` non-empty and (case-insensitively) in A–D. Normalise: trim fields, uppercase answer. If nothing valid: `RuntimeException('No valid questions could be parsed from AI response.')`.

## Instructor competency test — token + lifecycle (`private/api/test_token.php`)

DB tables (DDL in file header comment, to be ported to Postgres migrations): `test_tokens` (id, user_id, token UNIQUE, expires_at, used TINYINT, test_data JSON, on_pass_action default `instructor_registration`, redirect_pass `/instructor-register-success`, redirect_fail `/instructor-register/step-6`, created_at; note `started_at`, `questions_data`, `answers_data`, `last_autosave_at`, `started_ip` columns are used in code but missing from the DDL comment — investigate actual schema), `test_failures` (user_id, ip_address, context, failed_at, retry_after).

- `createTestToken(userId, testData, onPassAction, redirectPass, redirectFail)`: if an existing token row exists for user+action and `started_at` set → reuse it (in-progress test resumption); otherwise delete stale row. Token = `bin2hex(random_bytes(32))` (64 hex). Insert row with `expires_at = NOW() + TEST_TOKEN_TTL_MINS (30m)`, `test_data` = JSON of `$regData`.
- `validateTestToken(token)`: row where `used = 0 AND (expires_at > NOW() OR started_at IS NOT NULL)`; decode `test_data` JSON.
- `markTestStarted(token, questions, ip, ttlMins)`: single-winner update `SET started_at=NOW(), expires_at=NOW()+ttl, questions_data=JSON, started_ip=ip WHERE token=? AND started_at IS NULL`; refreshes TTL to 30 min on start.
- `saveTestAnswers(token, questionIndex, optionLetter)`: validates token row exists, index in `questions_data` range, option letter is a real key, and rate-limits to 1 write/second via `last_autosave_at`; merges into `answers_data` JSON (`{questionIndex: letter}`).
- `computeTestScore(questions, answers)`: pure; `correct/total*100` rounded; answer compared uppercase.
- `findAndScoreAbandonedTestTokens()`: lazy sweep called from admin instructor-applications list; tokens `used=0 AND started_at IS NOT NULL AND NOW() > expires_at` → compute score, time taken via `TIMESTAMPDIFF(SECOND, started_at, NOW())`, atomically `consumeTestToken`, upsert `test_failures` block (`retry_after = NOW() + 7 days`, replacing prior row for user OR ip with same context), write `instructor_applications` row `status='test_failed', test_score, test_time_taken_seconds`, delete token.
- `recordTestFailure(userId, ip, context)`: replace-then-insert failure row, `retry_after = NOW() + 7 days`.
- `checkTestFailureBlock(userId, ip, context)`: blocked if any `retry_after > NOW()` for user OR ip (0 allowed for unknown user).

Pass semantics: `TEST_PASS_SCORE = 80` (used by email badge and scoring decision elsewhere — not in this file; instructor_applications row written with score; pass/fail branching lives in the test page/callback not covered here).

## Course AI chat (`public/student/course_ai_chat_api.php`)

Auth guard: must be logged in AND `getUserRole() === ROLE_STUDENT`, else HTTP 403 `{error:'Access denied'}`. All requests: `?action=...`, JSON body `{course_id, ...}`, requires `course_id > 0` else `{error:'Invalid course'}`. `$userId = $_SESSION['user_id']`.

Groq call (`aiCallGroq`): API key from `$_ENV['GROQ_API_KEY']` (throws if empty). POST `https://api.groq.com/openai/v1/chat/completions` with:
- `model: 'llama-3.3-70b-versatile'`
- `messages: [{role:'user', content: prompt}]` — single user message containing the whole constructed prompt
- `temperature: 0.7`, `max_tokens: 4096`, `stream: false` (no streaming)
- cURL timeout 60s, connect timeout 15s, Bearer `GROQ_API_KEY`
- Errors: cURL error → `RuntimeException('Groq cURL error: ...')`; non-200 → `RuntimeException('Groq error: ' . $errBody.error.message ?? "HTTP $httpCode")`; empty `choices[0].message.content` → `RuntimeException('Groq returned empty response')`. (Exceptions are NOT caught per-action — a Groq failure produces an uncaught Fatal/500; PHP `display_errors` behavior determines UX.)

Prompt construction (`buildPrompt`): single flat user message (NOT a messages array):
```
You are an AI tutor for the course '{title}'. Course description: {desc first 500 chars}. Answer the student's questions about this course. Use Markdown formatting.

Conversation so far:
Tutor: ...
Student: ...
...
Tutor:
```
Course title/description from `courses` table; description `mb_substr(...,0,500)`; roles rendered as `Tutor` (assistant) / `Student` (user); ends with `Tutor:`.

Helpers:
- `getOrCreateChat(courseId, userId)` — one chat row per (course,user), auto-created.
- `loadMessages(chatId)` — rows ordered `created_at ASC, id ASC`, mapped to `{id, role, content, versions (JSON array), active_version (int), feedback}`.

Actions:
- `get_messages` → `{messages}` (creates chat lazily).
- `send {content}` — trim/empty check; insert user message (`versions=[{content, created_at}]`, `active_version=0`); reload messages; build prompt; Groq; insert assistant message (same version shape, `active_version=0`); return `{messages}`.
- `retry {message_id}` — only assistant messages owned by user; append current content to `versions` if non-empty, then regenerate from full current conversation prompt; append new reply as last version; set `content`/`versions`/`active_version = count-1`; return `{messages}`.
- `edit_message {message_id, content}` — only user messages; append new version, set active to latest; find the NEXT assistant message after it, and REGENERATE it (filtering that assistant message out of the conversation before prompting), reset its `versions` to `[[newReply]]` and `active_version=0`; return `{messages}`.
- `switch_version {message_id, version_index}` — any message; bounds-check version index; set `content` + `active_version`; return `{messages}`.
- `feedback {message_id, feedback}` — allow `like|dislike|none`; toggles to `null` if same value repeated; return `{ok:true, feedback}`.
- `share` — one share slug per (chat,user): reuse existing `course_ai_share_links.slug` or insert new `slug = bin2hex(random_bytes(4))` (8 hex chars); return `{slug}`.
- `get_share` — return `{slug}` or `{slug:null}`.
- default → `{error:'Unknown action'}`.

DB tables: `course_ai_chats` (id, course_id, user_id), `course_ai_messages` (id, chat_id, course_id, user_id, role, content, versions JSON, active_version, feedback, created_at), `course_ai_share_links` (slug, chat_id, user_id).

`versions` JSON shape: `[{"content": str, "created_at": "Y-m-d H:i:s"}]`; `active_version` indexes it. Note PHP quirk: on `send`, both inserts use `?` binding with `$now` AFTER the values bound for content — i.e. `[chatId, courseId, userId, content, json_encode([['content'=>$content,'created_at'=>$now]])]` — `$now` used inside versions JSON (fine); assistant row binds `[chatId, courseId, userId, reply, json_encode([...])]` (also fine). UI render picks `versions[active_version].content` when >1 version, else `content`.

CSRF: requests send header `X-CSRF-Token: window.courseAiCsrf` (set on the learn page — not verified inside this API file; the PHP side does not read `HTTP_X_CSRF_TOKEN` here, so the token is effectively advisory/unused — a gap to fix in the port).

Frontend (`public/assets/js/course-ai.js`): IIFE; elements `courseAiChatBtn/courseAiChatPanel/courseAiChatCloseBtn/courseAiMessages/courseAiInput/courseAiSendBtn/courseAiShareBtn`; `window.courseAiCourseId`, `window.courseAiCsrf`. Toggle panel, lazy `loadMessages` on first open. `api(action, data)` POSTs JSON to `/student/course_ai_chat_api.php?action=...` with `Content-Type: application/json` and `X-CSRF-Token`. Optimistic user bubble + "Thinking..." row on send; error row with escaped message on failure (note: escapes but sets via `insertAdjacentHTML`). Message rows: bubble text (`textContent`, no markdown rendering client-side), action bar per role — assistant: `↻ Retry`, 👍/👎 feedback (active class highlight), version pager `‹ n/N ›` calling `switch_version` with `active_version ± 1`; user: `✎ Edit` inline textarea (Save/Cancel) calling `edit_message`. `switch_version` updates messages. Feedback toggles update local `m.feedback`. Share opens a modal with `location.origin + '/course-ai-shared.php?slug=' + slug`, copy-to-clipboard (navigator.clipboard) with "Copied!" for 1500ms. Enter sends (Shift+Enter newline), send button click.

Shared view (`public/course-ai-shared.php`): public (no login), `?slug=` → 404 if missing/unknown; loads chat + messages; `pageRobots = 'noindex'`; renders `window.SHARED_MESSAGES` (JSON_UNESCAPED_UNICODE) with each message's effective content (versions[active_version] when >1); inline `renderMarkdown()` (minimal markdown → HTML: escapes HTML first, code fences to `pre.md-code code.language-*`, headings h1–h6, `---`, blockquote, bold/underline(`++`)/em/strike, inline code, images, links, GFM tables, `-` lists, `1.` ordered lists, br collapsing); assistant bubbles rendered as markdown via `innerHTML` (XSS-safe because input was HTML-escaped first); CodeHighlight via `hljs.highlightElement`; header link to `/` with Edulari logo, "Shared chat · read-only" chip, CTA to `/student/learn`.

## Limits / errors summary

- Question generator: 10 questions, `TEST_TOKEN_TTL_MINS=30`, connect 10s / request 45s / php time limit 60s, max_tokens 4096 (OpenRouter/NVIDIA), temperature 0.7/0.6.
- Course chat: Groq 60s total / 15s connect, max_tokens 4096, temperature 0.7, `stream:false`, description truncated to 500 chars, message versions unbounded append-only per message.
- Rate limit: autosave 1/sec on test answers; 7-day failure block; no rate limit on chat send.

## Open questions

- `course_ai_chat_api.php` never validates the `X-CSRF-Token` header server-side — decide whether to enforce in the port (likely yes, student-only guard retained).
- Groq failures are uncaught PHP exceptions → the JSON endpoint may return a 500 HTML/log page rather than `{error}`; define intended JSON error shape for the port.
- `test_tokens` DDL in the `test_token.php` header comment omits `started_at`, `questions_data`, `answers_data`, `last_autosave_at`, `started_ip` columns that the code requires — confirm real schema (likely a `ALTER` elsewhere) before writing the Postgres migration.
- Was `ai_call_google`'s `GOOGLE_AI_*` constant path ever live? Config comments say OpenRouter is active since ~June 2026; confirm we can drop the Google branch (and OpenAI/Anthropic stubs) or keep parity.
- The chat prompt is a single flat user message starting with "Tutor:" — confirm the new Groq/OpenAI-compatible client should keep this format vs proper message arrays (keep parity unless told otherwise).
- OpenRouter fallback model list (`openrouter/free`, `openai/gpt-oss-120b:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `google/gemma-4-31b-it:free`, `openai/gpt-oss-20b:free`) is dated June 2026 — confirm which free model IDs are still valid at deploy time.
- `TEST_PASS_SCORE`/`ACTIVE_AI_PROVIDER` are hard `define`d; in the port, confirm these become env config (`AI_PROVIDER`, etc.) with the same defaults.
- No DB-driven provider switch at runtime (constant only) — confirm intended.
- `course-ai-shared.php` inline `renderMarkdown` duplicates the richer `private/functions/markdown.php` — confirm whether the shared view should keep its simplified parser or be aligned to the main markdown renderer (parity vs consistency risk).
