/**
 * TRACE — Data Import API
 *
 * Operator-only endpoints for importing external data (Excel/CSV).
 * Pipeline: upload -> auto-map -> preview -> confirm -> import.
 * Includes demo data detection and clearing.
 */
import { Hono } from "hono";
import { preview, runImport } from "../../services/import/index.js";
import { hasDemoData, clearDemoData, refreshDemoTimestamps } from "../../services/import/clear-demo.js";
import { seedDemoData } from "../../services/import/seed-demo.js";
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export const importRouter = new Hono();

const UPLOAD_DIR = join(process.cwd(), "data", "imports");

// Ensure upload directory exists
try { mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

// GET /import/status — check for demo data
importRouter.get("/status", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const hasDemo = await hasDemoData(chapterId);
  return c.json({ hasDemoData: hasDemo });
});

// POST /import/clear-demo — remove seed data before first real import
importRouter.post("/clear-demo", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const result = await clearDemoData(chapterId);
  return c.json(result);
});

// POST /import/refresh-demo — update demo sighting timestamps to recent
importRouter.post("/refresh-demo", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const updated = await refreshDemoTimestamps(chapterId);
  return c.json({ refreshed: updated });
});

// POST /import/seed-demo — create fresh demo data from scratch
importRouter.post("/seed-demo", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  const reporterId = c.req.header("x-reporter-id");
  if (!chapterId || !reporterId) return c.json({ error: "Missing chapter or reporter" }, 400);

  const result = await seedDemoData(chapterId, reporterId);
  return c.json(result);
});

// POST /import/preview — upload file, get mapping preview
importRouter.post("/preview", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const sheet = formData.get("sheet") as string | null;

    if (!file) return c.json({ error: "No file uploaded" }, 400);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv", "tsv"].includes(ext)) {
      return c.json({ error: "Supported formats: .xlsx, .xls, .csv, .tsv" }, 400);
    }

    // Save to temp file
    const tempName = `import_${randomBytes(8).toString("hex")}.${ext}`;
    const tempPath = join(UPLOAD_DIR, tempName);
    const arrayBuffer = await file.arrayBuffer();
    writeFileSync(tempPath, Buffer.from(arrayBuffer));

    // Run preview
    const report = await preview(tempPath, sheet || undefined);

    // Return report with temp file reference (for subsequent import call)
    return c.json({
      tempFile: tempName,
      fileName: file.name,
      ...report,
    });
  } catch (err) {
    return c.json({ error: `Preview failed: ${(err as Error).message}` }, 500);
  }
});

// POST /import/run — execute import using a previously previewed file
importRouter.post("/run", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const operatorId = c.req.header("x-reporter-id");
  if (!operatorId) return c.json({ error: "Missing operator" }, 400);

  const body = await c.req.json();
  const { tempFile, sheet, mappingOverrides } = body;

  if (!tempFile) return c.json({ error: "tempFile required (from preview)" }, 400);

  const filePath = join(UPLOAD_DIR, tempFile);
  if (!existsSync(filePath)) {
    return c.json({ error: "Preview file expired. Upload again." }, 404);
  }

  try {
    const report = await runImport(
      filePath,
      sheet || undefined,
      mappingOverrides || undefined,
      chapterId,
      operatorId
    );

    // Clean up temp file
    try { unlinkSync(filePath); } catch {}

    return c.json(report);
  } catch (err) {
    return c.json({ error: `Import failed: ${(err as Error).message}` }, 500);
  }
});
