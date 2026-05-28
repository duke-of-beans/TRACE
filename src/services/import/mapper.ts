/**
 * TRACE — Column Auto-Detection + Mapping
 *
 * Fuzzy header matching to guess which Excel columns
 * correspond to TRACE fields. Outputs a mapping config
 * for operator review before import.
 */
import type { ColumnMapping, TargetField } from "./types.js";

// Fuzzy keyword maps: target field -> possible header variants
const FIELD_KEYWORDS: Record<TargetField, string[]> = {
  plate:               ["plate", "license", "tag", "lic", "registration", "reg", "recent"],
  make:                ["make", "manufacturer", "brand"],
  model:               ["model"],
  year:                ["year", "yr"],
  color:               ["color", "colour", "clr"],
  vehicleDescription:  ["vehicle", "car", "description", "desc", "veh", "distinguishing", "features", "identifying"],
  observedDate:        ["date", "seen", "observed", "spotted", "when", "day"],
  observedTime:        ["time", "hour"],
  lat:                 ["lat", "latitude"],
  lng:                 ["lng", "lon", "longitude"],
  locationDescription: ["location", "where", "address", "street", "area", "place", "loc", "operating"],
  activityDescription: ["activity", "action", "behavior", "what", "doing", "crime", "affiliation", "agency"],
  direction:           ["direction", "dir", "heading", "travel"],
  notes:               ["notes", "note", "comments", "comment", "memo", "remarks"],
  driverAlias:         ["driver", "suspect", "person", "name", "alias", "who"],
  driverDescription:   ["physical", "appearance", "looks"],
  riskLevel:           ["risk", "danger", "threat", "level", "aggressive"],
  photoPath:           ["photo", "image", "pic", "file", "attachment", "img", "picture"],
};

/**
 * Score how well a header matches a target field.
 * Returns 0-1 confidence score.
 */
function matchScore(header: string, field: TargetField): number {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keywords = FIELD_KEYWORDS[field];

  // exact match
  if (keywords.includes(h)) return 1.0;

  // substring match
  let best = 0;
  for (const kw of keywords) {
    if (h.includes(kw)) { best = Math.max(best, 0.8); }
    else if (kw.includes(h) && h.length > 2) { best = Math.max(best, 0.6); }
  }

  // Plate field: prefer "most recent" / "current" over "all" / "history"
  if (field === "plate" && best > 0) {
    const hLow = header.toLowerCase();
    if (hLow.includes("all") || hLow.includes("history")) best *= 0.5; // demote
    if (hLow.includes("recent") || hLow.includes("current") || hLow.includes("latest")) best = Math.min(best + 0.15, 1.0); // promote
  }

  return best;
}

/**
 * Auto-detect column mappings from headers.
 * Returns best-guess mapping + unmapped columns.
 */
export function autoMap(
  headers: string[]
): { mappings: ColumnMapping[]; unmapped: string[]; confidence: Record<string, number> } {
  const mappings: ColumnMapping[] = [];
  const unmapped: string[] = [];
  const confidence: Record<string, number> = {};

  // Build all candidate scores
  const candidates: { header: string; field: TargetField; score: number }[] = [];
  for (const header of headers) {
    for (const [field, _] of Object.entries(FIELD_KEYWORDS) as [TargetField, string[]][]) {
      const score = matchScore(header, field);
      if (score >= 0.5) {
        candidates.push({ header, field, score });
      }
    }
  }

  // Sort by score descending — best matches assigned first
  candidates.sort((a, b) => b.score - a.score);

  const usedFields = new Set<TargetField>();
  const usedHeaders = new Set<string>();

  for (const c of candidates) {
    if (usedFields.has(c.field) || usedHeaders.has(c.header)) continue;
    mappings.push({
      sourceColumn: c.header,
      targetField: c.field,
      transform: inferTransform(c.field),
    });
    confidence[c.header] = c.score;
    usedFields.add(c.field);
    usedHeaders.add(c.header);
  }

  // Remaining unmapped headers
  for (const header of headers) {
    if (!usedHeaders.has(header)) unmapped.push(header);
  }

  return { mappings, unmapped, confidence };
}

function inferTransform(field: TargetField): string | undefined {
  switch (field) {
    case "plate": return "uppercase";
    case "observedDate": return "parseDate";
    case "observedTime": return "parseTime";
    case "vehicleDescription": return "splitVehicle";
    default: return undefined;
  }
}
