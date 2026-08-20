/**
 * Shared Short Answer grading logic - the single source of truth for "does a student's
 * typed answer match the correct answer" across every exam engine (SAT/ACT/AP, course quizzes,
 * practice tests, full-length tests, and the public demo flow) and the backend grading routes.
 *
 * Plain JS with no React/Node-only imports, so it can be imported unmodified from both the
 * frontend (bundled by Vite) and the backend (plain Node ESM import).
 *
 * `correct_answer` may hold more than one accepted written form for the same answer, using the
 * convention already adopted in production data: a comma- or pipe-separated list (e.g.
 * "3.44, 86/25"), or a JSON array string (e.g. '["3.44","86/25"]').
 */

/**
 * Splits a raw `correct_answer` string into its individual accepted forms, trimmed and
 * lowercased. A plain single-value answer (no comma/pipe/JSON-array) returns a one-element
 * array, so existing single-answer questions behave identically to before.
 */
export function parseAcceptedAnswers(correctAnswerRaw) {
  const raw = (correctAnswerRaw ?? '').toString().trim();
  if (!raw) return [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map(a => a.toString().trim().toLowerCase()).filter(Boolean);
    } catch {
      // Not actually valid JSON (e.g. a stray "[IMAGE: ...]" placeholder that leaked into
      // correct_answer) - fall through to the plain split below instead of crashing.
    }
  }

  return raw.split(/[,|]/).map(a => a.trim().toLowerCase()).filter(Boolean);
}

/**
 * Parses a string as a plain number OR a simple "a/b" fraction (with any amount of whitespace
 * around the slash, e.g. "1 / 4"). Returns null if the string isn't cleanly one of those forms,
 * so callers never mistake an unparseable string for a numeric value.
 */
function parseNumeric(value) {
  const s = (value ?? '').toString().trim();
  if (!s) return null;

  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return parseFloat(s);
  }

  const fractionMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  return null;
}

const NUMERIC_EPSILON = 1e-6;

function numericallyEqual(a, b) {
  const na = parseNumeric(a);
  const nb = parseNumeric(b);
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) < NUMERIC_EPSILON;
}

/**
 * The one grading check every exam engine and the backend should call: does `studentAnswer`
 * match ANY of the accepted forms in `correctAnswerRaw`? Matches on exact (trimmed, lowercased)
 * string equality first, then falls back to numeric/fraction equivalence (e.g. "0.250" matching
 * "0.25", "1 / 4" matching "1/4") so authors don't have to anticipate every equivalent
 * representation a student might type.
 */
export function isAnswerCorrect(studentAnswer, correctAnswerRaw) {
  const studentAns = (studentAnswer ?? '').toString().trim().toLowerCase();
  if (!studentAns) return false;

  const accepted = parseAcceptedAnswers(correctAnswerRaw);
  if (accepted.length === 0) return false;

  if (accepted.includes(studentAns)) return true;

  return accepted.some(candidate => numericallyEqual(studentAns, candidate));
}
