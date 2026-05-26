/**
 * TRACE API — Dispatch
 *
 * Core dispatch loop:
 *   Sighting arrives → plate auto-checked → operator confirms →
 *   dispatch created → patrollers notified → respond → outcome recorded
 *
 * Entry points:
 *   1. From triage (sighting-triggered): POST /dispatch/from-sighting/:sightingId
 *   2. From map (community call):       POST /dispatch
 *   3. Quick dispatch (confirm+send):    POST /dispatch/confirm-and-dispatch/:sightingId
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import {
  dispatchEvents, dispatchAssignments, dispatchOutcomes,
  dispatchEventTypes, sightings, sightingFeedback, vehicles,
} from "../../db/schema/vault-a.js";
import { eq, and, desc, inArray } from "drizzle-orm";

export const dispatchRouter = new Hono();

// ============================================================
// DISPATCH EVENT TYPES (admin CRUD)
// ============================================================
dispatchRouter.get("/event-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(dispatchEventTypes)
    .where(eq(dispatchEventTypes.chapterId, chapterId));
  return c.json(types);
});

dispatchRouter.post("/event-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const body = await c.req.json();
  const [t] = await opsDb.insert(dispatchEventTypes)
    .values({ chapterId, ...body }).returning();
  return c.json(t, 201);
});

dispatchRouter.put("/event-types/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb.update(dispatchEventTypes)
    .set(body).where(eq(dispatchEventTypes.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

dispatchRouter.delete("/event-types/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(dispatchEventTypes).where(eq(dispatchEventTypes.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// GET DISPATCHES (operator view)
// ============================================================
dispatchRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const status = c.req.query("status"); // open, responding, on_scene, closed, expired
  const limit = parseInt(c.req.query("limit") || "50");

  const conditions = [eq(dispatchEvents.chapterId, chapterId)];
  if (status) conditions.push(eq(dispatchEvents.status, status));

  const events = await opsDb.select().from(dispatchEvents)
    .where(and(...conditions))
    .orderBy(desc(dispatchEvents.createdAt))
    .limit(limit);

  return c.json(events);
});

// ============================================================
// GET ACTIVE DISPATCHES (reporter view — only open/responding)
// ============================================================
dispatchRouter.get("/active", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const reporterId = c.req.header("x-reporter-id") || "";

  // Get all open/responding dispatches for this chapter
  const events = await opsDb.select().from(dispatchEvents)
    .where(and(
      eq(dispatchEvents.chapterId, chapterId),
      inArray(dispatchEvents.status, ["open", "responding", "on_scene"])
    ))
    .orderBy(desc(dispatchEvents.createdAt));

  // Get this reporter's assignments
  const myAssignments = reporterId
    ? await opsDb.select().from(dispatchAssignments)
        .where(eq(dispatchAssignments.reporterId, reporterId))
    : [];

  const assignmentMap = new Map(myAssignments.map(a => [a.dispatchEventId, a]));

  // Enrich events with assignment status
  const enriched = events.map(e => ({
    ...e,
    myAssignment: assignmentMap.get(e.id) || null,
    assigned: !!assignmentMap.get(e.id),
  }));

  return c.json(enriched);
});

// ============================================================
// CREATE DISPATCH (from map / community call)
// ============================================================
dispatchRouter.post("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const createdBy = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  const [event] = await opsDb.insert(dispatchEvents).values({
    chapterId,
    lat: body.lat,
    lng: body.lng,
    locationDescription: body.locationDescription,
    plate: body.plate,
    vehicleId: body.vehicleId,
    eventTypeId: body.eventTypeId,
    notes: body.notes,
    source: body.source || "operator",
    priority: body.priority || "routine",
    createdBy,
  }).returning();

  // Assign reporters if provided
  if (body.reporterIds?.length) {
    for (const rid of body.reporterIds) {
      await opsDb.insert(dispatchAssignments).values({
        dispatchEventId: event.id,
        reporterId: rid,
      }).onConflictDoNothing();
    }
  }

  return c.json(event, 201);
});

// ============================================================
// CONFIRM & DISPATCH (from triage — the one-button action)
// Marks sighting confirmed + creates dispatch + sends feedback
// ============================================================
dispatchRouter.post("/confirm-and-dispatch/:sightingId", async (c) => {
  const sightingId = c.req.param("sightingId");
  const chapterId = c.req.header("x-chapter-id") || "";
  const operatorId = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  // 1. Get the sighting
  const [sighting] = await opsDb.select().from(sightings)
    .where(eq(sightings.id, sightingId)).limit(1);
  if (!sighting) return c.json({ error: "Sighting not found" }, 404);

  // 2. Mark sighting as triaged
  await opsDb.update(sightings).set({
    triaged: true, triagedBy: operatorId, triagedAt: new Date(), updatedAt: new Date(),
  }).where(eq(sightings.id, sightingId));

  // 3. Create dispatch event
  const [event] = await opsDb.insert(dispatchEvents).values({
    chapterId,
    sightingId,
    lat: sighting.lat,
    lng: sighting.lng,
    plate: sighting.plate,
    vehicleId: sighting.matchedVehicleId || sighting.vehicleId,
    eventTypeId: body.eventTypeId,
    notes: body.notes || sighting.activityDescription,
    source: "sighting",
    priority: body.priority || "urgent",
    createdBy: operatorId,
  }).returning();

  // 4. Assign reporters
  if (body.reporterIds?.length) {
    for (const rid of body.reporterIds) {
      await opsDb.insert(dispatchAssignments).values({
        dispatchEventId: event.id,
        reporterId: rid,
      }).onConflictDoNothing();
    }
  }

  // 5. Send feedback to the original reporter
  await opsDb.insert(sightingFeedback).values({
    sightingId,
    reporterId: sighting.reporterId,
    feedbackType: "confirmed",
    message: "Confirmed. Patrollers dispatched to the location.",
  });

  return c.json({ dispatch: event, sightingTriaged: true }, 201);
});

// ============================================================
// DISMISS & NOTIFY (from triage — tells reporter it's clean)
// ============================================================
dispatchRouter.post("/dismiss-and-notify/:sightingId", async (c) => {
  const sightingId = c.req.param("sightingId");
  const operatorId = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  // Get the sighting
  const [sighting] = await opsDb.select().from(sightings)
    .where(eq(sightings.id, sightingId)).limit(1);
  if (!sighting) return c.json({ error: "Sighting not found" }, 404);

  // Mark as triaged
  await opsDb.update(sightings).set({
    triaged: true, triagedBy: operatorId, triagedAt: new Date(), updatedAt: new Date(),
  }).where(eq(sightings.id, sightingId));

  // Send feedback
  await opsDb.insert(sightingFeedback).values({
    sightingId,
    reporterId: sighting.reporterId,
    feedbackType: "dismissed",
    message: body.message || "Not in our database. No action needed.",
  });

  return c.json({ dismissed: true, sightingId });
});

// ============================================================
// DISPATCH LIFECYCLE — reporter actions
// ============================================================

// Reporter marks "Responding"
dispatchRouter.post("/:id/respond", async (c) => {
  const dispatchId = c.req.param("id");
  const reporterId = c.req.header("x-reporter-id") || "";

  const [assignment] = await opsDb.update(dispatchAssignments).set({
    status: "responding",
    respondedAt: new Date(),
  }).where(and(
    eq(dispatchAssignments.dispatchEventId, dispatchId),
    eq(dispatchAssignments.reporterId, reporterId),
  )).returning();

  // Update dispatch status if first responder
  if (assignment) {
    await opsDb.update(dispatchEvents).set({
      status: "responding", updatedAt: new Date(),
    }).where(eq(dispatchEvents.id, dispatchId));
  }

  return c.json(assignment || { error: "Assignment not found" });
});

// Reporter marks "On Scene"
dispatchRouter.post("/:id/arrive", async (c) => {
  const dispatchId = c.req.param("id");
  const reporterId = c.req.header("x-reporter-id") || "";

  const [assignment] = await opsDb.update(dispatchAssignments).set({
    status: "on_scene",
    arrivedAt: new Date(),
  }).where(and(
    eq(dispatchAssignments.dispatchEventId, dispatchId),
    eq(dispatchAssignments.reporterId, reporterId),
  )).returning();

  if (assignment) {
    await opsDb.update(dispatchEvents).set({
      status: "on_scene", updatedAt: new Date(),
    }).where(eq(dispatchEvents.id, dispatchId));
  }

  return c.json(assignment || { error: "Assignment not found" });
});

// Reporter submits outcome (confirmed, not_found, etc.)
dispatchRouter.post("/:id/outcome", async (c) => {
  const dispatchId = c.req.param("id");
  const reporterId = c.req.header("x-reporter-id") || "";
  const body = await c.req.json();

  const [outcome] = await opsDb.insert(dispatchOutcomes).values({
    dispatchEventId: dispatchId,
    reporterId,
    sightingId: body.sightingId,
    outcome: body.outcome, // confirmed, not_found, suspect_fled, false_alarm, other
    notes: body.notes,
  }).returning();

  // Mark assignment completed
  await opsDb.update(dispatchAssignments).set({
    status: "completed",
    completedAt: new Date(),
  }).where(and(
    eq(dispatchAssignments.dispatchEventId, dispatchId),
    eq(dispatchAssignments.reporterId, reporterId),
  ));

  return c.json(outcome, 201);
});

// ============================================================
// DISPATCH LIFECYCLE — operator actions
// ============================================================

// Close a dispatch
dispatchRouter.post("/:id/close", async (c) => {
  const dispatchId = c.req.param("id");
  const body = await c.req.json();

  const [updated] = await opsDb.update(dispatchEvents).set({
    status: "closed",
    closedAt: new Date(),
    closeReason: body.reason || "operator_closed",
    updatedAt: new Date(),
  }).where(eq(dispatchEvents.id, dispatchId)).returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// Get dispatch detail with assignments and outcomes
dispatchRouter.get("/:id", async (c) => {
  const dispatchId = c.req.param("id");

  const [event] = await opsDb.select().from(dispatchEvents)
    .where(eq(dispatchEvents.id, dispatchId)).limit(1);
  if (!event) return c.json({ error: "Not found" }, 404);

  const assignments = await opsDb.select().from(dispatchAssignments)
    .where(eq(dispatchAssignments.dispatchEventId, dispatchId));

  const outcomes = await opsDb.select().from(dispatchOutcomes)
    .where(eq(dispatchOutcomes.dispatchEventId, dispatchId));

  return c.json({ ...event, assignments, outcomes });
});

// Add reporter to existing dispatch
dispatchRouter.post("/:id/assign", async (c) => {
  const dispatchId = c.req.param("id");
  const { reporterId } = await c.req.json();

  const [assignment] = await opsDb.insert(dispatchAssignments).values({
    dispatchEventId: dispatchId,
    reporterId,
  }).onConflictDoNothing().returning();

  return c.json(assignment || { exists: true }, 201);
});

// ============================================================
// REPORTER FEEDBACK — get my sighting feedback
// ============================================================
dispatchRouter.get("/my-feedback", async (c) => {
  const reporterId = c.req.header("x-reporter-id") || "";
  if (!reporterId) return c.json([]);

  const items = await opsDb.select().from(sightingFeedback)
    .where(eq(sightingFeedback.reporterId, reporterId))
    .orderBy(desc(sightingFeedback.sentAt))
    .limit(20);

  return c.json(items);
});

// Mark feedback as read
dispatchRouter.post("/feedback/:id/read", async (c) => {
  const id = c.req.param("id");
  await opsDb.update(sightingFeedback).set({ readAt: new Date() })
    .where(eq(sightingFeedback.id, id));
  return c.json({ read: true });
});
