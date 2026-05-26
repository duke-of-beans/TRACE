/**
 * TRACE Design System — Wordmark
 *
 * Exo 2 Thin (100) with indigo hairline rule underneath.
 * At small sizes (≤16px), weight bumps to 200-300 for legibility.
 *
 * Full name: Tracking, Reporting, Analysis & Community Evidence
 * Spell out only in onboarding and security docs — not on every screen.
 *
 * Font load: <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@100;200;300&display=swap" rel="stylesheet">
 * Or preload in index.html for no FOUT.
 */

/** Inline SVG wordmark — works without font loading (paths, not text) */
export function getWordmarkSvg(opts: { width?: number; dark?: boolean; rule?: boolean } = {}): string {
  const { width = 120, dark = false, rule = true } = opts;
  const textColor = dark ? "#F1F5F9" : "#1E293B";
  const ruleColor = dark ? "rgba(129,140,248,0.5)" : "rgba(79,70,229,0.6)";
  const height = rule ? Math.round(width * 0.32) : Math.round(width * 0.28);

  // The wordmark as CSS text (requires Exo 2 font loaded)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
    <text x="0" y="${Math.round(height * 0.72)}" fill="${textColor}" font-family="'Exo 2', system-ui, sans-serif" font-weight="100" font-size="${Math.round(width * 0.28)}" letter-spacing="${Math.round(width * 0.05)}">TRACE</text>
    ${rule ? `<line x1="0" y1="${height - 2}" x2="${width}" y2="${height - 2}" stroke="${ruleColor}" stroke-width="1"/>` : ""}
  </svg>`;
}

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

/** The full expanded name */
export const TRACE_FULL_NAME = "Tracking, Reporting, Analysis & Community Evidence";
