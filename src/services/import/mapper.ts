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
  plate:               ["plate", "license", "tag", "lic", "registration", "reg"],
  make:                ["make", "manufacturer", "brand"],
  model:               ["model"],
  year:                ["year", "yr"],
  color:               ["color", "colour", "clr"],
  vehicleDescription:  ["vehicle", "car", "description", "desc", "veh"],
  observedDate:        ["date", "seen", "observed", "spotted", "when", "day"],
  observedTime:        ["time", "hour"],
  lat:                 ["lat", "latitude"],
  lng:                 ["lng", "lon", "longitude"],
  locationDescription: ["location", "where", "address", "street", "area", "place", "loc"],
  activityDescription: ["activity", "action", "behavior", "what", "doing", "crime"],
  direction:           ["direction", "dir", "heading", "travel"],
  notes:               ["notes", "note", "comments", "comment", "memo", "remarks"],
  driverAlias:         ["driver", "suspect", "person", "name", "alias", "who"],
  driverDescription:   ["physical", "appearance", "looks"],
  riskLevel:           ["risk", "danger", "threat", "level", "aggressive"],
  photoPath:           ["photo", "image", "pic", "file", "attachment", "img"],
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
  for (const kw of keywords) {
    if (h.includes(kw)) return 0.8;
    if (kw.includes(h) && h.length > 2) return 0.6;
  }

  return 0;
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
  const used = new Set<TargetField>();

  for (const header of headers) {
    let bestField: TargetField | null = null;
    let bestScore = 0;

    for (const [field, _] of Object.entries(FIELD_KEYWORDS) as [TargetField, string[]][]) {
      if (used.has(field)) continue;
      const score = matchScore(header, field);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestField && bestScore >= 0.5) {
      mappings.push({
        sourceColumn: header,
        targetField: bestField,
        transform: inferTransform(bestField),
      });
      confidence[header] = bestScore;
      used.add(bestField);
    } else {
      unmapped.push(header);
    }
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
