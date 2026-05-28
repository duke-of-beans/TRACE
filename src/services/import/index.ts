/**
 * TRACE — Import Pipeline Orchestrator
 *
 * End-to-end: ingest -> map -> normalize -> validate -> deduplicate -> report/import
 *
 * Usage:
 *   npx tsx src/services/import/index.ts preview path/to/data.xlsx
 *   npx tsx src/services/import/index.ts map path/to/data.xlsx
 *   npx tsx src/services/import/index.ts import path/to/data.xlsx
 */
import { ingest } from "./ingest.js";
import { autoMap } from "./mapper.js";
import { normalizeRow, decomposeVehicle } from "./normalizer.js";
import { detectDuplicates } from "./deduplicator.js";
import { importRows } from "./importer.js";
import type { ImportRow, ImportReport, ColumnMapping } from "./types.js";

/**
 * Run the full pipeline in preview mode (no database writes).
 */
export async function preview(
  filePath: string,
  sheet?: string,
  mappingOverrides?: ColumnMapping[]
): Promise<ImportReport> {
  // 1. Ingest
  const raw = await ingest(filePath, sheet);

  // 2. Auto-map columns (or use overrides)
  const { mappings, unmapped, confidence } = mappingOverrides
    ? { mappings: mappingOverrides, unmapped: [], confidence: {} }
    : autoMap(raw.headers);

  for (const m of mappings) {
    const conf = confidence[m.sourceColumn];
  }
  if (unmapped.length > 0) {
  }

  // 3. Normalize each row
  let rows: ImportRow[] = raw.rows.map((rawRow, i) => {
    const { normalized, errors } = normalizeRow(rawRow, mappings);

    // attempt vehicle decomposition if we have a description but no make/model
    if (normalized.vehicleDescription && !normalized.make) {
      const decomposed = decomposeVehicle(String(normalized.vehicleDescription));
      if (decomposed.make) normalized.make = decomposed.make;
      if (decomposed.model) normalized.model = decomposed.model;
      if (decomposed.year) normalized.year = decomposed.year;
      if (decomposed.color && !normalized.color) normalized.color = decomposed.color;
    }

    return {
      rowNumber: i + 2, // +2 for 1-indexed + header row
      raw: rawRow,
      normalized,
      errors,
      isDuplicate: false,
    };
  });

  // 4. Deduplicate
  rows = detectDuplicates(rows);

  // 5. Build report
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const duplicates = rows.filter((r) => r.isDuplicate);

  const report: ImportReport = {
    totalRows: rows.length,
    validRows: rows.length - errorRows.length,
    errorRows: errorRows.length,
    duplicates: duplicates.length,
    unmappedColumns: unmapped,
    sheetNames: raw.sheetNames,
    errors: errorRows.flatMap((r) =>
      r.errors.map((e) => ({
        row: r.rowNumber,
        field: e.split(":")[0],
        message: e,
      }))
    ),
    sample: rows.slice(0, 5),
  };


  return report;
}

/**
 * Run the full import (writes to database).
 */
export async function runImport(
  filePath: string,
  sheet?: string,
  mappingOverrides?: ColumnMapping[],
  chapterId?: string,
  operatorId?: string
): Promise<ImportReport> {
  const report = await preview(filePath, sheet, mappingOverrides);

  if (!chapterId || !operatorId) {
    return report;
  }

  if (report.errorRows > 0) {
  }

  // get valid rows from the full pipeline run
  const raw = await ingest(filePath, sheet);
  const { mappings } = mappingOverrides
    ? { mappings: mappingOverrides }
    : autoMap(raw.headers);

  let rows: ImportRow[] = raw.rows.map((rawRow, i) => {
    const { normalized, errors } = normalizeRow(rawRow, mappings);
    if (normalized.vehicleDescription && !normalized.make) {
      const decomposed = decomposeVehicle(String(normalized.vehicleDescription));
      if (decomposed.make) normalized.make = decomposed.make;
      if (decomposed.model) normalized.model = decomposed.model;
      if (decomposed.year) normalized.year = decomposed.year;
      if (decomposed.color && !normalized.color) normalized.color = decomposed.color;
    }
    return { rowNumber: i + 2, raw: rawRow, normalized, errors, isDuplicate: false };
  });
  rows = detectDuplicates(rows);

  const result = await importRows(rows, chapterId, operatorId);
  if (result.errors.length > 0) {
  }

  return report;
}

// ---------- CLI ----------
const [,, command, filePath, sheet] = process.argv;

if (command && filePath) {
  switch (command) {
    case "preview":
      preview(filePath, sheet).catch(console.error);
      break;
    case "map": {
      ingest(filePath, sheet).then((raw) => {
        const result = autoMap(raw.headers);
      }).catch(console.error);
      break;
    }
    case "import":
      runImport(filePath, sheet).catch(console.error);
      break;
    default:
  }
}
