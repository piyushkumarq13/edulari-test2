export function getAvatarUrl(profileImageValue: string | null | undefined): string {
  if (!profileImageValue) return "";
  if (profileImageValue.startsWith("http://") || profileImageValue.startsWith("https://")) return profileImageValue;
  if (profileImageValue.startsWith("/")) return profileImageValue;
  return "/api/media?type=avatar&key=" + encodeURIComponent(profileImageValue);
}

export function getLessonPdfUrl(lessonId: number): string {
  return "/api/media?type=lesson_pdf&id=" + lessonId;
}
