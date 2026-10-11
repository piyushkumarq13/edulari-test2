import bcrypt from "bcryptjs";

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10); // PHP PASSWORD_DEFAULT (bcrypt cost 10)
}

/**
 * Verify a password. Accepts PHP bcrypt hashes that use the `$2y$` prefix
 * by normalizing the prefix to `$2a$` (identical algorithm) before comparing.
 */
export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const normalized = stored.startsWith("$2y$") ? "$2a$" + stored.slice(4) : stored;
  try {
    return bcrypt.compareSync(plain, normalized);
  } catch {
    return false;
  }
}
