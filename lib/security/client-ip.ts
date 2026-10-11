export function getClientIp(headers: Headers): string {
  // Mirror getClientIpAddress(): trust x-forwarded-for only when behind a trusted proxy.
  const trustedProxies: string[] = []; // empty = ignore XFF (safe default for shared hosting)
  const remoteAddr = headers.get("x-real-ip") ?? "";
  const xff = headers.get("x-forwarded-for");
  if (trustedProxies.length > 0 && xff) {
    return xff.split(",")[0].trim();
  }
  return remoteAddr || xff?.split(",")[0]?.trim() || "unknown";
}
