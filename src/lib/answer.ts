const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * MCQ / text answers match ignoring case and whitespace.
 * Numerical answers compare as numbers with no tolerance.
 */
export function checkAttempt(attempt: string, key: string): boolean {
  const a = attempt.trim();
  const k = key.trim();
  if (!a || !k) return false;
  if (NUMERIC.test(a) && NUMERIC.test(k)) {
    return Number(a) === Number(k);
  }
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  return norm(a) === norm(k);
}

export function isNumericKey(key: string): boolean {
  return NUMERIC.test(key.trim());
}
