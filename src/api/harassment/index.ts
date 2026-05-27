/**
 * TRACE — Harassment Reports API
 *
 * Phone numbers become entities (like vehicles). Each report
 * links to a known_number record. Cross-reporter correlation
 * is the intelligence value: same number, multiple reporters.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { harassmentReports, knownNumbers } from "../../db/schema/vault-a.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { lookupPhoneSpokeo } from "../../services/spokeo.js";
import { isIntegrationEnabled } from "../integrations/index.js";

export const harassmentRouter = new Hono();

/** Normalize phone: strip non-digits, ensure 10+ digits */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
}

// POST / — reporter submits a harassment report
harassmentRouter.post("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  const reporterId = c.req.header("x-reporter-id");
  if (!chapterId || !reporterId) return c.json({ error: "Missing chapter or reporter" }, 400);

  const body = await c.req.json();
  const { phoneNumber, incidentType, description, occurredAt, evidenceRefs } = body;

  if (!phoneNumber) return c.json({ error: "Phone number required" }, 400);
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return c.json({ error: "Invalid phone number (10+ digits)" }, 400);

  const validTypes = ["call", "text", "voicemail", "in_person", "other"];
  if (!incidentType || !validTypes.includes(incidentType)) {
    return c.json({ error: "Type must be call, text, voicemail, in_person, or other" }, 400);
  }

  // Find or create known_number entity
  let [knownNum] = await opsDb
    .select()
    .from(knownNumbers)
    .where(and(eq(knownNumbers.chapterId, chapterId), eq(knownNumbers.phoneNumber, normalized)))
    .limit(1);

  if (!knownNum) {
    [knownNum] = await opsDb.insert(knownNumbers).values({
      chapterId,
      phoneNumber: normalized,
      reportCount: 0,
      reportersAffected: 0,
      firstReportedAt: new Date(),
      lastReportedAt: new Date(),
    }).returning();
  }

  // Create the report
  const [report] = await opsDb.insert(harassmentReports).values({
    chapterId,
    knownNumberId: knownNum.id,
    reporterId,
    phoneNumber: normalized,
    incidentType,
    description: description?.slice(0, 500) || null,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    evidenceRefs: evidenceRefs || [],
  }).returning();

  // Update known_number counters
  const reportCount = await opsDb
    .select({ cnt: sql<number>`count(*)` })
    .from(harassmentReports)
    .where(eq(harassmentReports.knownNumberId, knownNum.id));

  const reporterCount = await opsDb
    .select({ cnt: sql<number>`count(distinct ${harassmentReports.reporterId})` })
    .from(harassmentReports)
    .where(eq(harassmentReports.knownNumberId, knownNum.id));

  await opsDb.update(knownNumbers).set({
    reportCount: Number(reportCount[0]?.cnt || 0),
    reportersAffected: Number(reporterCount[0]?.cnt || 0),
    lastReportedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(knownNumbers.id, knownNum.id));

  return c.json({
    id: report.id,
    knownNumberId: knownNum.id,
    phoneNumber: normalized,
    otherReporters: Math.max(0, Number(reporterCount[0]?.cnt || 1) - 1),
    operatorTag: knownNum.operatorTag,
    operatorResponse: knownNum.operatorResponse,
  }, 201);
});

// GET /mine — reporter's own harassment reports with tags/responses
harassmentRouter.get("/mine", async (c) => {
  const reporterId = c.req.header("x-reporter-id");
  const chapterId = c.req.header("x-chapter-id");
  if (!reporterId || !chapterId) return c.json({ error: "Missing reporter or chapter" }, 400);

  const reports = await opsDb
    .select({
      id: harassmentReports.id,
      phoneNumber: harassmentReports.phoneNumber,
      incidentType: harassmentReports.incidentType,
      description: harassmentReports.description,
      occurredAt: harassmentReports.occurredAt,
      status: harassmentReports.status,
      operatorTag: harassmentReports.operatorTag,
      operatorResponse: harassmentReports.operatorResponse,
      operatorRespondedAt: harassmentReports.operatorRespondedAt,
      createdAt: harassmentReports.createdAt,
    })
    .from(harassmentReports)
    .where(and(
      eq(harassmentReports.reporterId, reporterId),
      eq(harassmentReports.chapterId, chapterId),
    ))
    .orderBy(desc(harassmentReports.createdAt))
    .limit(100);

  return c.json(reports);
});

// GET / — operator: all reports for the chapter (grouped by number)
harassmentRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  // Return known_numbers with their report counts
  const numbers = await opsDb
    .select()
    .from(knownNumbers)
    .where(eq(knownNumbers.chapterId, chapterId))
    .orderBy(desc(knownNumbers.lastReportedAt));

  return c.json(numbers);
});

// GET /:id — single report with full details
harassmentRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [report] = await opsDb
    .select()
    .from(harassmentReports)
    .where(eq(harassmentReports.id, id))
    .limit(1);
  if (!report) return c.json({ error: "Report not found" }, 404);
  return c.json(report);
});

// GET /number/:numberId/reports — all reports for a known number
harassmentRouter.get("/number/:numberId/reports", async (c) => {
  const numberId = c.req.param("numberId");
  const reports = await opsDb
    .select()
    .from(harassmentReports)
    .where(eq(harassmentReports.knownNumberId, numberId))
    .orderBy(desc(harassmentReports.occurredAt));
  return c.json(reports);
});

// PATCH /:id — operator tags/responds to a report
harassmentRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { operatorTag, operatorResponse, status } = body;

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (operatorTag !== undefined) updates.operatorTag = operatorTag;
  if (operatorResponse !== undefined) updates.operatorResponse = operatorResponse;
  if (operatorTag || operatorResponse) updates.operatorRespondedAt = new Date();
  if (status) updates.status = status;

  const [updated] = await opsDb
    .update(harassmentReports)
    .set(updates)
    .where(eq(harassmentReports.id, id))
    .returning();

  if (!updated) return c.json({ error: "Report not found" }, 404);
  return c.json(updated);
});

// PATCH /number/:numberId — operator tags/responds to a known number entity
harassmentRouter.patch("/number/:numberId", async (c) => {
  const numberId = c.req.param("numberId");
  const body = await c.req.json();
  const { operatorTag, operatorNotes, operatorResponse, status } = body;

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (operatorTag !== undefined) updates.operatorTag = operatorTag;
  if (operatorNotes !== undefined) updates.operatorNotes = operatorNotes;
  if (operatorResponse !== undefined) updates.operatorResponse = operatorResponse;
  if (status) updates.status = status;

  const [updated] = await opsDb
    .update(knownNumbers)
    .set(updates)
    .where(eq(knownNumbers.id, numberId))
    .returning();

  if (!updated) return c.json({ error: "Number not found" }, 404);
  return c.json(updated);
});

// POST /phone-lookup — two-tier phone lookup (Tier 1: DB, Tier 2: Spokeo)
harassmentRouter.post("/phone-lookup", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const body = await c.req.json();
  const normalized = normalizePhone(body.phoneNumber || "");
  if (!normalized) return c.json({ error: "Invalid phone number" }, 400);

  // Tier 1: check known_numbers
  const [known] = await opsDb
    .select()
    .from(knownNumbers)
    .where(and(eq(knownNumbers.chapterId, chapterId), eq(knownNumbers.phoneNumber, normalized)))
    .limit(1);

  if (known) {
    return c.json({
      tier: 1,
      status: "known",
      phoneNumber: normalized,
      operatorTag: known.operatorTag,
      operatorResponse: known.operatorResponse,
      reportCount: known.reportCount,
      reportersAffected: known.reportersAffected,
      cachedName: known.spokeoResult ? (known.spokeoResult as any).name || null : null,
    });
  }

  // Tier 2: Spokeo (if configured)
  const spokeoEnabled = await isIntegrationEnabled(chapterId, "spokeo");
  if (spokeoEnabled) {
    const spokeoResult = await lookupPhoneSpokeo(normalized, chapterId);
    if (spokeoResult && spokeoResult.found) {
      return c.json({
        tier: 2,
        status: "found",
        phoneNumber: normalized,
        name: spokeoResult.name,
        carrier: spokeoResult.carrier,
        lineType: spokeoResult.lineType,
      });
    }
  }

  return c.json({
    tier: spokeoEnabled ? 2 : 1,
    status: "unknown",
    phoneNumber: normalized,
    message: "Number not in chapter database.",
  });
});


// POST /number/:numberId/identify — operator triggers Spokeo lookup (full data)
harassmentRouter.post("/number/:numberId/identify", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const numberId = c.req.param("numberId");
  const [num] = await opsDb
    .select()
    .from(knownNumbers)
    .where(eq(knownNumbers.id, numberId))
    .limit(1);

  if (!num) return c.json({ error: "Number not found" }, 404);

  const result = await lookupPhoneSpokeo(num.phoneNumber, chapterId, numberId);
  if (!result) return c.json({ error: "Spokeo not configured. Set up in Admin, Integrations." }, 400);

  if (result.found) {
    return c.json({
      found: true,
      name: result.name,
      age: result.age,
      address: result.address,
      carrier: result.carrier,
      lineType: result.lineType,
      spamRisk: result.spamRisk,
      socialProfiles: result.socialProfiles,
      source: result.source,
    });
  }

  return c.json({ found: false, message: "No records found for this number." });
});
