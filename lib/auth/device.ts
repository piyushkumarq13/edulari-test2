export function getDeviceInfoFromHeaders(headers: Headers): string {
  const ua = headers.get("user-agent") ?? "";
  const platform = headers.get("sec-ch-ua-platform") ?? "";
  const parts = [ua];
  if (platform) parts.push(platform);
  return parts.join(" | ").slice(0, 255);
}

export function parseDeviceInfo(ua: string): { browser: string; os: string; icon: "monitor" | "smartphone" } {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let icon: "monitor" | "smartphone" = "monitor";

  if (ua.includes("Edg/") || ua.includes("Edge/")) browser = "Microsoft Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium/")) browser = "Google Chrome";
  else if (ua.includes("Firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "Internet Explorer";

  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) { os = "Android"; icon = "smartphone"; }
  else if (ua.includes("iPhone") || ua.includes("iPad")) { os = "iOS"; icon = "smartphone"; }
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os, icon };
}
