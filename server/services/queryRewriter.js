/**
 * Query Rewriter — resolves temporal keywords to explicit date ranges
 * and expands common merchant shorthand for better vector retrieval.
 *
 * IMPORTANT: Uses regex only — NO LLM calls. This runs on every query
 * so must be fast and free.
 */

// ── Merchant shorthand expansions ──────────────────────────────────────
const MERCHANT_EXPANSIONS = [
  { pattern: /\bswiggy\b/gi,   replacement: 'Swiggy food delivery' },
  { pattern: /\bzepto\b/gi,    replacement: 'Zepto quick commerce grocery' },
  { pattern: /\bzomato\b/gi,   replacement: 'Zomato food delivery' },
  { pattern: /\bgroww\b/gi,    replacement: 'Groww investment mutual fund' },
  { pattern: /\bzerodha\b/gi,  replacement: 'Zerodha stock trading investment' },
];

// ── Date helper utilities ───────────────────────────────────────────────

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfQuarter(date) {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

function endOfQuarter(date) {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
}

function subMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - n);
  return d;
}

function subDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ── Pattern definitions ─────────────────────────────────────────────────

/**
 * Returns detected date range for a question, or null if none found.
 * @param {string} question
 * @returns {{ start: Date, end: Date } | null}
 */
function detectDateRange(question) {
  const lower = question.toLowerCase();
  const now = new Date();

  // "past N days"
  const pastDaysMatch = lower.match(/past\s+(\d+)\s+days?/);
  if (pastDaysMatch) {
    const n = parseInt(pastDaysMatch[1], 10);
    return { start: startOfDay(subDays(now, n)), end: endOfDay(now) };
  }

  // "past N months"
  const pastMonthsMatch = lower.match(/past\s+(\d+)\s+months?/);
  if (pastMonthsMatch) {
    const n = parseInt(pastMonthsMatch[1], 10);
    return { start: startOfDay(subMonths(now, n)), end: endOfDay(now) };
  }

  // "last month"
  if (/last\s+month/.test(lower)) {
    const prevMonth = subMonths(now, 1);
    return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
  }

  // "this month"
  if (/this\s+month/.test(lower)) {
    return { start: startOfMonth(now), end: endOfDay(now) };
  }

  // "last quarter"
  if (/last\s+quarter/.test(lower)) {
    const prevQ = subMonths(now, 3);
    return { start: startOfQuarter(prevQ), end: endOfQuarter(prevQ) };
  }

  // "this quarter"
  if (/this\s+quarter/.test(lower)) {
    return { start: startOfQuarter(now), end: endOfDay(now) };
  }

  // "last year"
  if (/last\s+year/.test(lower)) {
    const prevYear = now.getFullYear() - 1;
    return {
      start: new Date(prevYear, 0, 1),
      end: new Date(prevYear, 11, 31, 23, 59, 59, 999),
    };
  }

  // "this year"
  if (/this\s+year/.test(lower)) {
    return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
  }

  return null;
}

// ── Main export ─────────────────────────────────────────────────────────

/**
 * Rewrites a user question to improve vector retrieval:
 * 1. Resolves temporal keywords to explicit date ranges
 * 2. Expands merchant shorthand (e.g. "swiggy" → "Swiggy food delivery")
 *
 * @param {string} question
 * @param {object} sessionMeta - { uploadedAt, rowCount, fileType }
 * @returns {Promise<{
 *   rewrittenQuery: string,
 *   detectedDateRange: { start: Date|null, end: Date|null },
 *   wasRewritten: boolean
 * }>}
 */
export async function rewriteQuery(question, sessionMeta) {
  let rewrittenQuery = question;
  let wasRewritten = false;

  // Step 1 — Expand merchant shorthand
  for (const { pattern, replacement } of MERCHANT_EXPANSIONS) {
    if (pattern.test(rewrittenQuery)) {
      rewrittenQuery = rewrittenQuery.replace(pattern, replacement);
      wasRewritten = true;
      // Reset regex lastIndex after stateful test()
      pattern.lastIndex = 0;
    }
    pattern.lastIndex = 0;
  }

  // Step 2 — Detect and resolve temporal keywords
  const dateRange = detectDateRange(question);
  let detectedDateRange = { start: null, end: null };

  if (dateRange) {
    detectedDateRange = dateRange;
    wasRewritten = true;
    rewrittenQuery =
      `${rewrittenQuery}\n[Date range: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}]`;
  }

  return { rewrittenQuery, detectedDateRange, wasRewritten };
}
