/**
 * TRACE — Demo Data Seeder (API-callable)
 *
 * Creates a representative set of demo data for exploring TRACE.
 * McLean / Langley VA residential neighborhoods. All records
 * prefixed with DEMO/FAKE for easy identification and cleanup.
 */
import { opsDb } from "../../db/connection.js";
import {
  vehicles, sightings, actors, actorVehicles,
  actorIdentifiers, actorIdentifierTypes,
  vehicleTypeAssignments, vehicleTypes,
  concernLevels, vehicleConcernHistory,
  dispatchEvents, dispatchEventTypes,
} from "../../db/schema/vault-a.js";
import { eq, sql } from "drizzle-orm";

export type SeedResult = {
  vehiclesCreated: number;
  sightingsCreated: number;
  actorsCreated: number;
  dispatchesCreated: number;
};

export async function seedDemoData(chapterId: string, reporterId: string): Promise<SeedResult> {
  const result: SeedResult = { vehiclesCreated: 0, sightingsCreated: 0, actorsCreated: 0, dispatchesCreated: 0 };

  // Get or create vehicle types
  let types = await opsDb.select().from(vehicleTypes).where(eq(vehicleTypes.chapterId, chapterId));
  if (types.length === 0) {
    const defaults = [
      { label: "Sedan", color: "#818CF8" },
      { label: "SUV", color: "#F59E0B" },
      { label: "Pickup", color: "#22C55E" },
      { label: "Van", color: "#EF4444" },
    ];
    for (const t of defaults) {
      const [created] = await opsDb.insert(vehicleTypes).values({ chapterId, ...t }).returning();
      types.push(created);
    }
  }

  // Get or create concern levels
  let levels = await opsDb.select().from(concernLevels).where(eq(concernLevels.chapterId, chapterId));
  if (levels.length === 0) {
    const defaults = [
      { label: "Noticed", color: "#94A3B8", rank: 1 },
      { label: "Monitoring", color: "#F59E0B", rank: 2 },
      { label: "Active Concern", color: "#F97316", rank: 3 },
      { label: "Priority Watch", color: "#EF4444", rank: 4 },
    ];
    for (const l of defaults) {
      const [created] = await opsDb.insert(concernLevels).values({ chapterId, ...l }).returning();
      levels.push(created);
    }
  }

  // Get or create dispatch event types
  let eventTypes = await opsDb.select().from(dispatchEventTypes).where(eq(dispatchEventTypes.chapterId, chapterId));
  if (eventTypes.length === 0) {
    const defaults = [
      { label: "Confirmed Vehicle", icon: "car", color: "#EF4444", autoCloseMinutes: 120 },
      { label: "Area Check", icon: "search", color: "#F59E0B", autoCloseMinutes: 60 },
      { label: "Community Alert", icon: "alert-triangle", color: "#818CF8", autoCloseMinutes: 240 },
    ];
    for (const t of defaults) {
      const [created] = await opsDb.insert(dispatchEventTypes).values({ chapterId, ...t }).returning();
      eventTypes.push(created);
    }
  }

  // Create demo vehicles
  const vehicleData = [
    { plate: "DEMO-001", make: "Honda", model: "Accord", year: 2018, color: "Gray", description: "DEMO: Primary tracking target" },
    { plate: "DEMO-002", make: "Ford", model: "F-150", year: 2020, color: "Black", description: "DEMO: Scout vehicle, often appears before incidents" },
    { plate: "DEMO-003", make: "Toyota", model: "Camry", year: 2019, color: "White", description: "DEMO: Possible plate swap, different plates reported" },
    { plate: "DEMO-004", make: "Nissan", model: "Altima", year: 2021, color: "Red", description: "DEMO: Frequent school zone appearances" },
    { plate: "DEMO-005", make: "Chevrolet", model: "Malibu", year: 2017, color: "Silver", description: "DEMO: Linked to stash location visits" },
  ];

  const createdVehicles: any[] = [];
  for (let i = 0; i < vehicleData.length; i++) {
    const level = levels[Math.min(i, levels.length - 1)];
    const [v] = await opsDb.insert(vehicles).values({
      chapterId, ...vehicleData[i], suspicionLevelId: level.id,
    }).returning();
    createdVehicles.push(v);
    result.vehiclesCreated++;

    // Assign a type
    if (types.length > 0) {
      await opsDb.insert(vehicleTypeAssignments).values({
        vehicleId: v.id, vehicleTypeId: types[i % types.length].id,
      }).onConflictDoNothing();
    }
  }

  // Create demo sightings (McLean VA residential, last 7 days)
  const now = Date.now();
  const sightingData = [
    { vi: 0, lat: 38.937, lng: -77.184, h: 2, note: "DEMO: Gray Accord parked at Langley Forest. Engine running, driver on phone." },
    { vi: 0, lat: 38.938, lng: -77.183, h: 26, note: "DEMO: Same Accord, different spot. Circling the block." },
    { vi: 3, lat: 38.936, lng: -77.186, h: 50, note: "DEMO: Red Altima circling near Langley Forest." },
    { vi: 1, lat: 38.944, lng: -77.170, h: 5, note: "DEMO: Black F-150 at Chain Bridge & Dolley Madison." },
    { vi: 1, lat: 38.945, lng: -77.171, h: 48, note: "DEMO: Scout vehicle returning eastbound." },
    { vi: 2, lat: 38.951, lng: -77.193, h: 36, note: "DEMO: White Camry with DIFFERENT plate spotted." },
    { vi: 4, lat: 38.949, lng: -77.191, h: 120, note: "DEMO: Malibu at north checkpoint area." },
    { vi: 0, lat: 38.940, lng: -77.165, h: 72, note: "DEMO: Accord heading east on Old Dominion Dr." },
    { vi: 0, lat: 38.940, lng: -77.180, h: 68, note: "DEMO: Accord still eastbound, approaching Langley Forest." },
    { vi: 3, lat: 38.925, lng: -77.185, h: 60, note: "DEMO: Red Altima near school zone during pickup hours." },
    { vi: 4, lat: 38.942, lng: -77.175, h: 90, note: "DEMO: Malibu brief stop, driver matches known actor." },
    { vi: 1, lat: 38.928, lng: -77.183, h: 110, note: "DEMO: Scout 4 days ago, south area patrol." },
  ];

  for (const s of sightingData) {
    const ts = new Date(now - s.h * 3600000);
    await opsDb.insert(sightings).values({
      chapterId, reporterId,
      vehicleId: createdVehicles[s.vi].id,
      plate: createdVehicles[s.vi].plate,
      lat: s.lat, lng: s.lng,
      activityDescription: s.note,
      locationDescription: "McLean VA area (DEMO)",
      observedAt: ts, submittedAt: new Date(ts.getTime() + 60000),
      triaged: true,
    });
    result.sightingsCreated++;
  }

  // Create demo actors
  const actorData = [
    { alias: "FLICKER (DEMO)", physicalDescription: "DEMO: Male, 25-30. Linked to DEMO-003 plate swap." },
    { alias: "NINE (DEMO)", physicalDescription: "DEMO: Male, 40s. Always wears a black hat." },
    { alias: "SHADE (DEMO)", physicalDescription: "DEMO: Unknown gender. Hooded figure observed at night." },
  ];

  for (let i = 0; i < actorData.length; i++) {
    const [actor] = await opsDb.insert(actors).values({ chapterId, ...actorData[i] }).returning();
    result.actorsCreated++;
    // Link to a vehicle
    await opsDb.insert(actorVehicles).values({
      actorId: actor.id, vehicleId: createdVehicles[i % createdVehicles.length].id,
    }).onConflictDoNothing();
  }

  // Create demo dispatches
  if (eventTypes.length > 0) {
    const dispatchData = [
      { lat: 38.937, lng: -77.184, h: 1, priority: "urgent" as const, status: "open" },
      { lat: 38.944, lng: -77.170, h: 3, priority: "routine" as const, status: "responding" },
    ];
    for (const d of dispatchData) {
      const ts = new Date(now - d.h * 3600000);
      await opsDb.insert(dispatchEvents).values({
        chapterId,
        eventTypeId: eventTypes[0].id,
        status: d.status, priority: d.priority,
        lat: d.lat, lng: d.lng,
        notes: "DEMO dispatch",
        createdBy: reporterId,
        createdAt: ts,
      });
      result.dispatchesCreated++;
    }
  }

  return result;
}
