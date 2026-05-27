/**
 * TRACE Design System — Wordmark
 *
 * Unified brand lockup used across all portals.
 * Structure (top to bottom):
 *   1. "T R A C E" — Exo 2 Thin (100), accent color, 0.22em letter-spacing
 *   2. Hairline rule — accent color, 50% opacity, matches text width
 *   3. Expansion — "Tracking · Reporting · Analysis · Community Evidence"
 *   4. Context label — e.g. "Field Reporter", "Operator Console" (optional)
 *
 * Three sizes:
 *   lg — 40px TRACE, 10px expansion (hero/login, fullscreen contexts)
 *   md — 28px TRACE, 9px expansion (pin lock, compact login)
 *   sm — 18px TRACE, omit expansion (inline references)
 *
 * Font load: <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@100;200;300&display=swap" rel="stylesheet">
 */

/** CSS class approach — apply to a span/div containing "TRACE" */
export const wordmarkStyles = {
  fontFamily: "'Exo 2', system-ui, sans-serif",
  fontWeight: 100,
  letterSpacing: "0.22em",
  lineHeight: 1,
} as const;

/** Responsive weight: bump weight at small sizes for legibility */
export function wordmarkWeight(fontSize: number): number {
  if (fontSize <= 14) return 300;
  if (fontSize <= 20) return 200;
  return 100;
}

/** The full expanded name (mid-dot separated, used in brand lockup) */
export const TRACE_FULL_NAME = "Tracking · Reporting · Analysis · Community Evidence";

/** Size presets for the brand lockup */
export const WORDMARK_SIZES = {
  lg: { fontSize: 40, expansionSize: 10, ruleMargin: 6, expansionMargin: 8, labelMargin: 6, labelSize: 11 },
  md: { fontSize: 28, expansionSize: 9,  ruleMargin: 4, expansionMargin: 6, labelMargin: 4, labelSize: 10 },
  sm: { fontSize: 18, expansionSize: 0,  ruleMargin: 3, expansionMargin: 0, labelMargin: 0, labelSize: 0 },
} as const;
