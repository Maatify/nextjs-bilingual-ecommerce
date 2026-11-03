/*
 * Password strength — pure, dependency-free, safe to import from client components
 * (used by the change-password meter and by the server to flag weak passwords).
 */

export const MIN_PASSWORD_LENGTH = 10;

const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910", "0123456789", "987654321", "111111", "1111111111",
  "000000", "0000000000", "123123", "123123123", "654321", "666666", "112233", "121212", "password", "password1", "password123",
  "passw0rd", "p@ssw0rd", "p@ssword", "qwerty", "qwerty123", "qwertyuiop", "asdfghjkl", "zxcvbnm", "1q2w3e4r", "1qaz2wsx",
  "abc123", "abcdef", "abcd1234", "iloveyou", "admin", "admin123", "admin1234", "administrator", "welcome", "welcome1",
  "letmein", "monkey", "dragon", "football", "sunshine", "princess", "master", "shadow", "superman", "trustno1", "changeme",
  "secret", "test1234", "verda", "verda123", "verdaadmin", "egypt", "cairo", "egypt123", "cairo123",
]);

export interface Strength {
  /** 0 = very weak … 4 = strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Good" | "Strong";
  /** one-line advice, or null when the password is fine */
  hint: string | null;
  /** true for well-known passwords and trivial patterns, regardless of length */
  common: boolean;
  /** which hint applies — lets the dashboard show it in the admin's language */
  code: "short" | "common" | "digits" | "weak" | null;
}

const LABELS: Strength["label"][] = ["Very weak", "Weak", "Fair", "Good", "Strong"];

function isTrivial(pw: string) {
  const p = pw.toLowerCase();
  if (COMMON.has(p) || COMMON.has(p.replace(/[!.@#]+$/, ""))) return true;
  if (/^(.)\1+$/.test(p)) return true; // aaaaaaaaaa
  if (/^\d+$/.test(p)) {
    // ascending / descending digit runs
    const d = [...p].map(Number);
    if (d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10) || d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10)) return true;
  }
  return false;
}

export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: LABELS[0], hint: `Use at least ${MIN_PASSWORD_LENGTH} characters.`, common: false, code: "short" };
  const common = isTrivial(pw);
  if (common) return { score: 0, label: LABELS[0], hint: "This is one of the most common passwords — it can be guessed in seconds.", common, code: "common" };

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  const unique = new Set(pw).size;
  let s = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) s++;
  if (pw.length >= 14) s++;
  if (pw.length >= 20) s++;
  if (classes >= 3) s++;
  if (classes === 4 && pw.length >= 12) s++;
  if (unique < Math.min(6, pw.length / 2)) s -= 2; // lots of repetition
  if (/^\d+$/.test(pw)) s = Math.min(s, 1); // digits only
  if (pw.length < MIN_PASSWORD_LENGTH) s = Math.min(s, 1);
  const score = Math.max(0, Math.min(4, s)) as Strength["score"];

  let hint: string | null = null;
  let code: Strength["code"] = null;
  if (pw.length < MIN_PASSWORD_LENGTH) (hint = `Use at least ${MIN_PASSWORD_LENGTH} characters.`), (code = "short");
  else if (/^\d+$/.test(pw)) (hint = "Digits only is easy to brute-force — mix in letters and symbols."), (code = "digits");
  else if (score < 3) (hint = "Make it longer, or mix upper/lower case, numbers and symbols. A short phrase works well."), (code = "weak");
  return { score, label: LABELS[score], hint, common, code };
}

/** Weak enough to warn about in the dashboard (common, digits-only, short or low score). */
export const isWeakPassword = (pw: string) => passwordStrength(pw).score < 2;
