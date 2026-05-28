/**
 * TRACE — Comprehensive Demo Data Seeder
 *
 * Creates a complete dataset that exercises every feature:
 * - 7 vehicles across all concern levels with escalation history
 * - 20+ sightings forming corridors and co-occurrence patterns
 * - 5 actors with identifiers and vehicle links
 * - All dispatch types and statuses
 * - An incident with linked vehicles, actors, and evidence phases
 * - Harassment reports
 * - Sighting feedback
 *
 * McLean / Langley VA residential neighborhoods.
 * All records prefixed DEMO for easy identification and cleanup.
 */
import { opsDb } from "../../db/connection.js";
import {
  vehicles, sightings, actors, actorVehicles,
  actorIdentifiers, actorIdentifierTypes,
  vehicleTypeAssignments, vehicleTypes,
  concernLevels, vehicleConcernHistory,
  actorConcernLevels, actorConcernHistory,
  dispatchEvents, dispatchEventTypes,
  sightingFeedback, harassmentReports, knownNumbers,
  incidents, incidentTypes, incidentVehicles, incidentActors,
  incidentEvidence,
} from "../../db/schema/vault-a.js";
import { eq, sql } from "drizzle-orm";

export type SeedResult = {
  vehiclesCreated: number;
  sightingsCreated: number;
  actorsCreated: number;
  dispatchesCreated: number;
  incidentsCreated: number;
};

// Unsplash CDN stock photos for realistic demo data
const ACTOR_PHOTOS = [
  "https://images.unsplash.com/photo-1630265947548-994d8bf4d895?ixid=M3w5MjcxMDh8MHwxfHNlYXJjaHwxfHxtYW4lMjBkYXJrJTIwcG9ydHJhaXR8ZW58MHwyfHx8MTc3OTkzNTQyOXww&ixlib=rb-4.1.0&w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618836827321-db17a0607dfa?ixid=M3w5MjcxMDh8MHwxfHNlYXJjaHwxfHxtYW4lMjBoYXQlMjBteXN0ZXJpb3VzJTIwZGFya3xlbnwwfDJ8fHwxNzc5OTM1MzQ4fDA&ixlib=rb-4.1.0&w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1763242768397-6fc0ddeb6a10?ixid=M3w5MjcxMDh8MHwxfHNlYXJjaHwxfHxob29kZWQlMjBmaWd1cmUlMjBkYXJrfGVufDB8Mnx8fDE3Nzk5MzUzNTB8MA&ixlib=rb-4.1.0&w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508153460964-48ffffcb0829?ixid=M3w5MjcxMDh8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHNpbGhvdWV0dGUlMjBjaXR5fGVufDB8Mnx8fDE3Nzk5MzUzNTJ8MA&ixlib=rb-4.1.0&w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1764150319350-70dc5d7aea97?ixid=M3w5MjcxMDh8MHwxfHNlYXJjaHwxfHxtYW4lMjBzdW5nbGFzc2VzJTIwcG9ydHJhaXQlMjBkYXJrfGVufDB8Mnx8fDE3Nzk5MzUzNTN8MA&ixlib=rb-4.1.0&w=200&h=200&fit=crop&q=80",
];
const VEHICLE_PHOTOS = [
  "https://images.unsplash.com/photo-1712885046114-5ea81a2f7555?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1766561994175-993a72f407d4?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1646960700481-c7be5224a7fc?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1646283181928-59e4244eb1e8?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1604088304819-1028e3bc7367?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1590373194581-c506a7cf5a1e?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1778005979956-f5f87ae0ced2?ixlib=rb-4.1.0&w=400&h=300&fit=crop&q=80",
];

export async function seedDemoData(chapterId: string, reporterId: string): Promise<SeedResult> {
  const result: SeedResult = { vehiclesCreated: 0, sightingsCreated: 0, actorsCreated: 0, dispatchesCreated: 0, incidentsCreated: 0 };
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600000);

  // === VEHICLE TYPES ===
  let types = await opsDb.select().from(vehicleTypes).where(eq(vehicleTypes.chapterId, chapterId));
  if (types.length === 0) {
    for (const t of [
      { label: "Sedan", color: "#818CF8" }, { label: "SUV", color: "#F59E0B" },
      { label: "Pickup", color: "#22C55E" }, { label: "Van", color: "#EF4444" },
    ]) {
      const [c] = await opsDb.insert(vehicleTypes).values({ chapterId, ...t }).returning();
      types.push(c);
    }
  }

  // === CONCERN LEVELS ===
  let levels = await opsDb.select().from(concernLevels).where(eq(concernLevels.chapterId, chapterId));
  if (levels.length === 0) {
    for (const l of [
      { label: "Noticed", color: "#94A3B8", rank: 1 },
      { label: "Monitoring", color: "#F59E0B", rank: 2 },
      { label: "Active Concern", color: "#F97316", rank: 3 },
      { label: "Priority Watch", color: "#EF4444", rank: 4 },
    ]) {
      const [c] = await opsDb.insert(concernLevels).values({ chapterId, ...l }).returning();
      levels.push(c);
    }
  }

  // === ACTOR CONCERN LEVELS ===
  let actorLevels = await opsDb.select().from(actorConcernLevels).where(eq(actorConcernLevels.chapterId, chapterId));
  if (actorLevels.length === 0) {
    for (const l of [
      { label: "Person of Interest", color: "#F59E0B", rank: 1 },
      { label: "Known Associate", color: "#F97316", rank: 2 },
      { label: "Primary Target", color: "#EF4444", rank: 3 },
    ]) {
      const [c] = await opsDb.insert(actorConcernLevels).values({ chapterId, ...l }).returning();
      actorLevels.push(c);
    }
  }

  // === ACTOR IDENTIFIER TYPES ===
  let identTypes = await opsDb.select().from(actorIdentifierTypes).where(eq(actorIdentifierTypes.chapterId, chapterId));
  if (identTypes.length === 0) {
    for (const t of [
      { label: "Scar", description: "Visible scars" },
      { label: "Tattoo", description: "Visible tattoos" },
      { label: "Clothing", description: "Distinctive clothing items" },
      { label: "Accessory", description: "Glasses, hat, watch, etc." },
    ]) {
      const [c] = await opsDb.insert(actorIdentifierTypes).values({ chapterId, ...t }).returning();
      identTypes.push(c);
    }
  }

  // === DISPATCH EVENT TYPES ===
  let eventTypes = await opsDb.select().from(dispatchEventTypes).where(eq(dispatchEventTypes.chapterId, chapterId));
  if (eventTypes.length === 0) {
    for (const t of [
      { label: "Confirmed Vehicle", icon: "car", color: "#EF4444", defaultPriority: "urgent", autoCloseHours: 2 },
      { label: "Area Check", icon: "search", color: "#F59E0B", defaultPriority: "routine", autoCloseHours: 4 },
      { label: "Community Report", icon: "alert-triangle", color: "#818CF8", defaultPriority: "routine", autoCloseHours: 4 },
      { label: "Plate Swap Alert", icon: "refresh-cw", color: "#DC2626", defaultPriority: "urgent", autoCloseHours: 2 },
      { label: "Suspicious Activity", icon: "eye", color: "#22C55E", defaultPriority: "routine", autoCloseHours: 4 },
    ]) {
      const [c] = await opsDb.insert(dispatchEventTypes).values({ chapterId, ...t }).returning();
      eventTypes.push(c);
    }
  }

  // === INCIDENT TYPES ===
  let incTypes = await opsDb.select().from(incidentTypes).where(eq(incidentTypes.chapterId, chapterId));
  if (incTypes.length === 0) {
    for (const t of [
      { label: "Vehicle Surveillance", description: "Repeated targeted vehicle presence" },
      { label: "Property Crime", description: "Theft, vandalism, or trespassing" },
      { label: "Suspicious Pattern", description: "Coordinated or recurring suspicious activity" },
    ]) {
      const [c] = await opsDb.insert(incidentTypes).values({ chapterId, ...t }).returning();
      incTypes.push(c);
    }
  }

  // === VEHICLES (7 — one at each concern level + extras) ===
  const vData = [
    { plate: "DEMO-001", make: "Honda", model: "Accord", year: 2018, color: "Gray", desc: "DEMO: Primary target. Frequent circuits through Langley Forest.", levelIdx: 3 },
    { plate: "DEMO-002", make: "Ford", model: "F-150", year: 2020, color: "Black", desc: "DEMO: Scout vehicle. Appears 30 min before DEMO-001 at same locations.", levelIdx: 2 },
    { plate: "DEMO-003", make: "Toyota", model: "Camry", year: 2019, color: "White", desc: "DEMO: Plate swap suspect. Different plates reported on same vehicle.", levelIdx: 3 },
    { plate: "DEMO-004", make: "Nissan", model: "Altima", year: 2021, color: "Red", desc: "DEMO: School zone presence during pickup hours.", levelIdx: 1 },
    { plate: "DEMO-005", make: "Chevrolet", model: "Malibu", year: 2017, color: "Silver", desc: "DEMO: Linked to known stash location visits.", levelIdx: 2 },
    { plate: "DEMO-006", make: "BMW", model: "330i", year: 2022, color: "Blue", desc: "DEMO: Resident vehicle. Cleared after investigation.", levelIdx: 0 },
    { plate: "DEMO-007", make: "Ford", model: "Transit", year: 2023, color: "White", desc: "DEMO: Delivery van. Benign but flagged for unusual hours.", levelIdx: 0 },
  ];

  const cv: any[] = [];
  for (let i = 0; i < vData.length; i++) {
    const d = vData[i];
    const level = levels[Math.min(d.levelIdx, levels.length - 1)];
    const [v] = await opsDb.insert(vehicles).values({
      chapterId, plate: d.plate, make: d.make, model: d.model, year: d.year,
      color: d.color, description: d.desc, suspicionLevelId: level.id,
      photoUrl: VEHICLE_PHOTOS[i] || undefined,
    }).returning();
    cv.push(v);
    result.vehiclesCreated++;

    // Assign vehicle type
    await opsDb.insert(vehicleTypeAssignments).values({
      vehicleId: v.id, vehicleTypeId: types[i % types.length].id,
    }).onConflictDoNothing();

    // Add concern history for escalated vehicles
    if (d.levelIdx >= 2 && levels.length >= 3) {
      await opsDb.insert(vehicleConcernHistory).values({
        vehicleId: v.id, fromLevelId: levels[0].id, toLevelId: levels[1].id,
        reason: "DEMO: Multiple sightings in area", changedBy: reporterId, changedByRole: "operator",
      });
      await opsDb.insert(vehicleConcernHistory).values({
        vehicleId: v.id, fromLevelId: levels[1].id, toLevelId: levels[d.levelIdx].id,
        reason: "DEMO: Pattern confirmed, escalating", changedBy: reporterId, changedByRole: "operator",
      });
    }
  }

  // === SIGHTINGS (24 — corridors + co-occurrence + spread across time) ===
  // Cluster 1: Langley Forest (hot zone)
  // Cluster 2: Chain Bridge / Dolley Madison
  // Cluster 3: North McLean
  // Cluster 4: South McLean
  // Corridor: DEMO-001 east-west on Old Dominion Dr
  const sData = [
    // DEMO-001 corridor (5 sequential positions = clear route)
    { vi: 0, lat: 38.940, lng: -77.200, h: 4, note: "DEMO: Accord entering area from west on Old Dominion Dr." },
    { vi: 0, lat: 38.940, lng: -77.190, h: 3.5, note: "DEMO: Accord eastbound, passing Kirby Rd." },
    { vi: 0, lat: 38.940, lng: -77.180, h: 3, note: "DEMO: Accord approaching Langley Forest." },
    { vi: 0, lat: 38.938, lng: -77.175, h: 2.5, note: "DEMO: Accord turned south into residential streets." },
    { vi: 0, lat: 38.937, lng: -77.184, h: 2, note: "DEMO: Accord parked in Langley Forest. Engine running." },
    // DEMO-002 scout (appears at same spots 30 min before DEMO-001 = co-occurrence)
    { vi: 1, lat: 38.940, lng: -77.200, h: 4.5, note: "DEMO: Black F-150 scouting entry point." },
    { vi: 1, lat: 38.938, lng: -77.175, h: 3, note: "DEMO: F-150 at same residential turn as DEMO-001." },
    { vi: 1, lat: 38.944, lng: -77.170, h: 5, note: "DEMO: F-150 at Chain Bridge intersection." },
    // DEMO-003 plate swap evidence
    { vi: 2, lat: 38.951, lng: -77.193, h: 36, note: "DEMO: White Camry spotted — plate reads DEMO-003." },
    { vi: 2, lat: 38.950, lng: -77.192, h: 24, note: "DEMO: Same white Camry but plate now reads FAKE-999. Plate swap confirmed." },
    // DEMO-004 school zone
    { vi: 3, lat: 38.925, lng: -77.185, h: 28, note: "DEMO: Red Altima near school during dismissal." },
    { vi: 3, lat: 38.926, lng: -77.184, h: 52, note: "DEMO: Altima at school zone again, morning arrival." },
    // DEMO-005 stash visits
    { vi: 4, lat: 38.942, lng: -77.175, h: 72, note: "DEMO: Malibu brief stop at suspect residence." },
    { vi: 4, lat: 38.942, lng: -77.176, h: 144, note: "DEMO: Malibu at same address, 3 days ago." },
    { vi: 4, lat: 38.943, lng: -77.174, h: 240, note: "DEMO: Malibu spotted near suspect residence 10 days ago." },
    // DEMO-006 cleared
    { vi: 5, lat: 38.935, lng: -77.178, h: 168, note: "DEMO: Blue BMW in residential area. Checked — belongs to resident." },
    // DEMO-007 delivery
    { vi: 6, lat: 38.927, lng: -77.182, h: 200, note: "DEMO: White Transit van, late night delivery. Cleared." },
    // Co-occurrence: DEMO-001 and DEMO-005 at same spot same time
    { vi: 0, lat: 38.942, lng: -77.175, h: 70, note: "DEMO: Accord at suspect residence — same time as Malibu (DEMO-005)." },
    // Older historical sightings
    { vi: 0, lat: 38.940, lng: -77.185, h: 360, note: "DEMO: Accord 15 days ago. First sighting in area." },
    { vi: 1, lat: 38.945, lng: -77.171, h: 480, note: "DEMO: F-150 20 days ago. Initial scout." },
    { vi: 3, lat: 38.928, lng: -77.183, h: 600, note: "DEMO: Altima 25 days ago, south patrol." },
    { vi: 0, lat: 38.937, lng: -77.184, h: 720, note: "DEMO: Accord 30 days ago, first Langley Forest appearance." },
    // Recent untriaged (shows pending in triage)
    { vi: 0, lat: 38.939, lng: -77.183, h: 0.5, note: "DEMO: Accord back again — third time this week.", triaged: false },
    { vi: 4, lat: 38.943, lng: -77.175, h: 1, note: "DEMO: Malibu just arrived at suspect address.", triaged: false },
  ];

  for (const s of sData) {
    const ts = ago(s.h);
    await opsDb.insert(sightings).values({
      chapterId, reporterId, vehicleId: cv[s.vi].id, plate: cv[s.vi].plate,
      lat: s.lat, lng: s.lng, activityDescription: s.note,
      locationDescription: "McLean VA area (DEMO)",
      direction: s.vi === 0 && s.h <= 4 ? "eastbound" : undefined,
      observedAt: ts, submittedAt: new Date(ts.getTime() + 60000),
      triaged: s.triaged !== false,
    });
    result.sightingsCreated++;
  }

  // === ACTORS (5 with identifiers, vehicle links, and stock photos) ===
  const aData = [
    { alias: "FLICKER (DEMO)", desc: "DEMO: Male, 25-30. Linked to DEMO-003 plate swap. Scar on left hand.", levelIdx: 2, photo: ACTOR_PHOTOS[0] },
    { alias: "NINE (DEMO)", desc: "DEMO: Male, 40s. Always wears a black hat. Seen at stash locations.", levelIdx: 1, photo: ACTOR_PHOTOS[1] },
    { alias: "SHADE (DEMO)", desc: "DEMO: Unknown gender. Hooded figure observed during night operations.", levelIdx: 0, photo: ACTOR_PHOTOS[2] },
    { alias: "SPARKS (DEMO)", desc: "DEMO: Female, 20s. Passenger in DEMO-003 and DEMO-005.", levelIdx: 1, photo: ACTOR_PHOTOS[3] },
    { alias: "GHOST (DEMO)", desc: "DEMO: Male, 30s. Frequently seen driving DEMO-001 and DEMO-002.", levelIdx: 2, photo: ACTOR_PHOTOS[4] },
  ];

  const ca: any[] = [];
  for (let i = 0; i < aData.length; i++) {
    const d = aData[i];
    const level = actorLevels.length > 0 ? actorLevels[Math.min(d.levelIdx, actorLevels.length - 1)] : null;
    const [a] = await opsDb.insert(actors).values({
      chapterId, alias: d.alias, physicalDescription: d.desc,
      photoUrl: d.photo,
      ...(level ? { suspicionLevelId: level.id } : {}),
    }).returning();
    ca.push(a);
    result.actorsCreated++;
  }

  // Actor-vehicle links (some actors linked to multiple vehicles)
  const avLinks = [[0,2], [1,4], [2,0], [3,2], [3,4], [4,0], [4,1]];
  for (const [ai, vi] of avLinks) {
    await opsDb.insert(actorVehicles).values({ actorId: ca[ai].id, vehicleId: cv[vi].id }).onConflictDoNothing();
  }

  // Actor identifiers
  if (identTypes.length >= 4) {
    const ids = [
      { ai: 0, typeIdx: 0, value: "Linear scar across left palm, ~3 inches", confidence: "confirmed", notes: "Confirmed by two reporters" },
      { ai: 0, typeIdx: 1, value: "Small cross tattoo on right wrist", confidence: "probable", notes: "Seen once in low light" },
      { ai: 1, typeIdx: 3, value: "Black flat cap, worn every sighting", confidence: "confirmed", notes: "Distinctive — never seen without it" },
      { ai: 1, typeIdx: 2, value: "Dark green military-style jacket", confidence: "probable", notes: "Worn in 3 of 4 sightings" },
      { ai: 3, typeIdx: 2, value: "Red sneakers, very distinctive", confidence: "confirmed", notes: "Easy to spot" },
      { ai: 4, typeIdx: 3, value: "Silver aviator sunglasses", confidence: "probable", notes: "Worn during daytime sightings" },
    ];
    for (const id of ids) {
      await opsDb.insert(actorIdentifiers).values({
        actorId: ca[id.ai].id, identifierTypeId: identTypes[id.typeIdx].id,
        value: id.value, confidence: id.confidence, notes: id.notes,
        firstObserved: ago(168),
      });
    }
  }

  // Actor concern history
  if (actorLevels.length >= 2) {
    await opsDb.insert(actorConcernHistory).values({
      actorId: ca[0].id, fromLevelId: actorLevels[0].id, toLevelId: actorLevels[1].id,
      reason: "DEMO: Connected to plate swap ring", changedBy: reporterId, changedByRole: "operator",
    });
    await opsDb.insert(actorConcernHistory).values({
      actorId: ca[4].id, fromLevelId: actorLevels[0].id, toLevelId: actorLevels[1].id,
      reason: "DEMO: Drives both target vehicles", changedBy: reporterId, changedByRole: "operator",
    });
  }

  // === DISPATCHES (5 — covering all statuses) ===
  if (eventTypes.length >= 3) {
    const dData = [
      { typeIdx: 0, lat: 38.937, lng: -77.184, h: 1, priority: "urgent" as const, status: "open", notes: "DEMO: Accord spotted in Langley Forest AGAIN" },
      { typeIdx: 1, lat: 38.944, lng: -77.170, h: 3, priority: "routine" as const, status: "responding", notes: "DEMO: Area check near Chain Bridge" },
      { typeIdx: 2, lat: 38.925, lng: -77.185, h: 6, priority: "routine" as const, status: "on_scene", notes: "DEMO: Community report near school" },
      { typeIdx: 3, lat: 38.950, lng: -77.192, h: 48, priority: "urgent" as const, status: "closed", notes: "DEMO: Plate swap confirmed, case documented" },
      { typeIdx: 4, lat: 38.928, lng: -77.183, h: 200, priority: "routine" as const, status: "expired", notes: "DEMO: Suspicious activity south area" },
    ];
    for (const d of dData) {
      await opsDb.insert(dispatchEvents).values({
        chapterId, eventTypeId: eventTypes[d.typeIdx].id,
        status: d.status, priority: d.priority, lat: d.lat, lng: d.lng,
        notes: d.notes, createdBy: reporterId, createdAt: ago(d.h),
      });
      result.dispatchesCreated++;
    }
  }

  // === INCIDENT (1 with linked vehicles, actors, evidence) ===
  if (incTypes.length > 0) {
    const [inc] = await opsDb.insert(incidents).values({
      chapterId, incidentTypeId: incTypes[0].id,
      title: "DEMO: Langley Forest Surveillance Pattern",
      description: "DEMO: Coordinated vehicle surveillance identified in Langley Forest subdivision. Primary vehicle (gray Accord, DEMO-001) runs repeated circuits with scout vehicle (black F-150, DEMO-002) arriving 30 minutes prior. Pattern spans 30+ days with escalating frequency.",
      status: "documenting", severity: "elevated",
      locationDescription: "Langley Forest, McLean VA", lat: 38.937, lng: -77.184,
      reportedAt: ago(48), reporterId: reporterId,
    }).returning();
    result.incidentsCreated++;

    // Link vehicles and actors to incident
    await opsDb.insert(incidentVehicles).values({ incidentId: inc.id, vehicleId: cv[0].id });
    await opsDb.insert(incidentVehicles).values({ incidentId: inc.id, vehicleId: cv[1].id });
    await opsDb.insert(incidentActors).values({ incidentId: inc.id, actorId: ca[4].id });

    // Evidence entries
    await opsDb.insert(incidentEvidence).values({
      incidentId: inc.id, phase: "during_incident", evidenceType: "observation",
      caption: "5 sequential sightings of DEMO-001 eastbound on Old Dominion Dr form a clear transit corridor.",
      uploadedBy: reporterId,
    });
    await opsDb.insert(incidentEvidence).values({
      incidentId: inc.id, phase: "post_scene", evidenceType: "observation",
      caption: "DEMO-001 and DEMO-005 observed at the same location within 2 hours on multiple occasions. Possible coordination.",
      uploadedBy: reporterId,
    });
  }

  // === HARASSMENT REPORTS ===
  let [num] = await opsDb.insert(knownNumbers).values({
    chapterId, phoneNumber: "+15551234567", reportCount: 3,
    operatorTag: "DEMO: Unknown caller",
  }).onConflictDoNothing().returning();
  if (!num) {
    // Already exists from previous seed
    const [existing] = await opsDb.select().from(knownNumbers)
      .where(sql`${knownNumbers.chapterId} = ${chapterId} AND ${knownNumbers.phoneNumber} = '+15551234567'`);
    num = existing;
  }
  if (num) {
    await opsDb.insert(harassmentReports).values({
      chapterId, knownNumberId: num.id, reporterId, phoneNumber: "+15551234567",
      incidentType: "call", occurredAt: ago(24),
      description: "DEMO: Three hang-up calls in one hour",
    });
    await opsDb.insert(harassmentReports).values({
      chapterId, knownNumberId: num.id, reporterId, phoneNumber: "+15551234567",
      incidentType: "text", occurredAt: ago(12),
      description: "DEMO: Threatening text message received",
    });
  }

  return result;
}
