/**
 * TRACE API — Incidents (P0 Unified Incident System)
 *
 * Core incident lifecycle:
 *   Reporter/Operator/Public -> create incident -> accumulate evidence ->
 *   link actors/vehicles -> operator reviews -> close or escalate to LE
 *
 * Entry points:
 *   1. Reporter portal: POST /incidents
 *   2. Operator console: POST /incidents (with filedOnBehalfOf)
 *   3. Public form: POST /incidents/public/:token
 *   4. Generate public link: POST /incidents/:id/public-link
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import {
  incidents, incidentTypes, incidentActors, incidentVehicles,
  incidentEvidence, actors, vehicles,
} from "../../db/schema/vault-a.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export const incidentsRouter = new Hono();

// ============================================================
// INCIDENT TYPES (admin CRUD)
// ============================================================
incidentsRouter.get("/types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(incidentTypes)
    .where(eq(incidentTypes.chapterId, chapterId))
    .orderBy(incidentTypes.sortOrder);
  return c.json(types);
});

incidentsRouter.post("/types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const body = await c.req.json();
  const [t] = await opsDb.insert(incidentTypes)
    .values({ chapterId, ...body }).returning();
  return c.json(t, 201);
});

incidentsRouter.put("/types/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb.update(incidentTypes)
    .set(body).where(eq(incidentTypes.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

incidentsRouter.delete("/types/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(incidentTypes).where(eq(incidentTypes.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// LIST INCIDENTS (operator view with filters)
// ============================================================
incidentsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const status = c.req.query("status");
  const severity = c.req.query("severity");
  const limit = parseInt(c.req.query("limit") || "50");

  const conditions = [eq(incidents.chapterId, chapterId)];
  if (status) conditions.push(eq(incidents.status, status as any));
  if (severity) conditions.push(eq(incidents.severity, severity as any));

  const rows = await opsDb.select().from(incidents)
    .where(and(...conditions))
    .orderBy(desc(incidents.reportedAt))
    .limit(limit);

  return c.json(rows);
});

// ============================================================
// GET INCIDENT DETAIL (with linked actors, vehicles, evidence)
// ============================================================
incidentsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [incident] = await opsDb.select().from(incidents)
    .where(eq(incidents.id, id)).limit(1);
  if (!incident) return c.json({ error: "Not found" }, 404);

  // Get linked actors with actor details
  const linkedActors = await opsDb.select({
    link: incidentActors,
    actor: actors,
  }).from(incidentActors)
    .innerJoin(actors, eq(incidentActors.actorId, actors.id))
    .where(eq(incidentActors.incidentId, id));

  // Get linked vehicles with vehicle details
  const linkedVehicles = await opsDb.select({
    link: incidentVehicles,
    vehicle: vehicles,
  }).from(incidentVehicles)
    .innerJoin(vehicles, eq(incidentVehicles.vehicleId, vehicles.id))
    .where(eq(incidentVehicles.incidentId, id));

  // Get evidence timeline
  const evidence = await opsDb.select().from(incidentEvidence)
    .where(eq(incidentEvidence.incidentId, id))
    .orderBy(incidentEvidence.addedAt);

  // Get incident type details
  let incidentType = null;
  if (incident.incidentTypeId) {
    const [t] = await opsDb.select().from(incidentTypes)
      .where(eq(incidentTypes.id, incident.incidentTypeId)).limit(1);
    incidentType = t || null;
  }

  return c.json({
    ...incident,
    incidentType,
    actors: linkedActors.map(r => ({ ...r.actor, linkRole: r.link.role, linkNotes: r.link.notes })),
    vehicles: linkedVehicles.map(r => ({ ...r.vehicle, linkRole: r.link.role, linkNotes: r.link.notes })),
    evidence,
  });
});

// ============================================================
// CREATE INCIDENT (reporter, operator, or operator-on-behalf)
// ============================================================
incidentsRouter.post("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const reporterId = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  // Auto-set severity from incident type if not provided
  let severity = body.severity || "elevated";
  if (body.incidentTypeId && !body.severity) {
    const [iType] = await opsDb.select().from(incidentTypes)
      .where(eq(incidentTypes.id, body.incidentTypeId)).limit(1);
    if (iType) severity = iType.defaultPriority;
  }

  const [incident] = await opsDb.insert(incidents).values({
    chapterId,
    incidentTypeId: body.incidentTypeId,
    reporterId: reporterId || null,
    filedOnBehalfOf: body.filedOnBehalfOf,
    lat: body.lat,
    lng: body.lng,
    locationDescription: body.locationDescription,
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : null,
    title: body.title,
    description: body.description,
    severity: severity as any,
    linkedSightingId: body.linkedSightingId,
  }).returning();

  return c.json(incident, 201);
});

// ============================================================
// UPDATE INCIDENT (operator edits)
// ============================================================
incidentsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  // Only allow safe fields to be updated
  const allowed: Record<string, any> = {};
  const fields = [
    "incidentTypeId", "title", "description", "lat", "lng",
    "locationDescription", "occurredAt", "severity", "status",
    "operatorNotes", "filedOnBehalfOf", "linkedSightingId",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) allowed[f] = body[f];
  }
  if (body.occurredAt) allowed.occurredAt = new Date(body.occurredAt);
  allowed.updatedAt = new Date();

  const [updated] = await opsDb.update(incidents)
    .set(allowed).where(eq(incidents.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// ============================================================
// CLOSE INCIDENT
// ============================================================
incidentsRouter.post("/:id/close", async (c) => {
  const id = c.req.param("id");
  const operatorId = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  const [updated] = await opsDb.update(incidents).set({
    status: "closed",
    closedAt: new Date(),
    closedBy: operatorId || null,
    closeReason: body.reason || "resolved",
    updatedAt: new Date(),
  }).where(eq(incidents.id, id)).returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// ============================================================
// ESCALATE TO LAW ENFORCEMENT
// ============================================================
incidentsRouter.post("/:id/escalate", async (c) => {
  const id = c.req.param("id");
  const operatorId = c.req.header("x-reporter-id") || "";

  const [updated] = await opsDb.update(incidents).set({
    status: "escalated_to_le",
    updatedAt: new Date(),
  }).where(eq(incidents.id, id)).returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// ============================================================
// LINK ACTOR TO INCIDENT
// ============================================================
incidentsRouter.post("/:id/actors", async (c) => {
  const incidentId = c.req.param("id");
  const body = await c.req.json();

  const [link] = await opsDb.insert(incidentActors).values({
    incidentId,
    actorId: body.actorId,
    role: body.role || "suspect",
    notes: body.notes,
  }).onConflictDoNothing().returning();

  return c.json(link || { exists: true }, 201);
});

// Remove actor from incident
incidentsRouter.delete("/:id/actors/:actorId", async (c) => {
  const incidentId = c.req.param("id");
  const actorId = c.req.param("actorId");
  await opsDb.delete(incidentActors).where(and(
    eq(incidentActors.incidentId, incidentId),
    eq(incidentActors.actorId, actorId),
  ));
  return c.json({ deleted: true });
});

// ============================================================
// LINK VEHICLE TO INCIDENT
// ============================================================
incidentsRouter.post("/:id/vehicles", async (c) => {
  const incidentId = c.req.param("id");
  const body = await c.req.json();

  const [link] = await opsDb.insert(incidentVehicles).values({
    incidentId,
    vehicleId: body.vehicleId,
    role: body.role || "involved",
    notes: body.notes,
  }).onConflictDoNothing().returning();

  return c.json(link || { exists: true }, 201);
});

// Remove vehicle from incident
incidentsRouter.delete("/:id/vehicles/:vehicleId", async (c) => {
  const incidentId = c.req.param("id");
  const vehicleId = c.req.param("vehicleId");
  await opsDb.delete(incidentVehicles).where(and(
    eq(incidentVehicles.incidentId, incidentId),
    eq(incidentVehicles.vehicleId, vehicleId),
  ));
  return c.json({ deleted: true });
});

// ============================================================
// ADD EVIDENCE TO INCIDENT
// ============================================================
incidentsRouter.post("/:id/evidence", async (c) => {
  const incidentId = c.req.param("id");
  const uploadedBy = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  const [ev] = await opsDb.insert(incidentEvidence).values({
    incidentId,
    uploadedBy: uploadedBy || null,
    evidenceType: body.evidenceType,
    caption: body.caption,
    phase: body.phase || "during_incident",
    capturedAt: body.capturedAt ? new Date(body.capturedAt) : null,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
    storageKey: body.storageKey,
    metadata: body.metadata || {},
  }).returning();

  // Move incident to "documenting" if still open
  await opsDb.update(incidents).set({
    status: "documenting",
    updatedAt: new Date(),
  }).where(and(
    eq(incidents.id, incidentId),
    eq(incidents.status, "open"),
  ));

  return c.json(ev, 201);
});

// Get evidence for an incident
incidentsRouter.get("/:id/evidence", async (c) => {
  const incidentId = c.req.param("id");
  const evidence = await opsDb.select().from(incidentEvidence)
    .where(eq(incidentEvidence.incidentId, incidentId))
    .orderBy(incidentEvidence.addedAt);
  return c.json(evidence);
});

// Delete evidence item
incidentsRouter.delete("/:id/evidence/:evidenceId", async (c) => {
  const evidenceId = c.req.param("evidenceId");
  await opsDb.delete(incidentEvidence).where(eq(incidentEvidence.id, evidenceId));
  return c.json({ deleted: true });
});

// ============================================================
// GENERATE PUBLIC LINK (operator creates shareable URL)
// ============================================================
incidentsRouter.post("/:id/public-link", async (c) => {
  const id = c.req.param("id");
  const token = nanoid(24);

  const [updated] = await opsDb.update(incidents).set({
    publicToken: token,
    updatedAt: new Date(),
  }).where(eq(incidents.id, id)).returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ token, url: `/incident/public/${token}` });
});

// ============================================================
// PUBLIC INCIDENT ROUTER (separate, mounted before auth)
// ============================================================
export const publicIncidentsRouter = new Hono();

// Public form submission (no auth, token-gated)
publicIncidentsRouter.post("/:token", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();

  const [parent] = await opsDb.select().from(incidents)
    .where(eq(incidents.publicToken, token)).limit(1);
  if (!parent) return c.json({ error: "Invalid or expired link" }, 404);

  const [submitted] = await opsDb.insert(incidents).values({
    chapterId: parent.chapterId,
    incidentTypeId: body.incidentTypeId || parent.incidentTypeId,
    lat: body.lat || parent.lat,
    lng: body.lng || parent.lng,
    locationDescription: body.locationDescription || parent.locationDescription,
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : parent.occurredAt,
    title: body.title || parent.title,
    description: body.description,
    submittedViaPublic: true,
    publicContactInfo: body.contactInfo,
    linkedSightingId: parent.linkedSightingId,
  }).returning();

  return c.json({ submitted: true, incidentId: submitted.id }, 201);
});

// Public form evidence upload (no auth, token-gated)
publicIncidentsRouter.post("/:token/evidence", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();

  const [parent] = await opsDb.select().from(incidents)
    .where(eq(incidents.publicToken, token)).limit(1);
  if (!parent) return c.json({ error: "Invalid or expired link" }, 404);

  const [ev] = await opsDb.insert(incidentEvidence).values({
    incidentId: parent.id,
    evidenceType: body.evidenceType,
    caption: body.caption,
    phase: body.phase || "follow_up",
    capturedAt: body.capturedAt ? new Date(body.capturedAt) : null,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
    storageKey: body.storageKey,
    metadata: body.metadata || {},
  }).returning();

  return c.json(ev, 201);
});

// ============================================================
// REPORTER: MY INCIDENTS
// ============================================================
incidentsRouter.get("/mine", async (c) => {
  const reporterId = c.req.header("x-reporter-id") || "";
  if (!reporterId) return c.json([]);

  const rows = await opsDb.select().from(incidents)
    .where(eq(incidents.reporterId, reporterId))
    .orderBy(desc(incidents.reportedAt))
    .limit(50);

  return c.json(rows);
});

// ============================================================
// STATS: Incident counts by status (for dashboard)
// ============================================================
incidentsRouter.get("/stats", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";

  const rows = await opsDb.select({
    status: incidents.status,
    count: sql<number>`count(*)::int`,
  }).from(incidents)
    .where(eq(incidents.chapterId, chapterId))
    .groupBy(incidents.status);

  const stats: Record<string, number> = {};
  for (const r of rows) stats[r.status] = r.count;
  return c.json(stats);
});
