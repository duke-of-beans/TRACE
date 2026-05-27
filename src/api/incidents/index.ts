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
// GENERATE OBSERVATION RECORD (structured dossier data)
// Returns complete incident data formatted for PDF export.
// Includes disclaimers and provenance metadata per WHETSTONE audit.
// ============================================================
incidentsRouter.get("/:id/record", async (c) => {
  const id = c.req.param("id");

  // Get full incident detail
  const [incident] = await opsDb.select().from(incidents)
    .where(eq(incidents.id, id)).limit(1);
  if (!incident) return c.json({ error: "Not found" }, 404);

  let incidentType = null;
  if (incident.incidentTypeId) {
    const [t] = await opsDb.select().from(incidentTypes)
      .where(eq(incidentTypes.id, incident.incidentTypeId)).limit(1);
    incidentType = t || null;
  }

  const linkedActors = await opsDb.select({
    link: incidentActors, actor: actors,
  }).from(incidentActors)
    .innerJoin(actors, eq(incidentActors.actorId, actors.id))
    .where(eq(incidentActors.incidentId, id));

  const linkedVehicles = await opsDb.select({
    link: incidentVehicles, vehicle: vehicles,
  }).from(incidentVehicles)
    .innerJoin(vehicles, eq(incidentVehicles.vehicleId, vehicles.id))
    .where(eq(incidentVehicles.incidentId, id));

  const evidence = await opsDb.select().from(incidentEvidence)
    .where(eq(incidentEvidence.incidentId, id))
    .orderBy(incidentEvidence.addedAt);

  return c.json({
    disclaimer: "COMMUNITY OBSERVATION RECORD. This document contains observations reported by civilian community members. Contents have not been verified by law enforcement or legal authorities. Reporter identifiers are pseudonymous. Evidence provenance is tracked but chain of custody is civilian-grade. This record is provided as-is for informational purposes.",
    generatedAt: new Date().toISOString(),
    incident: {
      id: incident.id,
      type: incidentType?.label || "Unclassified",
      status: incident.status,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      location: {
        lat: incident.lat,
        lng: incident.lng,
        description: incident.locationDescription,
      },
      timing: {
        occurred: incident.occurredAt,
        reported: incident.reportedAt,
        closed: incident.closedAt,
      },
      filedOnBehalfOf: incident.filedOnBehalfOf,
      operatorNotes: incident.operatorNotes,
    },
    persons: linkedActors.map(r => ({
      alias: r.actor.alias,
      role: r.link.role,
      physicalDescription: r.actor.physicalDescription,
      notes: r.link.notes,
      source: "community_observation",
    })),
    vehicles: linkedVehicles.map(r => ({
      plate: r.vehicle.plate,
      make: r.vehicle.make,
      model: r.vehicle.model,
      year: r.vehicle.year,
      color: r.vehicle.color,
      role: r.link.role,
      notes: r.link.notes,
      source: "community_observation",
    })),
    evidence: evidence.map(ev => ({
      type: ev.evidenceType,
      caption: ev.caption,
      phase: ev.phase,
      capturedAt: ev.capturedAt,
      addedAt: ev.addedAt,
      mimeType: ev.mimeType,
      fileSize: ev.fileSize,
      provenance: ev.uploadedBy ? "authenticated_reporter" : "public_form",
    })),
    metadata: {
      totalEvidence: evidence.length,
      totalPersons: linkedActors.length,
      totalVehicles: linkedVehicles.length,
      publicSubmissions: incident.publicSubmissionCount || 0,
      hasPublicFormEvidence: evidence.some(e => !e.uploadedBy),
    },
  });
});

// ============================================================
// CORRELATION: Find overlapping reports for the same event
// Auto-detects incidents near the same time/location.
// Surfaces agreements and discrepancies between reporters.
// ============================================================
incidentsRouter.get("/:id/correlate", async (c) => {
  const id = c.req.param("id");

  const [incident] = await opsDb.select().from(incidents)
    .where(eq(incidents.id, id)).limit(1);
  if (!incident) return c.json({ error: "Not found" }, 404);

  // Find incidents in the same chapter within 2 hours and ~1km
  const timeWindow = 2 * 60 * 60 * 1000; // 2 hours
  const latRange = 0.009; // ~1km
  const lngRange = 0.012; // ~1km at mid-latitudes

  const conditions = [
    eq(incidents.chapterId, incident.chapterId),
    sql`${incidents.id} != ${id}`,
  ];

  if (incident.occurredAt) {
    const before = new Date(new Date(incident.occurredAt).getTime() - timeWindow);
    const after = new Date(new Date(incident.occurredAt).getTime() + timeWindow);
    conditions.push(sql`${incidents.occurredAt} BETWEEN ${before.toISOString()} AND ${after.toISOString()}`);
  }

  if (incident.lat && incident.lng) {
    conditions.push(sql`${incidents.lat} BETWEEN ${incident.lat - latRange} AND ${incident.lat + latRange}`);
    conditions.push(sql`${incidents.lng} BETWEEN ${incident.lng - lngRange} AND ${incident.lng + lngRange}`);
  }

  const overlapping = await opsDb.select().from(incidents)
    .where(and(...conditions))
    .orderBy(incidents.reportedAt)
    .limit(10);

  if (overlapping.length === 0) {
    return c.json({ incident_id: id, overlapping_count: 0, correlations: [], note: "No overlapping reports found for this time and location." });
  }

  // Get linked actors/vehicles for all overlapping incidents
  const allIds = [id, ...overlapping.map(o => o.id)];
  const allActorLinks = await opsDb.select({ incidentId: incidentActors.incidentId, actorId: incidentActors.actorId })
    .from(incidentActors).where(sql`${incidentActors.incidentId} IN (${sql.join(allIds.map(i => sql`${i}`), sql`, `)})`);
  const allVehicleLinks = await opsDb.select({ incidentId: incidentVehicles.incidentId, vehicleId: incidentVehicles.vehicleId })
    .from(incidentVehicles).where(sql`${incidentVehicles.incidentId} IN (${sql.join(allIds.map(i => sql`${i}`), sql`, `)})`);

  // Build correlation data
  const primaryActors = new Set(allActorLinks.filter(l => l.incidentId === id).map(l => l.actorId));
  const primaryVehicles = new Set(allVehicleLinks.filter(l => l.incidentId === id).map(l => l.vehicleId));

  const correlations = overlapping.map(o => {
    const oActors = new Set(allActorLinks.filter(l => l.incidentId === o.id).map(l => l.actorId));
    const oVehicles = new Set(allVehicleLinks.filter(l => l.incidentId === o.id).map(l => l.vehicleId));

    const sharedActors = [...primaryActors].filter(a => oActors.has(a));
    const sharedVehicles = [...primaryVehicles].filter(v => oVehicles.has(v));
    const uniqueActors = [...oActors].filter(a => !primaryActors.has(a));
    const uniqueVehicles = [...oVehicles].filter(v => !primaryVehicles.has(v));

    return {
      incident_id: o.id,
      title: o.title,
      reporter_id: o.reporterId,
      reported_at: o.reportedAt,
      description_excerpt: o.description?.slice(0, 200),
      agreements: {
        shared_actors: sharedActors.length,
        shared_vehicles: sharedVehicles.length,
      },
      discrepancies: {
        unique_actors: uniqueActors.length,
        unique_vehicles: uniqueVehicles.length,
        different_type: o.incidentTypeId !== incident.incidentTypeId,
        different_severity: o.severity !== incident.severity,
      },
    };
  });

  return c.json({
    incident_id: id,
    overlapping_count: overlapping.length,
    correlations,
    summary: {
      total_reporters: new Set([incident.reporterId, ...overlapping.map(o => o.reporterId)].filter(Boolean)).size,
      total_actors_across_all: new Set(allActorLinks.map(l => l.actorId)).size,
      total_vehicles_across_all: new Set(allVehicleLinks.map(l => l.vehicleId)).size,
    },
  });
});

// ============================================================
// PRINTABLE OBSERVATION RECORD (HTML for print-to-PDF)
// ============================================================
incidentsRouter.get("/:id/record/print", async (c) => {
  const id = c.req.param("id");
  const [incident] = await opsDb.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  if (!incident) return c.text("Not found", 404);

  let incidentType = null;
  if (incident.incidentTypeId) {
    const [t] = await opsDb.select().from(incidentTypes).where(eq(incidentTypes.id, incident.incidentTypeId)).limit(1);
    incidentType = t || null;
  }

  const linkedActors = await opsDb.select({ link: incidentActors, actor: actors })
    .from(incidentActors).innerJoin(actors, eq(incidentActors.actorId, actors.id))
    .where(eq(incidentActors.incidentId, id));

  const linkedVehicles = await opsDb.select({ link: incidentVehicles, vehicle: vehicles })
    .from(incidentVehicles).innerJoin(vehicles, eq(incidentVehicles.vehicleId, vehicles.id))
    .where(eq(incidentVehicles.incidentId, id));

  const evidence = await opsDb.select().from(incidentEvidence)
    .where(eq(incidentEvidence.incidentId, id)).orderBy(incidentEvidence.addedAt);

  const fmtDate = (d: any) => d ? new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "N/A";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>TRACE Observation Record</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a;font-size:13px;line-height:1.6}
h1{font-size:20px;font-weight:300;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px}
h2{font-size:14px;font-weight:600;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd}
.disclaimer{background:#f8f8f0;border:1px solid #e0e0d0;padding:12px;font-size:11px;margin:16px 0;line-height:1.5}
table{width:100%;border-collapse:collapse;margin:8px 0}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #eee}
th{font-weight:600;width:140px;color:#666;font-size:11px;text-transform:uppercase}
.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600}
.evidence-item{padding:8px;margin:4px 0;background:#fafafa;border-left:3px solid #ccc}
@media print{body{padding:20px}.disclaimer{break-inside:avoid}}
</style></head><body>
<h1>TRACE</h1>
<p style="font-size:11px;color:#888;margin-bottom:16px">Community Observation Record</p>
<div class="disclaimer">
COMMUNITY OBSERVATION RECORD. This document contains observations reported by civilian community members.
Contents have not been verified by law enforcement or legal authorities. Reporter identifiers are pseudonymous.
Evidence provenance is tracked but chain of custody is civilian-grade. Provided as-is for informational purposes.
</div>

<h2>Incident Details</h2>
<table>
<tr><th>ID</th><td style="font-family:monospace;font-size:11px">${incident.id}</td></tr>
<tr><th>Type</th><td>${incidentType?.label || "Unclassified"}</td></tr>
<tr><th>Status</th><td>${incident.status}</td></tr>
<tr><th>Severity</th><td>${incident.severity}</td></tr>
<tr><th>Title</th><td>${incident.title || "Untitled"}</td></tr>
<tr><th>Occurred</th><td>${fmtDate(incident.occurredAt)}</td></tr>
<tr><th>Reported</th><td>${fmtDate(incident.reportedAt)}</td></tr>
${incident.closedAt ? `<tr><th>Closed</th><td>${fmtDate(incident.closedAt)}</td></tr>` : ""}
<tr><th>Location</th><td>${incident.locationDescription || "Not specified"}${incident.lat ? ` (${incident.lat}, ${incident.lng})` : ""}</td></tr>
</table>
<p style="margin-top:8px">${incident.description || ""}</p>
${incident.operatorNotes ? `<p style="margin-top:8px;color:#666"><em>Operator notes: ${incident.operatorNotes}</em></p>` : ""}

${linkedActors.length > 0 ? `<h2>Persons (${linkedActors.length})</h2><table>
<tr><th>Alias</th><th>Role</th><th>Description</th><th>Notes</th></tr>
${linkedActors.map(r => `<tr><td>${r.actor.alias || "Unknown"}</td><td>${r.link.role || ""}</td><td>${r.actor.physicalDescription || ""}</td><td>${r.link.notes || ""}</td></tr>`).join("")}
</table>` : ""}

${linkedVehicles.length > 0 ? `<h2>Vehicles (${linkedVehicles.length})</h2><table>
<tr><th>Plate</th><th>Vehicle</th><th>Role</th><th>Notes</th></tr>
${linkedVehicles.map(r => `<tr><td style="font-family:monospace">${r.vehicle.plate || "N/A"}</td><td>${[r.vehicle.color, r.vehicle.year, r.vehicle.make, r.vehicle.model].filter(Boolean).join(" ")}</td><td>${r.link.role || ""}</td><td>${r.link.notes || ""}</td></tr>`).join("")}
</table>` : ""}

${evidence.length > 0 ? `<h2>Evidence (${evidence.length})</h2>
${evidence.map(ev => `<div class="evidence-item">
<strong>${ev.evidenceType}</strong> — ${ev.caption || "No caption"}<br>
<span style="color:#888;font-size:11px">Phase: ${ev.phase} | Captured: ${fmtDate(ev.capturedAt)} | Added: ${fmtDate(ev.addedAt)} | Source: ${ev.uploadedBy ? "authenticated reporter" : "public form"}</span>
</div>`).join("")}` : ""}

<div style="margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999">
Generated ${new Date().toISOString()} | TRACE Community Observation Record | Not a law enforcement document
</div>
</body></html>`;

  return c.html(html);
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
    role: body.role || "associated",
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
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const [updated] = await opsDb.update(incidents).set({
    publicToken: token,
    publicTokenExpiresAt: expiresAt,
    publicSubmissionCount: 0,
    updatedAt: new Date(),
  }).where(eq(incidents.id, id)).returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ token, url: `/incident/public/${token}`, expiresAt: expiresAt.toISOString() });
});

// ============================================================
// PUBLIC INCIDENT ROUTER (separate, mounted before auth)
// ============================================================
export const publicIncidentsRouter = new Hono();

const MAX_PUBLIC_SUBMISSIONS = 20;

// Shared token validation helper
async function validatePublicToken(token: string) {
  const [parent] = await opsDb.select().from(incidents)
    .where(eq(incidents.publicToken, token)).limit(1);
  if (!parent) return { error: "Invalid or expired link", status: 404 as const };
  if (parent.publicTokenExpiresAt && new Date() > new Date(parent.publicTokenExpiresAt))
    return { error: "This link has expired. Contact the operator for a new one.", status: 410 as const };
  if ((parent.publicSubmissionCount || 0) >= MAX_PUBLIC_SUBMISSIONS)
    return { error: "Submission limit reached for this link.", status: 429 as const };
  return { parent };
}

// Public form submission (no auth, token-gated)
publicIncidentsRouter.post("/:token", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();

  const result = await validatePublicToken(token);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  const { parent } = result;

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

  // Increment submission counter
  await opsDb.update(incidents).set({
    publicSubmissionCount: sql`COALESCE(public_submission_count, 0) + 1`,
  }).where(eq(incidents.id, parent.id));

  return c.json({ submitted: true, incidentId: submitted.id }, 201);
});

// Public form evidence upload (no auth, token-gated)
publicIncidentsRouter.post("/:token/evidence", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();

  const result = await validatePublicToken(token);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  const { parent } = result;

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

  // Increment submission counter
  await opsDb.update(incidents).set({
    publicSubmissionCount: sql`COALESCE(public_submission_count, 0) + 1`,
  }).where(eq(incidents.id, parent.id));

  return c.json(ev, 201);
});

// ============================================================
// RAPID CAPTURE (one-tap incident filing from reporter)
// Minimal input: GPS auto-captured, structure applied later.
// ============================================================
incidentsRouter.post("/rapid", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const reporterId = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  const [incident] = await opsDb.insert(incidents).values({
    chapterId,
    reporterId: reporterId || null,
    lat: body.lat,
    lng: body.lng,
    locationDescription: body.locationDescription,
    occurredAt: new Date(),
    title: body.title || "Rapid capture",
    description: body.description || "Filed via rapid capture. Details pending.",
    severity: "urgent",
    status: "open",
  }).returning();

  // If evidence data is included (photo/audio), attach it immediately
  if (body.evidence) {
    await opsDb.insert(incidentEvidence).values({
      incidentId: incident.id,
      uploadedBy: reporterId || null,
      evidenceType: body.evidence.type || "photo",
      caption: body.evidence.caption || "Auto-captured during rapid filing",
      phase: "during_incident",
      capturedAt: new Date(),
      mimeType: body.evidence.mimeType,
      fileSize: body.evidence.fileSize,
      storageKey: body.evidence.storageKey,
      metadata: body.evidence.metadata || {},
    });
  }

  return c.json(incident, 201);
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
