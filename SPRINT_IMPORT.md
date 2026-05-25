# TRACE Sprint: Data Import Pipeline

## Context
Read `D:\Projects\TRACE\HANDOFF.md` for full project context.
Read `D:\Projects\TRACE\docs\REQUIREMENTS_SYNTHESIS.md` section 1.2 for data format details.
Read `D:\Projects\TRACE\src\db\schema\vault-a.ts` for target data model.

## Objective
Build the Excel data import and normalization pipeline in `D:\Projects\TRACE\src\services\import\`.
This is the hardest onboarding problem - dirty Excel data with hundreds of rows,
12+ columns, inconsistent formatting, no normalization. The pipeline must handle
real-world messy data gracefully.

## Stack
- Node.js + TypeScript
- SheetJS (xlsx) for Excel parsing
- Zod for validation
- CLI interface (can be called from operator dashboard later)

## Requirements

### Pipeline Stages
1. **Ingest**: Read .xlsx/.xls/.csv file, detect sheets, preview data
2. **Column Mapping**: Auto-detect column purposes (plate, make, model, color,
   date, location, notes, photos) with fuzzy header matching. Output a mapping
   config for operator review.
3. **Normalization**:
   - Plate numbers: strip spaces, uppercase, detect format patterns
   - Dates: parse multiple formats (US, ISO, natural language)
   - Locations: extract lat/lng if present, otherwise geocode address strings
   - Vehicle descriptions: split combined fields (e.g. "Red 2019 Honda Civic")
   - Duplicates: detect by plate + make + model similarity
4. **Validation**: Zod schema validation per row, collect errors
5. **Preview**: Generate a report showing:
   - Total rows, valid rows, error rows
   - Duplicate candidates
   - Unmapped columns
   - Sample of transformed data
6. **Import**: Insert validated records into TRACE database
   - Create vehicle dossiers from unique vehicles
   - Create sighting records from each row
   - Link photos if file paths or URLs are present

### Photo Handling
- If Excel has photo columns (file paths, URLs, or embedded images):
  - Extract/download photos
  - Process EXIF (preserve GPS/timestamp, strip device)
  - Create evidence records in Vault C
  - Link to sighting records

### Error Handling
- Never silently drop data
- Collect all errors with row numbers and field names
- Generate error report for operator review
- Support partial import (import valid rows, skip errors)

## File Structure
```
src/services/import/
  index.ts            # Pipeline orchestrator
  ingest.ts           # Excel/CSV reader
  mapper.ts           # Column auto-detection + mapping
  normalizer.ts       # Field normalization (plates, dates, locations)
  validator.ts        # Zod validation per row
  deduplicator.ts     # Duplicate detection
  importer.ts         # Database insertion
  report.ts           # Import preview/error report generation
  types.ts            # Import pipeline types
```

## CLI Usage
```bash
# Preview import (no database writes)
npx tsx src/services/import/index.ts preview path/to/data.xlsx

# Run import
npx tsx src/services/import/index.ts import path/to/data.xlsx

# Generate mapping config
npx tsx src/services/import/index.ts map path/to/data.xlsx > mapping.json
```

## Deliverable
Working import pipeline that can ingest a messy Excel file, auto-detect columns,
normalize data, validate, and insert into the TRACE database. Error reporting.
Duplicate detection. CLI interface.

## Commit
Commit to `D:\Projects\TRACE` repo when complete.
Message: `feat(import): Excel data import pipeline with normalization`
