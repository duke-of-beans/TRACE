/**
 * TRACE — Field Normalizer
 *
 * Cleans and transforms raw Excel values into TRACE-compatible fields.
 * Handles the mess: inconsistent date formats, combined vehicle descriptions,
 * dirty plate numbers, etc.
 */
import type { ColumnMapping } from "./types.js";

/**
 * Normalize a single row using the mapping config.
 */
export function normalizeRow(
  raw: Record<string, unknown>,
  mappings: ColumnMapping[]
): { normalized: Record<string, unknown>; errors: string[] } {
  const normalized: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const mapping of mappings) {
    const rawVal = raw[mapping.sourceColumn];
    if (rawVal === null || rawVal === undefined || rawVal === "") continue;

    try {
      normalized[mapping.targetField] = applyTransform(
        String(rawVal).trim(),
        mapping.transform
      );
    } catch (err) {
      errors.push(`${mapping.sourceColumn}: ${(err as Error).message}`);
    }
  }

  return { normalized, errors };
}

function applyTransform(value: string, transform?: string): unknown {
  switch (transform) {
    case "uppercase":
      return value.toUpperCase().replace(/\s+/g, "");

    case "parseDate":
      return parseFlexDate(value);

    case "parseTime":
      return value; // preserve as-is for now

    case "splitVehicle":
      return splitVehicleDescription(value);

    default:
      return value;
  }
}

/**
 * Parse dates in multiple formats:
 * - ISO: 2024-01-15
 * - US: 01/15/2024, 1/15/24
 * - Natural: Jan 15 2024, January 15, 2024
 * - Excel serial number
 */
function parseFlexDate(value: string): string {
  // already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;

  // Excel serial number (number > 30000)
  const num = Number(value);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + num);
    return epoch.toISOString().slice(0, 10);
  }

  // US format: M/D/YYYY or M/D/YY
  const usMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (usMatch) {
    let year = parseInt(usMatch[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // try native Date parsing as fallback
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  throw new Error(`Cannot parse date: "${value}"`);
}

/**
 * Split combined vehicle descriptions like "Red 2019 Honda Civic"
 * into structured fields. Returns the original string (splitting happens
 * at the pipeline level where we can set make/model/year/color).
 */
function splitVehicleDescription(value: string): string {
  // return as-is; the pipeline orchestrator handles decomposition
  return value;
}

/**
 * Attempt to decompose a vehicle description string into fields.
 * Best-effort; operator reviews results.
 */
export function decomposeVehicle(desc: string): {
  color?: string;
  year?: number;
  make?: string;
  model?: string;
  remainder: string;
} {
  const result: ReturnType<typeof decomposeVehicle> = { remainder: desc };
  const tokens = desc.split(/\s+/);

  const COLORS = [
    "black", "white", "silver", "gray", "grey", "red", "blue", "green",
    "yellow", "gold", "brown", "tan", "orange", "purple", "maroon", "beige",
  ];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase();

    // year
    const yr = parseInt(tokens[i]);
    if (yr >= 1990 && yr <= 2030 && !result.year) {
      result.year = yr;
      tokens[i] = "";
      continue;
    }

    // color
    if (COLORS.includes(t) && !result.color) {
      result.color = tokens[i];
      tokens[i] = "";
      continue;
    }
  }

  // remaining tokens: assume first is make, rest is model
  const remaining = tokens.filter(Boolean);
  if (remaining.length >= 2) {
    result.make = remaining[0];
    result.model = remaining.slice(1).join(" ");
  } else if (remaining.length === 1) {
    result.make = remaining[0];
  }

  result.remainder = remaining.join(" ");
  return result;
}
