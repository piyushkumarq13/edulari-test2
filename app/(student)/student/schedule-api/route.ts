// The PHP site exposes this endpoint as /student/schedule-api (student/schedule.php calls
// it with that clean URL; public/.htaccess maps /student/schedule-api to
// student/schedule-api.php). The implementation lives in the /api route so all handlers
// stay under app/api; this alias keeps the PHP URL working for parity.
export { GET, POST } from "@/app/api/student/schedule/route";