// The PHP site's course-ai.js posts to /student/course_ai_chat_api.php, which
// public/.htaccess redirects (301) to the clean /student/course_ai_chat_api. The
// implementation lives in the /api route; this alias keeps the PHP URL working for parity.
export { maxDuration, POST } from "@/app/api/student/course-ai/route";