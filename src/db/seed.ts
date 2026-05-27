/**
 * TRACE — Seed Script
 *
 * Populates all three vaults with obviously fake demo data.
 * Every record is clearly marked as test data.
 */
import "dotenv/config";
import { opsDb, identDb } from "./connection.js";
import {
  chapters, vehicleTypes, suspicionLevels, suspicionPredicates,
  actorSuspicionLevels, actorIdentifierTypes, actorIdentifiers,
  reporters, vehicles, vehicleTypeAssignments, actors, sightings,
  dispatchEventTypes, tagDefinitions,
} from "./schema/vault-a.js";
import { reporterIdentities } from "./schema/vault-b.js";

async function seed() {
  console.log("Seeding TRACE with demo data...\n");

  // CHAPTER
  const [chapter] = await opsDb
    .insert(chapters)
    .values({ name: "DEMO CHAPTER", slug: "demo-chapter", sunsetDays: 90 })
    .onConflictDoNothing()
    .returning();
  const chapterId = chapter?.id || (await opsDb.select().from(chapters).limit(1))[0].id;
  console.log(`+ Chapter: ${chapterId}`);

  // VEHICLE TYPES
  const typeData = [
    { label: "Runner",  color: "#DC2626", description: "Transports product between locations",  sortOrder: 4 },
    { label: "Scout",   color: "#D97706", description: "Watches and reports on targets",        sortOrder: 3 },
    { label: "Stash",   color: "#4F46E5", description: "Parked vehicle used for storage",       sortOrder: 2 },
    { label: "Decoy",   color: "#64748B", description: "Draws attention away from real ops",     sortOrder: 1 },
    { label: "Unknown", color: "#94A3B8", description: "Role not yet determined",                sortOrder: 0 },
  ];
  for (const t of typeData) {
    await opsDb.insert(vehicleTypes).values({ ...t, chapterId }).onConflictDoNothing();
  }
  const types = await opsDb.select().from(vehicleTypes);
  console.log(`+ Vehicle types: ${types.length}`);

  // SUSPICION LEVELS
  const levelData = [
    { label: "Noted",      color: "#94A3B8", rank: 1, description: "Seen once, no pattern yet" },
    { label: "Watching",   color: "#D97706", rank: 2, description: "Seen multiple times, possible pattern" },
    { label: "Suspicious", color: "#EA580C", rank: 3, description: "Clear pattern, likely operational" },
    { label: "Confirmed",  color: "#DC2626", rank: 4, description: "Confirmed operational role" },
    { label: "Priority",   color: "#7C3AED", rank: 5, description: "Highest priority, active and dangerous" },
  ];
  for (const l of levelData) {
    await opsDb.insert(suspicionLevels).values({ ...l, chapterId }).onConflictDoNothing();
  }
  const levels = await opsDb.select().from(suspicionLevels);
  console.log(`+ Suspicion levels: ${levels.length}`);

  // SUSPICION PREDICATES
  const watchingLevel = levels.find((l) => l.label === "Watching");
  const suspiciousLevel = levels.find((l) => l.label === "Suspicious");
  if (watchingLevel) {
    await opsDb.insert(suspicionPredicates).values({
      chapterId, targetLevelId: watchingLevel.id,
      label: "3+ sightings across 2+ days",
      predicateType: "count_based",
      config: { field: "sighting_count", operator: ">=", value: 3, window_days: 30 },
    }).onConflictDoNothing();
  }
  if (suspiciousLevel) {
    await opsDb.insert(suspicionPredicates).values({
      chapterId, targetLevelId: suspiciousLevel.id,
      label: "6+ sightings across 3+ locations",
      predicateType: "count_based",
      config: { field: "sighting_count", operator: ">=", value: 6, distinct_locations: 3 },
    }).onConflictDoNothing();
  }
  console.log(`+ Suspicion predicates seeded`);

  // ACTOR SUSPICION LEVELS
  const actorLevelData = [
    { label: "Person of Interest", color: "#D97706", rank: 1, description: "Linked to suspicious vehicle" },
    { label: "Known Associate",    color: "#EA580C", rank: 2, description: "Confirmed connection to operations" },
    { label: "Primary Target",     color: "#DC2626", rank: 3, description: "Key individual in network" },
  ];
  for (const al of actorLevelData) {
    await opsDb.insert(actorSuspicionLevels).values({ ...al, chapterId }).onConflictDoNothing();
  }
  console.log(`+ Actor suspicion levels seeded`);

  // ACTOR IDENTIFIER TYPES
  const idTypeData = [
    { label: "Tattoo",       description: "Visible tattoos, location and design" },
    { label: "Scar",         description: "Visible scars or marks" },
    { label: "Hair",         description: "Hair color, style, length" },
    { label: "Build",        description: "Height, weight, body type" },
    { label: "Clothing",     description: "Frequently worn clothing or accessories" },
    { label: "Vehicle Link", description: "Vehicles this person has been seen with" },
    { label: "Habit",        description: "Behavioral patterns, routes, times, routines" },
    { label: "Alias",        description: "Known aliases or nicknames" },
  ];
  for (const idt of idTypeData) {
    await opsDb.insert(actorIdentifierTypes).values({ ...idt, chapterId }).onConflictDoNothing();
  }
  const idTypes = await opsDb.select().from(actorIdentifierTypes);
  console.log(`+ Actor identifier types: ${idTypes.length}`);

  // DEMO REPORTERS
  const reporterData = [
    { callsign: "FALCON-1 (DEMO)", email: "falcon1@demo.trace" },
    { callsign: "SPARROW-2 (DEMO)", email: "sparrow2@demo.trace" },
    { callsign: "HAWK-3 (DEMO)", email: "hawk3@demo.trace" },
  ];
  const reporterIds: string[] = [];
  for (const r of reporterData) {
    const [rep] = await opsDb.insert(reporters).values({ chapterId, callsign: r.callsign }).onConflictDoNothing().returning();
    if (rep) {
      reporterIds.push(rep.id);
      await identDb.insert(reporterIdentities).values({ reporterId: rep.id, email: r.email, role: "reporter" }).onConflictDoNothing();
    }
  }
  // ensure at least one reporter ID for sighting FK
  if (reporterIds.length === 0) {
    const existing = await opsDb.select().from(reporters).limit(1);
    if (existing.length > 0) reporterIds.push(existing[0].id);
  }
  console.log(`+ Demo reporters: ${reporterIds.length}`);

  // DEMO VEHICLES
  const notedLevel = levels.find((l) => l.label === "Noted");
  const confirmedLevel = levels.find((l) => l.label === "Confirmed");
  const runnerType = types.find((t) => t.label === "Runner");
  const scoutType = types.find((t) => t.label === "Scout");

  const vehicleData = [
    { plate: "FAKE-001", make: "Honda",  model: "Civic", year: 2019, color: "Red",    description: "DEMO: Red 2019 Honda Civic, tinted rear windows, dent on driver door",  levelId: watchingLevel?.id },
    { plate: "FAKE-002", make: "Toyota", model: "Camry", year: 2021, color: "Black",  description: "DEMO: Black 2021 Toyota Camry, tinted windows, aftermarket rims",       levelId: suspiciousLevel?.id },
    { plate: "FAKE-003", make: "Ford",   model: "F-150", year: 2018, color: "White",  description: "DEMO: White 2018 Ford F-150, lifted, mud tires, no front plate",         levelId: confirmedLevel?.id },
    { plate: "TEST-004", make: "Chevy",  model: "Malibu",year: 2020, color: "Silver", description: "DEMO: Silver 2020 Chevy Malibu, Uber sticker in window",                 levelId: notedLevel?.id },
    { plate: "TEST-005", make: "Nissan", model: "Altima",year: 2017, color: "Blue",   description: "DEMO: Blue 2017 Nissan Altima, cracked windshield, loud exhaust",         levelId: watchingLevel?.id },
  ];
  const vehicleIds: string[] = [];
  for (const v of vehicleData) {
    const [veh] = await opsDb.insert(vehicles).values({
      chapterId, plate: v.plate, make: v.make, model: v.model,
      year: v.year, color: v.color, description: v.description,
      suspicionLevelId: v.levelId || notedLevel?.id,
    }).onConflictDoNothing().returning();
    if (veh) vehicleIds.push(veh.id);
  }
  // type assignments — raw SQL to avoid column mapping issues
  if (vehicleIds[0] && runnerType) await opsDb.execute(`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), '${vehicleIds[0]}', '${runnerType.id}') ON CONFLICT DO NOTHING`);
  if (vehicleIds[1] && scoutType) await opsDb.execute(`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), '${vehicleIds[1]}', '${scoutType.id}') ON CONFLICT DO NOTHING`);
  if (vehicleIds[2] && runnerType) await opsDb.execute(`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), '${vehicleIds[2]}', '${runnerType.id}') ON CONFLICT DO NOTHING`);
  console.log(`+ Demo vehicles: ${vehicleIds.length}`);

  // DEMO ACTORS
  const actorLevels = await opsDb.select().from(actorSuspicionLevels);
  const poiLevel = actorLevels.find((l) => l.label === "Person of Interest");
  const primaryLevel = actorLevels.find((l) => l.label === "Primary Target");

  const actorData = [
    { alias: "GHOST (DEMO)",  desc: "DEMO: Frequently seen driving FAKE-001 and FAKE-003. Male, 30s.",  levelId: primaryLevel?.id },
    { alias: "SPARKS (DEMO)", desc: "DEMO: Passenger in FAKE-002 on multiple occasions. Female, 20s.",  levelId: poiLevel?.id },
    { alias: "NINE (DEMO)",   desc: "DEMO: Always wears a black hat. Seen at stash locations.",          levelId: poiLevel?.id },
  ];
  const actorIds: string[] = [];
  for (const a of actorData) {
    const [act] = await opsDb.insert(actors).values({
      chapterId, alias: a.alias, physicalDescription: a.desc, suspicionLevelId: a.levelId,
    }).onConflictDoNothing().returning();
    if (act) actorIds.push(act.id);
  }
  console.log(`+ Demo actors: ${actorIds.length}`);

  // DEMO IDENTIFIERS
  const tattooType = idTypes.find((t) => t.label === "Tattoo");
  const buildType = idTypes.find((t) => t.label === "Build");
  const habitType = idTypes.find((t) => t.label === "Habit");
  const clothingType = idTypes.find((t) => t.label === "Clothing");
  const aliasType = idTypes.find((t) => t.label === "Alias");

  if (actorIds[0]) {
    if (tattooType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[0], identifierTypeId: tattooType.id, value: "DEMO: Dragon tattoo on left forearm", confidence: "confirmed" }).onConflictDoNothing();
    if (buildType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[0], identifierTypeId: buildType.id, value: "DEMO: 6ft, medium build, short brown hair", confidence: "confirmed" }).onConflictDoNothing();
    if (habitType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[0], identifierTypeId: habitType.id, value: "DEMO: Usually seen between 10pm-2am on Oak St", confidence: "probable" }).onConflictDoNothing();
  }
  if (actorIds[1]) {
    if (clothingType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[1], identifierTypeId: clothingType.id, value: "DEMO: Red jacket, white sneakers", confidence: "probable" }).onConflictDoNothing();
    if (buildType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[1], identifierTypeId: buildType.id, value: "DEMO: 5ft5, slim, long black hair", confidence: "confirmed" }).onConflictDoNothing();
  }
  if (actorIds[2]) {
    if (clothingType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[2], identifierTypeId: clothingType.id, value: "DEMO: Always wears a black baseball cap", confidence: "confirmed" }).onConflictDoNothing();
    if (aliasType) await opsDb.insert(actorIdentifiers).values({ actorId: actorIds[2], identifierTypeId: aliasType.id, value: "DEMO: Also known as Cap or Blackhat", confidence: "unverified" }).onConflictDoNothing();
  }
  console.log(`+ Demo identifiers seeded`);

  // DEMO SIGHTINGS
  if (reporterIds.length > 0) {
    const now = Date.now();
    const sightingData = [
      { plate: "FAKE-001", lat: 38.9340, lng: -77.1770, desc: "DEMO: Circling the block near Old Dominion Dr, stopped twice",  hoursAgo: 2,  dir: "N" },
      { plate: "FAKE-001", lat: 38.9285, lng: -77.1690, desc: "DEMO: Parked outside coffee shop on Chain Bridge Rd for 45 min", hoursAgo: 26, dir: "E" },
      { plate: "FAKE-001", lat: 38.9410, lng: -77.1880, desc: "DEMO: Driving slowly through residential area at 1am",          hoursAgo: 50, dir: "S" },
      { plate: "FAKE-002", lat: 38.9220, lng: -77.1720, desc: "DEMO: Following another vehicle on Elm St",                     hoursAgo: 5,  dir: "W" },
      { plate: "FAKE-002", lat: 38.9370, lng: -77.1830, desc: "DEMO: Parked with engine running near Lewinsville Park",        hoursAgo: 30, dir: "NE" },
      { plate: "FAKE-003", lat: 38.9180, lng: -77.1650, desc: "DEMO: Loading boxes from garage into truck bed",                hoursAgo: 12, dir: "SW" },
      { plate: "FAKE-003", lat: 38.9310, lng: -77.1750, desc: "DEMO: Speeding through school zone on Kirby Rd",                hoursAgo: 72, dir: "E" },
      { plate: "TEST-004", lat: 38.9260, lng: -77.1810, desc: "DEMO: Parked near park entrance, driver on phone",              hoursAgo: 8,  dir: "N" },
    ];
    for (const s of sightingData) {
      const rid = reporterIds[Math.floor(Math.random() * reporterIds.length)];
      await opsDb.insert(sightings).values({
        chapterId, reporterId: rid, plate: s.plate,
        lat: s.lat, lng: s.lng, activityDescription: s.desc, direction: s.dir,
        observedAt: new Date(now - s.hoursAgo * 3600000),
        submittedAt: new Date(now - s.hoursAgo * 3600000 + 60000),
      }).onConflictDoNothing();
    }
    console.log(`+ Demo sightings: ${sightingData.length}`);
  }

  // OPERATOR IDENTITY
  const [opReporter] = await opsDb.insert(reporters).values({ chapterId, callsign: "OPERATOR" }).onConflictDoNothing().returning();
  if (opReporter) {
    await identDb.insert(reporterIdentities).values({ reporterId: opReporter.id, email: "operator@trace.local", role: "operator" }).onConflictDoNothing();
  }
  console.log(`+ Operator: callsign OPERATOR`);

  // DISPATCH EVENT TYPES
  const dispatchTypes = [
    { label: "Confirmed Vehicle", icon: "car",            color: "#DC2626", defaultPriority: "urgent",  description: "Known vehicle from the database", autoCloseHours: 2, sortOrder: 5 },
    { label: "Community Report",  icon: "radio",           color: "#D97706", defaultPriority: "routine", description: "Called in by a community member",  autoCloseHours: 4, sortOrder: 4 },
    { label: "Area Check",        icon: "compass",         color: "#4F46E5", defaultPriority: "routine", description: "General area to patrol",           autoCloseHours: 4, sortOrder: 3 },
    { label: "Plate Swap Alert",  icon: "alert-triangle",  color: "#7C3AED", defaultPriority: "urgent",  description: "Vehicle suspected of changing plates", autoCloseHours: 2, sortOrder: 2 },
    { label: "Suspicious Activity", icon: "eye",           color: "#EA580C", defaultPriority: "routine", description: "Non-vehicle activity to investigate", autoCloseHours: 4, sortOrder: 1 },
  ];
  for (const dt of dispatchTypes) {
    await opsDb.insert(dispatchEventTypes).values({ ...dt, chapterId }).onConflictDoNothing();
  }
  console.log(`+ Dispatch event types: ${dispatchTypes.length}`);

  // TAG DEFINITIONS (default set per context)
  const tagData: { context: string; label: string; color: string; sortOrder: number }[] = [
    // Sighting tags
    { context: "sighting", label: "Confirmed Suspicious", color: "#DC2626", sortOrder: 6 },
    { context: "sighting", label: "Cleared - Resident",   color: "#16A34A", sortOrder: 5 },
    { context: "sighting", label: "Known Delivery Vehicle",color: "#64748B", sortOrder: 4 },
    { context: "sighting", label: "Under Active Tracking", color: "#D97706", sortOrder: 3 },
    { context: "sighting", label: "Duplicate Report",      color: "#94A3B8", sortOrder: 2 },
    { context: "sighting", label: "Requires Follow-Up",    color: "#4F46E5", sortOrder: 1 },
    // Vehicle tags
    { context: "vehicle", label: "Active Threat",   color: "#DC2626", sortOrder: 6 },
    { context: "vehicle", label: "Monitoring",      color: "#D97706", sortOrder: 5 },
    { context: "vehicle", label: "Cleared",         color: "#16A34A", sortOrder: 4 },
    { context: "vehicle", label: "Flagged for LE",  color: "#7C3AED", sortOrder: 3 },
    { context: "vehicle", label: "Known Resident",  color: "#64748B", sortOrder: 2 },
    { context: "vehicle", label: "Rental/Fleet",    color: "#94A3B8", sortOrder: 1 },
    // Harassment tags
    { context: "harassment", label: "Known Threat",              color: "#DC2626", sortOrder: 6 },
    { context: "harassment", label: "Spam",                      color: "#94A3B8", sortOrder: 5 },
    { context: "harassment", label: "Under Investigation",       color: "#D97706", sortOrder: 4 },
    { context: "harassment", label: "Cleared",                   color: "#16A34A", sortOrder: 3 },
    { context: "harassment", label: "Reported to Authorities",   color: "#7C3AED", sortOrder: 2 },
    { context: "harassment", label: "Unknown",                   color: "#64748B", sortOrder: 1 },
  ];
  for (const t of tagData) {
    await opsDb.insert(tagDefinitions).values({ ...t, chapterId }).onConflictDoNothing();
  }
  console.log(`+ Tag definitions: ${tagData.length}`);

  console.log("\nSeed complete. All demo data prefixed with DEMO/FAKE/TEST.");
  process.exit(0);
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
