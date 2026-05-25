/**
 * TRACE — Excel/CSV Ingest
 *
 * Reads raw spreadsheet files and returns row data.
 * Supports xlsx, xls, csv.
 */
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

export type IngestResult = {
  sheetNames: string[];
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
};

export async function ingest(
  filePath: string,
  sheet?: string
): Promise<IngestResult> {
  const buffer = await readFile(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const sheetName = sheet || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: false,
  });

  const headers = raw.length > 0 ? Object.keys(raw[0]) : [];

  return {
    sheetNames: workbook.SheetNames,
    headers,
    rows: raw,
    totalRows: raw.length,
  };
}
