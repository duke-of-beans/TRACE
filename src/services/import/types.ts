/**
 * TRACE — Data Import Pipeline Types
 */

export type ColumnMapping = {
  sourceColumn: string;
  targetField: string;
  transform?: string; // e.g. "uppercase", "parseDate", "splitVehicle"
};

export type ImportConfig = {
  file: string;
  sheet?: string;
  mappings: ColumnMapping[];
  skipRows?: number;
  dateFormat?: string;
};

export type ImportRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  errors: string[];
  isDuplicate: boolean;
};

export type ImportReport = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicates: number;
  unmappedColumns: string[];
  sheetNames: string[];
  errors: Array<{ row: number; field: string; message: string }>;
  sample: ImportRow[];
};

export const TARGET_FIELDS = [
  "plate", "make", "model", "year", "color",
  "vehicleDescription", "observedDate", "observedTime",
  "lat", "lng", "locationDescription",
  "activityDescription", "direction", "notes",
  "driverAlias", "driverDescription", "riskLevel",
  "photoPath",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];
