/**
 * TRACE — Seed Script
 *
 * Populates all three vaults with obviously fake demo data.
 * Every record is clearly marked as test data so operators
 * know to delete/replace them with real chapter configuration.
 */
import "dotenv/config";
import { opsDb, identDb } from "./db/connection.js";
import {
  chapters, vehicleTypes, suspicionLevels, suspicionPredicates,
  actorSuspicionLevels, actorSuspicionPredicates,
  actorIdentifierTypes, actorIdentifiers,
  reporters, vehicles, vehicleTypeAssignments,
  actors, sightings,
} from "./db/schema/vault-a.js";
import { reporterIdentities, sessions } from "./db/schema/vault-b.js";
import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

async function seed() {
  console.log("🌱 Seeding TRACE with demo data...\n");

  // ============================================================
  // CHAPTER
  // ============================================================
  const [chapter] = await opsDb
    .insert(chapters)
    .values({
      name: "DEMO CHAPTER — Delete After Review",
      region: "Faketown, USA",
      timezone: "America/Los_Angeles",
    })
    .onConflictDoNothing()
    .returning();

  const chapterId = chapter?.id || (await opsDb.select().from(chapters).limit(1))[0].id;
  console.log(`✓ Chapter: ${chapterId}`);

  // ============================================================
  // VEHICLE TYPES
  // ============================================================
  const typeData = [
    { label: "Runner",  color: "#DC2626", description: "Transports product between locations", rank: 4 },
    { label: "Scout",   color: "#D97706", description: "Watches and reports on targets",       rank: 3 },
    { label: "Stash",   color: "#4F46E5", description: "Parked vehicle used for storage",      rank: 2 },
    { label: "Decoy",   color: "#64748B", description: "Draws attention away from real ops",    rank: 1 },
    { label: "Unknown", color: "#94A3B8", description: "Role not yet determined",               rank: 0 },
  ];
  for (const t of typeData) {
    await opsDb.insert(vehicleTypes).values({ ...t, chapterId }).onConflictDoNothing();
  }
  const types = await opsDb.select().from(vehicleTypes);
  console.log(`✓ Vehicle types: ${types.length}`);

  // ============================================================
  // SUSPICION LEVELS (Vehicle)
  // ============================================================
  const levelData = [
    { label: "Noted",      color: "#94A3B8", rank: 1, description: "Seen once, no pattern yet" },
    { label: "Watching",   color: "#D97706", rank: 2, description: "Seen multiple times, possible pattern" },
    { label: "Suspicious", color: "#EA580C", rank: 3, description: "Clear pattern, likely operational" },
    { label: "Confirmed",  color: "#DC2626", rank: 4, description: "Confirmed operational role" },
    { label: "Priority",   color: "#7C3AED", rank: 5, description: "Highest priority — active and dangerous" },
  ];
  for (const l of levelData) {
    await opsDb.insert(suspicionLevels).values({ ...l, chapterId }).onConflictDoNothing();
  }
  const levels = await opsDb.select().from(suspicionLevels);
  console.log(`✓ Suspicion levels: ${levels.length}`);

  // ============================================================
  // SUSPICION PREDICATES
  // ============================================================
  const watchingLevel = levels.find((l) => l.label === "Watching");
  const suspiciousLevel = levels.find((l) => l.label === "Suspicious");
  if (watchingLevel) {
    await opsDb.insert(suspicionPredicates).values([
      { levelId: watchingLevel.id, field: "sighting_count", operator: "gte", value: "3", logic: "AND" },
      { levelId: watchingLevel.id, field: "distinct_days", operator: "gte", value: "2", logic: "AND" },
    ]).onConflictDoNothing();
  }
  if (suspiciousLevel) {
    await opsDb.insert(suspicionPredicates).values([
      { levelId: suspiciousLevel.id, field: "sighting_count", operator: "gte", value: "6", logic: "AND" },
      { levelId: suspiciousLevel.id, field: "distinct_locations", operator: "gte", value: "3", logic: "AND" },
    ]).onConflictDoNothing();
  }
  console.log(`✓ Suspicion predicates seeded`);

  // ============================================================
  // ACTOR SUSPICION LEVELS
  // ============================================================
  const actorLevelData = [
    { label: "Person of Interest", color: "#D97706", rank: 1, description: "Linked to suspicious vehicle" },
    { label: "Known Associate",    color: "#EA580C", rank: 2, description: "Confirmed connection to operations" },
    { label: "Primary Target",     color: "#DC2626", rank: 3, description: "Key individual in network" },
  ];
  for (const al of actorLevelData) {
    await opsDb.insert(actorSuspicionLevels).values({ ...al, chapterId }).onConflictDoNothing();
  }
  console.log(`✓ Actor suspicion levels seeded`);

  // ============================================================
  // ACTOR IDENTIFIER TYPES
  // ============================================================
  const idTypeData = [
    { label: "Tattoo",        description: "Visible tattoos — location and design" },
    { label: "Scar",          description: "Visible scars or marks" },
    { label: "Hair",          description: "Hair color, style, length" },
    { label: "Build",         description: "Height, weight, body type" },
    { label: "Clothing",      description: "Frequently worn clothing or accessories" },
    { label: "Vehicle Link",  description: "Vehicles this person has been seen with" },
    { label: "Habit",         description: "Behavioral patterns — routes, times, routines" },
    { label: "Alias",         description: "Known aliases or nicknames" },
  ];
  for (const idt of idTypeData) {
    await opsDb.insert(actorIdentifierTypes).values({ ...idt, chapterId }).onConflictDoNothing();
  }
  const idTypes = await opsDb.select().from(actorIdentifierTypes);
  console.log(`✓ Actor identifier types: ${idTypes.length}`);

  // ============================================================
  // DEMO REPORTERS
  // ============================================================
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
  console.log(`✓ Demo reporters: ${reporterIds.length}`);

  // ============================================================
  // DEMO VEHICLES
  // ============================================================
  const notedLevel = levels.find((l) => l.label === "Noted");
  const confirmedLevel = levels.find((l) => l.label === "Confirmed");
  const runnerType = types.find((t) => t.label === "Runner");
  const scoutType = types.find((t) => t.label === "Scout");

  const vehicleData = [
    { plate: "FAKE-001", make: "Honda", model: "Civic", year: 2019, color: "Red",    description: "DEMO — Red 2019 Honda Civic, tinted rear windows, dent on driver door", levelId: watchingLevel?.id, typeId: runnerType?.id },
    { plate: "FAKE-002", make: "Toyota", model: "Camry", year: 2021, color: "Black", description: "DEMO — Black 2021 Toyota Camry, tinted windows, aftermarket rims",       levelId: suspiciousLevel?.id, typeId: scoutType?.id },
    { plate: "FAKE-003", make: "Ford",  model: "F-150", year: 2018, color: "White",  description: "DEMO — White 2018 Ford F-150, lifted, mud tires, no front plate",        levelId: confirmedLevel?.id, typeId: runnerType?.id },
    { plate: "TEST-004", make: "Chevy", model: "Malibu", year: 2020, color: "Silver",description: "DEMO — Silver 2020 Chevy Malibu, Uber sticker in window",               levelId: notedLevel?.id },
    { plate: "TEST-005", make: "Nissan",model: "Altima", year: 2017, color: "Blue",  description: "DEMO — Blue 2017 Nissan Altima, cracked windshield, loud exhaust",       levelId: watchingLevel?.id },
  ];
  const vehicleIds: string[] = [];
  for (const v of vehicleData) {
    const [veh] = await opsDb.insert(vehicles).values({
      chapterId,
      plate: v.plate,
      make: v.make,
      model: v.model,
      year: v.year,
      color: v.color,
      description: v.description,
      currentLevelId: v.levelId || notedLevel?.id,
    }).onConflictDoNothing().returning();
    if (veh) {
      vehicleIds.push(veh.id);
      if (v.typeId) {
        await opsDb.insert(vehicleTypeAssignments).values({ vehicleId: veh.id, typeId: v.typeId }).onConflictDoNothing();
      }
    }
  }
  console.log(`✓ Demo vehicles: ${vehicleIds.length}`);

  // ============================================================
  // DEMO ACTORS
  // ============================================================
  const actorLevels = await opsDb.select().from(actorSuspicionLevels);
  const poiLevel = actorLevels.find((l) => l.label === "Person of Interest");
  const primaryLevel = actorLevels.find((l) => l.label === "Primary Target");

  const actorData = [
    { alias: "GHOST (DEMO)",   description: "DEMO — Frequently seen driving FAKE-001 and FAKE-003. Male, 30s.", levelId: primaryLevel?.id },
    { alias: "SPARKS (DEMO)",  description: "DEMO — Passenger in FAKE-002 on multiple occasions. Female, 20s.", levelId: poiLevel?.id },
    { alias: "NINE (DEMO)",    description: "DEMO — Always wears a black hat. Seen at stash locations.",         levelId: poiLevel?.id },
  ];
  const actorIds: string[] = [];
  for (const a of actorData) {
    const [act] = await opsDb.insert(actors).values({
      chapterId,
      alias: a.alias,
      description: a.description,
      currentLevelId: a.levelId,
    }).onConflictDoNothing().returning();
    if (act) actorIds.push(act.id);
  }
  console.log(`✓ Demo actors: ${actorIds.length}`);

  // ============================================================
  // DEMO ACTOR IDENTIFIERS
  // ============================================================
  const tattooType = idTypes.find((t) => t.label === "Tattoo");
  const buildType = idTypes.find((t) => t.label === "Build");
  const habitType = idTypes.find((t) => t.label === "Habit");
  const clothingType = idTypes.find((t) => t.label === "Clothing");
  const aliasType = idTypes.find((t) => t.label === "Alias");

  if (actorIds[0] && tattooType && buildType && habitType) {
    await opsDb.insert(actorIdentifiers).values([
      { actorId: actorIds[0], typeId: tattooType.id, value: "DEMO — Dragon tattoo on left forearm", confidence: "confirmed" },
      { actorId: actorIds[0], typeId: buildType.id,  value: "DEMO — 6ft, medium build, short brown hair", confidence: "confirmed" },
      { actorId: actorIds[0], typeId: habitType.id,  value: "DEMO — Usually seen between 10pm-2am on Oak St", confidence: "probable" },
    ]).onConflictDoNothing();
  }
  if (actorIds[1] && clothingType && buildType) {
    await opsDb.insert(actorIdentifiers).values([
      { actorId: actorIds[1], typeId: clothingType.id, value: "DEMO — Red jacket, white sneakers", confidence: "probable" },
      { actorId: actorIds[1], typeId: buildType.id,    value: "DEMO — 5'5, slim, long black hair", confidence: "confirmed" },
    ]).onConflictDoNothing();
  }
  if (actorIds[2] && clothingType && aliasType) {
    await opsDb.insert(actorIdentifiers).values([
      { actorId: actorIds[2], typeId: clothingType.id, value: "DEMO — Always wears a black baseball cap", confidence: "confirmed" },
      { actorId: actorIds[2], typeId: aliasType.id,    value: "DEMO — Also known as 'Cap' or 'Blackhat'", confidence: "unverified" },
    ]).onConflictDoNothing();
  }
  console.log(`✓ Demo identifiers seeded`);

  // ============================================================
  // DEMO SIGHTINGS
  // ============================================================
  const now = Date.now();
  const sightingData = [
    { plate: "FAKE-001", lat: 34.2694, lng: -118.7815, desc: "DEMO — Circling the block on Oak St, stopped twice",     hoursAgo: 2 },
    { plate: "FAKE-001", lat: 34.2710, lng: -118.7830, desc: "DEMO — Parked outside convenience store for 45 min",     hoursAgo: 26 },
    { plate: "FAKE-001", lat: 34.2650, lng: -118.7790, desc: "DEMO — Driving slowly through residential area at 1am",  hoursAgo: 50 },
    { plate: "FAKE-002", lat: 34.2700, lng: -118.7800, desc: "DEMO — Following another vehicle on Main St",            hoursAgo: 5 },
    { plate: "FAKE-002", lat: 34.2720, lng: -118.7850, desc: "DEMO — Parked with engine running, two occupants",       hoursAgo: 30 },
    { plate: "FAKE-003", lat: 34.2680, lng: -118.7770, desc: "DEMO — Loading boxes from garage into truck bed",        hoursAgo: 12 },
    { plate: "FAKE-003", lat: 34.2690, lng: -118.7810, desc: "DEMO — Speeding through school zone, no plates visible", hoursAgo: 72 },
    { plate: "TEST-004", lat: 34.2715, lng: -118.7840, desc: "DEMO — Parked near park, driver watching playground",    hoursAgo: 8 },
  ];
  for (const s of sightingData) {
    await opsDb.insert(sightings).values({
      chapterId,
      reporterId: reporterIds[Math.floor(Math.random() * Math.max(reporterIds.length, 1))] || null,
      plate: s.plate,
      lat: s.lat,
      lng: s.lng,
      activityDescription: s.desc,
      observedAt: new Date(now - s.hoursAgo * 3600000),
      submittedAt: new Date(now - s.hoursAgo * 3600000 + 60000),
      direction: ["N", "S", "E", "W", "NE", "SW"][Math.floor(Math.random() * 6)],
    }).onConflictDoNothing();
  }
  console.log(`✓ Demo sightings: ${sightingData.length}`);

  // ============================================================
  // OPERATOR IDENTITY
  // ============================================================
  const [opReporter] = await opsDb.insert(reporters).values({ chapterId, callsign: "OPERATOR (DEMO)" }).onConflictDoNothing().returning();
  if (opReporter) {
    await identDb.insert(reporterIdentities).values({ reporterId: opReporter.id, email: "operator@trace.local", role: "operator" }).onConflictDoNothing();
  }
  console.log(`✓ Operator identity: operator@trace.local`);

  console.log("\n✅ Seed complete. All demo data is marked with (DEMO) or FAKE/TEST prefixes.");
  console.log("   Delete these records and replace with your chapter's real configuration.\n");
  process.exit(0);
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
