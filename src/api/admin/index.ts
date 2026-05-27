/**
 * TRACE API — Admin
 *
 * Full CRUD for chapter configuration with dependency checking.
 * Vehicle types, suspicion levels + predicates, reporters, notifications.
 */
import { Hono } from "hono";
import { opsDb, identDb } from "../../db/connection.js";
import {
  chapters, vehicleTypes, concernLevels, concernPredicates,
  actorConcernLevels, actorConcernPredicates, actorIdentifierTypes,
  actorIdentifiers, notificationChannels, notificationRules,
  reporters, vehicles, vehicleTypeAssignments, vehicleConcernHistory,
  actors, feedback,
} from "../../db/schema/vault-a.js";
import { reporterIdentities, sessions, magicLinkTokens } from "../../db/schema/vault-b.js";
import { eq, and, count, desc } from "drizzle-orm";
import { generateCasePackage } from "../../services/case-package.js";
import { encryptFields } from "../../services/encryption.js";
import { createHash, randomBytes } from "node:crypto";
import webpush from "web-push";

export const adminRouter = new Hono();

// --- GET /admin/chapter ---
adminRouter.get("/chapter", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const [chapter] = await opsDb.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return c.json(chapter || { error: "Not found" });
});

// --- POST /admin/chapter/regenerate-code — invalidate all unused invite codes and issue a new one ---
adminRouter.post("/chapter/regenerate-code", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const { callsign } = await c.req.json().catch(() => ({ callsign: "NEW-REPORTER" }));

  // create a new reporter + invite code (same flow as generate-invite)
  const [reporter] = await opsDb.insert(reporters).values({ chapterId, callsign }).returning();
  const [identity] = await identDb.insert(reporterIdentities).values({ reporterId: reporter.id, role: "reporter" }).returning();

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;

  const codeHash = createHash("sha256").update(code).digest("hex");
  await identDb.insert(magicLinkTokens).values({
    identityId: identity.id,
    tokenHash: codeHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return c.json({ inviteCode: formatted, reporterId: reporter.id, callsign, expiresIn: "7 days" }, 201);
});

// ============================================================
// VEHICLE TYPES — full CRUD with dependency check
// ============================================================
adminRouter.get("/vehicle-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(vehicleTypes).where(eq(vehicleTypes.chapterId, chapterId));
  return c.json(types);
});

adminRouter.post("/vehicle-types", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [vt] = await opsDb.insert(vehicleTypes).values({ chapterId, ...body }).returning();
  return c.json(vt, 201);
});

adminRouter.put("/vehicle-types/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(vehicleTypes)
    .set({ label: body.label, description: body.description, color: body.color, icon: body.icon, sortOrder: body.sortOrder })
    .where(eq(vehicleTypes.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/vehicle-types/:id", async (c) => {
  const id = c.req.param("id");
  // dependency check: any vehicles assigned this type?
  const [dep] = await opsDb
    .select({ total: count() })
    .from(vehicleTypeAssignments)
    .where(eq(vehicleTypeAssignments.vehicleTypeId, id));

  if (dep.total > 0) {
    return c.json({
      error: "Cannot delete",
      reason: `${dep.total} vehicle(s) are assigned this type. Remove assignments first.`,
      dependencyCount: dep.total,
    }, 409);
  }

  await opsDb.delete(vehicleTypes).where(eq(vehicleTypes.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// SUSPICION LEVELS — full CRUD with dependency check + predicates
// ============================================================
adminRouter.get("/suspicion-levels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const levels = await opsDb.select().from(concernLevels).where(eq(concernLevels.chapterId, chapterId));
  return c.json(levels);
});

adminRouter.post("/suspicion-levels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [level] = await opsDb.insert(concernLevels).values({ chapterId, ...body }).returning();
  return c.json(level, 201);
});

adminRouter.put("/suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(concernLevels)
    .set({ label: body.label, rank: body.rank, description: body.description, color: body.color })
    .where(eq(concernLevels.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  // dependency check: any vehicles at this level?
  const [vDep] = await opsDb
    .select({ total: count() })
    .from(vehicles)
    .where(eq(vehicles.suspicionLevelId, id));

  // dependency check: any predicates targeting this level?
  const [pDep] = await opsDb
    .select({ total: count() })
    .from(concernPredicates)
    .where(eq(concernPredicates.targetLevelId, id));

  if (vDep.total > 0 || pDep.total > 0) {
    return c.json({
      error: "Cannot delete",
      reason: `${vDep.total} vehicle(s) at this level, ${pDep.total} predicate(s) targeting it.`,
      vehicleCount: vDep.total,
      predicateCount: pDep.total,
    }, 409);
  }

  await opsDb.delete(concernLevels).where(eq(concernLevels.id, id));
  return c.json({ deleted: true });
});

// --- Suspicion Predicates (promotion rules per level) ---
adminRouter.get("/suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const preds = await opsDb
    .select()
    .from(concernPredicates)
    .where(eq(concernPredicates.targetLevelId, levelId));
  return c.json(preds);
});

adminRouter.post("/suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [pred] = await opsDb
    .insert(concernPredicates)
    .values({ chapterId, targetLevelId: levelId, ...body })
    .returning();
  return c.json(pred, 201);
});

adminRouter.put("/suspicion-predicates/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(concernPredicates)
    .set({ label: body.label, predicateType: body.predicateType, config: body.config, conjunction: body.conjunction })
    .where(eq(concernPredicates.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/suspicion-predicates/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(concernPredicates).where(eq(concernPredicates.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// ACTOR SUSPICION LEVELS — full CRUD with dependency check
// ============================================================
adminRouter.get("/actor-suspicion-levels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const levels = await opsDb.select().from(actorConcernLevels).where(eq(actorConcernLevels.chapterId, chapterId));
  return c.json(levels);
});

adminRouter.post("/actor-suspicion-levels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [level] = await opsDb.insert(actorConcernLevels).values({ chapterId, ...body }).returning();
  return c.json(level, 201);
});

adminRouter.put("/actor-suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(actorConcernLevels)
    .set({ label: body.label, rank: body.rank, description: body.description, color: body.color })
    .where(eq(actorConcernLevels.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/actor-suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  const [aDep] = await opsDb.select({ total: count() }).from(actors).where(eq(actors.suspicionLevelId, id));
  const [pDep] = await opsDb.select({ total: count() }).from(actorConcernPredicates).where(eq(actorConcernPredicates.targetLevelId, id));
  if (aDep.total > 0 || pDep.total > 0) {
    return c.json({ error: "Cannot delete", reason: `${aDep.total} actor(s) at this level, ${pDep.total} predicate(s) targeting it.` }, 409);
  }
  await opsDb.delete(actorConcernLevels).where(eq(actorConcernLevels.id, id));
  return c.json({ deleted: true });
});

// --- Actor Suspicion Predicates ---
adminRouter.get("/actor-suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const preds = await opsDb.select().from(actorConcernPredicates).where(eq(actorConcernPredicates.targetLevelId, levelId));
  return c.json(preds);
});

adminRouter.post("/actor-suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [pred] = await opsDb.insert(actorConcernPredicates).values({ chapterId, targetLevelId: levelId, ...body }).returning();
  return c.json(pred, 201);
});

adminRouter.delete("/actor-suspicion-predicates/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(actorConcernPredicates).where(eq(actorConcernPredicates.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// ACTOR IDENTIFIER TYPES — chapter-defined taxonomy CRUD
// ============================================================
adminRouter.get("/actor-identifier-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(actorIdentifierTypes).where(eq(actorIdentifierTypes.chapterId, chapterId));
  return c.json(types);
});

adminRouter.post("/actor-identifier-types", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [t] = await opsDb.insert(actorIdentifierTypes).values({ chapterId, ...body }).returning();
  return c.json(t, 201);
});

adminRouter.put("/actor-identifier-types/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(actorIdentifierTypes)
    .set({ label: body.label, description: body.description, icon: body.icon, color: body.color, fieldType: body.fieldType, options: body.options, sortOrder: body.sortOrder })
    .where(eq(actorIdentifierTypes.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/actor-identifier-types/:id", async (c) => {
  const id = c.req.param("id");
  const [dep] = await opsDb.select({ total: count() }).from(actorIdentifiers).where(eq(actorIdentifiers.identifierTypeId, id));
  if (dep.total > 0) {
    return c.json({ error: "Cannot delete", reason: `${dep.total} identifier(s) use this type. Remove them first.` }, 409);
  }
  await opsDb.delete(actorIdentifierTypes).where(eq(actorIdentifierTypes.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// ACTOR IDENTIFIERS — per-actor values CRUD
// ============================================================
adminRouter.get("/actors/:actorId/identifiers", async (c) => {
  const actorId = c.req.param("actorId");
  const ids = await opsDb.select().from(actorIdentifiers).where(eq(actorIdentifiers.actorId, actorId));
  return c.json(ids);
});

adminRouter.post("/actors/:actorId/identifiers", async (c) => {
  const actorId = c.req.param("actorId");
  const body = await c.req.json();
  const [ident] = await opsDb.insert(actorIdentifiers).values({ actorId, ...body }).returning();
  return c.json(ident, 201);
});

adminRouter.put("/actor-identifiers/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(actorIdentifiers)
    .set({ value: body.value, confidence: body.confidence, notes: body.notes, lastObserved: body.lastObserved ? new Date(body.lastObserved) : undefined, updatedAt: new Date() })
    .where(eq(actorIdentifiers.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/actor-identifiers/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(actorIdentifiers).where(eq(actorIdentifiers.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// REPORTERS
// ============================================================
adminRouter.post("/reporters/invite", async (c) => {
  const { callsign, email, realName, phone } = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";

  const [reporter] = await opsDb
    .insert(reporters)
    .values({ chapterId, callsign })
    .returning();

  const encryptedIdentity = encryptFields(
    { realName, email, phone },
    ["realName", "phone"]
  );

  await identDb.insert(reporterIdentities).values({
    reporterId: reporter.id,
    realName: encryptedIdentity.realName,
    email,
    phone: encryptedIdentity.phone,
    role: "reporter",
  });

  return c.json({ reporterId: reporter.id, callsign }, 201);
});

// --- POST /admin/reporters/generate-invite — create reporter + invite code ---
// Returns a short human-readable code the operator gives to the reporter in person.
// No email required. No network required for the handoff.
adminRouter.post("/reporters/generate-invite", async (c) => {
  const { callsign } = await c.req.json();
  if (!callsign) return c.json({ error: "Callsign required" }, 400);
  const chapterId = c.req.header("x-chapter-id") || "";

  // create reporter in Vault A
  const [reporter] = await opsDb
    .insert(reporters)
    .values({ chapterId, callsign })
    .returning();

  // create identity in Vault B (no email)
  const [identity] = await identDb
    .insert(reporterIdentities)
    .values({ reporterId: reporter.id, role: "reporter" })
    .returning();

  // generate invite code: 8 alphanumeric uppercase chars, formatted XXXX-XXXX
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;

  // store as hashed token (same infrastructure as magic links)
  const codeHash = createHash("sha256").update(code).digest("hex");
  await identDb.insert(magicLinkTokens).values({
    identityId: identity.id,
    tokenHash: codeHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days to use
  });

  return c.json({
    reporterId: reporter.id,
    callsign,
    inviteCode: formatted,
    expiresIn: "7 days",
  }, 201);
});

// --- POST /admin/reporters/:id/kill — remote kill a reporter's device ---
// Suspends the reporter, revokes all sessions, sends push kill signal.
// On next check-in, the reporter's app will self-destruct.
adminRouter.post("/reporters/:id/kill", async (c) => {
  const reporterId = c.req.param("id");

  // 1. Suspend the reporter (triggers kill on next heartbeat)
  await opsDb
    .update(reporters)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(reporters.id, reporterId));

  // 2. Revoke all sessions in Vault B
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.reporterId, reporterId))
    .limit(1);

  if (identity) {
    await identDb
      .delete(sessions)
      .where(eq(sessions.identityId, identity.id));
  }

  // 3. Send push kill signal (if push subscription exists)
  const [reporter] = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.id, reporterId))
    .limit(1);

  if (reporter?.pushSubscription) {
    try {
      await webpush.sendNotification(
        reporter.pushSubscription as webpush.PushSubscription,
        JSON.stringify({ type: "kill", command: "self-destruct" })
      );
    } catch {
      // push may fail if subscription is stale — kill will still
      // fire on next heartbeat via the suspended status check
    }
  }

  return c.json({ killed: true, reporterId });
});

// --- POST /admin/reporters/:id/suspend — soft suspend (revoke access, no push kill) ---
adminRouter.post("/reporters/:id/suspend", async (c) => {
  const reporterId = c.req.param("id");

  await opsDb
    .update(reporters)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(reporters.id, reporterId));

  // revoke sessions
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.reporterId, reporterId))
    .limit(1);

  if (identity) {
    await identDb.delete(sessions).where(eq(sessions.identityId, identity.id));
  }

  return c.json({ suspended: true, reporterId });
});

// --- POST /admin/reporters/:id/reactivate ---
adminRouter.post("/reporters/:id/reactivate", async (c) => {
  const reporterId = c.req.param("id");
  await opsDb
    .update(reporters)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(reporters.id, reporterId));
  return c.json({ reactivated: true, reporterId });
});

// --- POST /admin/nuke — EMERGENCY: kill ALL reporters in chapter ---
// Suspends every reporter, revokes all sessions, sends push kill to all.
adminRouter.post("/nuke", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";

  // suspend all reporters in chapter
  const allReporters = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.chapterId, chapterId));

  let killed = 0;
  for (const reporter of allReporters) {
    // suspend
    await opsDb
      .update(reporters)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(reporters.id, reporter.id));

    // revoke sessions
    const [identity] = await identDb
      .select()
      .from(reporterIdentities)
      .where(eq(reporterIdentities.reporterId, reporter.id))
      .limit(1);

    if (identity) {
      await identDb.delete(sessions).where(eq(sessions.identityId, identity.id));
    }

    // push kill
    if (reporter.pushSubscription) {
      try {
        await webpush.sendNotification(
          reporter.pushSubscription as webpush.PushSubscription,
          JSON.stringify({ type: "kill", command: "self-destruct" })
        );
      } catch {}
    }
    killed++;
  }

  return c.json({ nuked: true, chapterId, reportersKilled: killed });
});

// ============================================================
// NOTIFICATIONS
// ============================================================
adminRouter.get("/notifications/channels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const channels = await opsDb
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.chapterId, chapterId));
  return c.json(channels);
});

adminRouter.post("/notifications/channels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [ch] = await opsDb
    .insert(notificationChannels)
    .values({ chapterId, ...body })
    .returning();
  return c.json(ch, 201);
});

// ============================================================
// FEEDBACK (bug reports — visible to operators)
// ============================================================
adminRouter.get("/feedback", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const status = c.req.query("status");
  const where = status
    ? and(eq(feedback.chapterId, chapterId), eq(feedback.status, status))
    : eq(feedback.chapterId, chapterId);
  const items = await opsDb.select().from(feedback).where(where).orderBy(desc(feedback.createdAt)).limit(100);
  return c.json(items);
});

adminRouter.patch("/feedback/:id", async (c) => {
  const id = c.req.param("id");
  const { status: newStatus, operatorNotes } = await c.req.json();
  const [updated] = await opsDb.update(feedback)
    .set({ status: newStatus, operatorNotes, updatedAt: new Date() })
    .where(eq(feedback.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// ============================================================
// CASE PACKAGES
// ============================================================
adminRouter.post("/case-packages", async (c) => {
  const { title, description, vehicleId, actorId } = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const generatedBy = c.req.header("x-reporter-id") || "";

  const result = await generateCasePackage({
    chapterId, vehicleId, actorId, title, description, generatedBy,
  });

  return c.json(result, 201);
});

// ============================================================
// OPERATOR MANAGEMENT
// ============================================================

// --- GET /admin/operators — list all operators ---
adminRouter.get("/operators", async (c) => {
  const allIdentities = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.role, "operator"));

  const operatorData = [];
  for (const identity of allIdentities) {
    const [reporter] = await opsDb
      .select()
      .from(reporters)
      .where(eq(reporters.id, identity.reporterId))
      .limit(1);
    operatorData.push({
      id: identity.reporterId,
      callsign: reporter?.callsign || "UNKNOWN",
      status: reporter?.status || "unknown",
      hasAccessCode: !!identity.accessCodeHash,
      createdAt: identity.createdAt,
    });
  }
  return c.json(operatorData);
});

// --- POST /admin/operators/create — create a new operator ---
adminRouter.post("/operators/create", async (c) => {
  const { callsign, accessCode } = await c.req.json();
  if (!callsign) return c.json({ error: "Callsign required" }, 400);
  if (!accessCode || accessCode.length < 6) {
    return c.json({ error: "Access code must be at least 6 characters" }, 400);
  }

  const chapterId = c.req.header("x-chapter-id") || "";
  const normalizedCallsign = callsign.toUpperCase().replace(/[^A-Z0-9-]/g, "");

  // Check if callsign already exists
  const [existing] = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.callsign, normalizedCallsign))
    .limit(1);
  if (existing) return c.json({ error: "Callsign already in use" }, 409);

  const [operator] = await opsDb
    .insert(reporters)
    .values({ chapterId, callsign: normalizedCallsign })
    .returning();

  const codeHash = createHash("sha256").update(accessCode).digest("hex");
  await identDb
    .insert(reporterIdentities)
    .values({
      reporterId: operator.id,
      role: "operator",
      accessCodeHash: codeHash,
    });

  return c.json({ callsign: normalizedCallsign, reporterId: operator.id }, 201);
});

// --- PUT /admin/operators/:id/access-code — update operator access code ---
adminRouter.put("/operators/:id/access-code", async (c) => {
  const reporterId = c.req.param("id");
  const { accessCode } = await c.req.json();
  if (!accessCode || accessCode.length < 6) {
    return c.json({ error: "Access code must be at least 6 characters" }, 400);
  }

  const codeHash = createHash("sha256").update(accessCode).digest("hex");
  const [updated] = await identDb
    .update(reporterIdentities)
    .set({ accessCodeHash: codeHash })
    .where(eq(reporterIdentities.reporterId, reporterId))
    .returning();

  if (!updated) return c.json({ error: "Operator not found" }, 404);
  return c.json({ updated: true });
});

// ============================================================
// BUG REPORT → GITHUB ISSUES
// Sanitizes operator-submitted reports, creates GitHub Issues.
// ============================================================
const GITHUB_TOKEN = process.env.GITHUB_PAT || "";
const GITHUB_REPO = "duke-of-beans/TRACE";

adminRouter.post("/bug-report", async (c) => {
  const body = await c.req.json();
  const { title, description, page, severity, browser, isSecurity } = body;

  if (!title || !description) return c.json({ error: "Title and description required" }, 400);

  // Sanitize: strip any UUIDs, tokens, chapter IDs, reporter IDs
  const sanitize = (s: string) =>
    s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[REDACTED-ID]")
     .replace(/Bearer\s+\S+/gi, "[REDACTED-TOKEN]")
     .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED-JWT]");

  const cleanTitle = sanitize(title);
  const cleanDesc = sanitize(description);

  const labels = ["bug", "from-app"];
  if (severity === "critical") labels.push("priority: critical");
  if (severity === "high") labels.push("priority: high");

  // Security issues: don't post publicly, just log
  if (isSecurity) {
    console.error(`[SECURITY BUG REPORT] ${cleanTitle}: ${cleanDesc}`);
    return c.json({ created: true, note: "Security reports are handled privately.", url: null });
  }

  if (!GITHUB_TOKEN) {
    return c.json({ error: "GitHub integration not configured" }, 503);
  }

  const issueBody = [
    `**Reported from:** ${page || "unknown page"}`,
    `**Browser:** ${sanitize(browser || "unknown")}`,
    `**Severity:** ${severity || "medium"}`,
    "",
    "---",
    "",
    cleanDesc,
    "",
    "_This issue was filed automatically from the TRACE operator console._",
  ].join("\n");

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title: `[Bug] ${cleanTitle}`, body: issueBody, labels }),
    });
    const data = await res.json() as { html_url?: string; message?: string };
    if (!res.ok) return c.json({ error: data.message || "GitHub API error" }, 502);
    return c.json({ created: true, url: data.html_url });
  } catch (e) {
    return c.json({ error: "Failed to reach GitHub" }, 502);
  }
});
