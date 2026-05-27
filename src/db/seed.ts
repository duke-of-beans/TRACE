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
  reporters, vehicles, vehicleTypeAssignments, actors, actorVehicles, sightings,
  dispatchEventTypes, tagDefinitions, incidentTypes,
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
    { label: "Under Review",   color: "#D97706", rank: 1, description: "Linked to flagged vehicle" },
    { label: "Known Associate",    color: "#EA580C", rank: 2, description: "Confirmed connection to operations" },
    { label: "High Priority",       color: "#DC2626", rank: 3, description: "Key individual under observation" },
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
  const poiLevel = actorLevels.find((l) => l.label === "Under Review");
  const primaryLevel = actorLevels.find((l) => l.label === "High Priority");

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

  // DEMO SIGHTINGS — rich, varied data across all vehicles and reporters
  if (reporterIds.length > 0) {
    const now = Date.now();
    const sightingData = [
      // FAKE-001 (Red Honda Civic) — pattern: circling residential at night
      { plate: "FAKE-001", lat: 38.9340, lng: -77.1770, locDesc: "Old Dominion Dr near Pimmit Hills",
        desc: "DEMO: Circling the block three times. Stopped twice, driver checked phone, then drove on.",
        vehDesc: "Red Honda Civic, tinted rear windows, dent on driver door", dir: "N", hoursAgo: 2, reporter: 0 },
      { plate: "FAKE-001", lat: 38.9285, lng: -77.1690, locDesc: "Chain Bridge Rd, near Starbucks plaza",
        desc: "DEMO: Parked outside coffee shop for 45 min with engine running. Driver appeared to be watching foot traffic.",
        vehDesc: "Red Honda Civic, tinted rear windows", dir: "E", hoursAgo: 8, reporter: 1 },
      { plate: "FAKE-001", lat: 38.9410, lng: -77.1880, locDesc: "Residential area off Great Falls St",
        desc: "DEMO: Driving slowly (5-10mph) through residential area at 1:15am. No headlights on.",
        vehDesc: "Red sedan, possible Honda", dir: "S", hoursAgo: 18, reporter: 2 },
      { plate: "FAKE-001", lat: 38.9355, lng: -77.1800, locDesc: "Intersection of Kirby Rd and Randolph Rd",
        desc: "DEMO: Pulled over on shoulder, passenger got out and walked into wooded area. Returned after 3 min.",
        vehDesc: "Red Honda Civic, VA plates", dir: "W", hoursAgo: 28, reporter: 0 },
      { plate: "FAKE-001", lat: 38.9300, lng: -77.1730, locDesc: "McLean Baptist Church parking lot",
        desc: "DEMO: Parked in empty church lot at 11pm. Interior light on, two occupants visible.",
        vehDesc: "Red Honda Civic, dent on driver door", dir: "N", hoursAgo: 44, reporter: 1 },

      // FAKE-002 (Black Toyota Camry) — pattern: following, surveillance
      { plate: "FAKE-002", lat: 38.9220, lng: -77.1720, locDesc: "Elm St near Dolley Madison Library",
        desc: "DEMO: Followed a silver minivan for 6 blocks, matching every turn. Broke off when minivan pulled into driveway.",
        vehDesc: "Black Toyota Camry, tinted windows, aftermarket chrome rims", dir: "W", hoursAgo: 5, reporter: 0 },
      { plate: "FAKE-002", lat: 38.9370, lng: -77.1830, locDesc: "Lewinsville Park main entrance",
        desc: "DEMO: Parked facing playground with engine running for 30+ min. Left when school bus arrived.",
        vehDesc: "Black Camry, very dark tint all around", dir: "NE", hoursAgo: 15, reporter: 2 },
      { plate: "FAKE-002", lat: 38.9315, lng: -77.1755, locDesc: "Beverly Rd near Spring Hill Elementary",
        desc: "DEMO: Slow-rolling past school during pickup. Circled block twice. No children picked up.",
        vehDesc: "Black Toyota Camry with chrome rims", dir: "E", hoursAgo: 22, reporter: 1 },
      { plate: "FAKE-002", lat: 38.9250, lng: -77.1680, locDesc: "Corner of Ingleside Ave and Elm St",
        desc: "DEMO: Double-parked, driver appeared to be photographing house at 1432 Ingleside.",
        vehDesc: "Black sedan, Toyota, tinted windows", dir: "S", hoursAgo: 36, reporter: 0 },

      // FAKE-003 (White Ford F-150) — pattern: cargo, stash runs
      { plate: "FAKE-003", lat: 38.9180, lng: -77.1650, locDesc: "Industrial area off Leesburg Pike",
        desc: "DEMO: Loading heavy boxes from garage into truck bed. Three people involved. Garage door closed immediately after.",
        vehDesc: "White Ford F-150, lifted, mud tires, no front plate", dir: "SW", hoursAgo: 12, reporter: 2 },
      { plate: "FAKE-003", lat: 38.9310, lng: -77.1750, locDesc: "Kirby Rd near McLean High School",
        desc: "DEMO: Speeding through school zone at estimated 45mph. Almost hit pedestrian in crosswalk.",
        vehDesc: "White pickup, Ford F-150, very loud exhaust", dir: "E", hoursAgo: 24, reporter: 0 },
      { plate: "FAKE-003", lat: 38.9390, lng: -77.1900, locDesc: "Dead end on Balls Hill Rd",
        desc: "DEMO: Truck backed into wooded area at dead end. Unloaded 4-5 large black bags. Drove away quickly.",
        vehDesc: "White F-150, lifted suspension, mud on sides", dir: "N", hoursAgo: 40, reporter: 1 },
      { plate: "FAKE-003", lat: 38.9265, lng: -77.1790, locDesc: "Parking lot behind McLean Shopping Center",
        desc: "DEMO: Meeting with driver of FAKE-001 (Red Civic). Exchanged something through windows. Both left in opposite directions.",
        vehDesc: "White Ford F-150, no front plate", dir: "W", hoursAgo: 52, reporter: 2 },

      // TEST-004 (Silver Chevy Malibu) — pattern: recon, loitering
      { plate: "TEST-004", lat: 38.9260, lng: -77.1810, locDesc: "Entrance to Clemyjontri Park",
        desc: "DEMO: Parked near park entrance for 2 hours. Driver on phone entire time. Left when police cruiser passed.",
        vehDesc: "Silver Chevy Malibu, Uber sticker in rear window", dir: "N", hoursAgo: 8, reporter: 0 },
      { plate: "TEST-004", lat: 38.9330, lng: -77.1770, locDesc: "Old Dominion Dr near CVS",
        desc: "DEMO: Idling in CVS lot, facing the street. Appeared to be logging passing vehicles in a notebook.",
        vehDesc: "Silver Malibu with rideshare sticker", dir: "SE", hoursAgo: 20, reporter: 1 },
      { plate: "TEST-004", lat: 38.9280, lng: -77.1740, locDesc: "Residential block on Emerson Ave",
        desc: "DEMO: Parked in front of vacant house for sale. Driver walked around the property, checking doors and windows.",
        vehDesc: "Silver sedan, Chevy Malibu", dir: "NW", hoursAgo: 48, reporter: 2 },

      // TEST-005 (Blue Nissan Altima) — pattern: erratic, evasion
      { plate: "TEST-005", lat: 38.9200, lng: -77.1670, locDesc: "Westmoreland St near I-495 ramp",
        desc: "DEMO: Ran red light at high speed, nearly caused collision. Swerved across two lanes.",
        vehDesc: "Blue Nissan Altima, cracked windshield, loud exhaust, missing hubcap", dir: "S", hoursAgo: 3, reporter: 0 },
      { plate: "TEST-005", lat: 38.9350, lng: -77.1850, locDesc: "Georgetown Pike near Madeira School",
        desc: "DEMO: U-turned three times in 200 yards. Appeared to be checking if being followed.",
        vehDesc: "Blue Altima, very loud, cracked windshield", dir: "NE", hoursAgo: 14, reporter: 1 },
      { plate: "TEST-005", lat: 38.9240, lng: -77.1710, locDesc: "Behind Giant grocery, service road",
        desc: "DEMO: Parked behind dumpsters with lights off. When approached by store employee, peeled out at high speed.",
        vehDesc: "Blue Nissan, older model, exhaust visible from distance", dir: "W", hoursAgo: 30, reporter: 2 },
      { plate: "TEST-005", lat: 38.9380, lng: -77.1780, locDesc: "Residential neighborhood off Dolley Madison",
        desc: "DEMO: Going door to door at 9pm claiming to sell cleaning products. Multiple residents reported feeling intimidated.",
        vehDesc: "Blue Nissan Altima with cracked windshield", dir: "N", hoursAgo: 56, reporter: 0 },

      // Additional sightings with no vehicle match (unknown plates)
      { plate: "DEMO-UNK", lat: 38.9320, lng: -77.1760, locDesc: "Langley Fork Park trail head",
        desc: "DEMO: Dark SUV with no plates parked at trailhead after hours. Flash of light from inside, possibly photography.",
        vehDesc: "Dark colored SUV, no visible plates, tinted windows", dir: "E", hoursAgo: 6, reporter: 1 },
      { plate: "DEMO-997", lat: 38.9270, lng: -77.1720, locDesc: "Intersection of Chain Bridge and Dolley Madison",
        desc: "DEMO: White van with commercial plates circling the block. Slowed near every house with packages on porch.",
        vehDesc: "White cargo van, commercial plates, no company markings", dir: "N", hoursAgo: 10, reporter: 2 },
    ];
    for (const s of sightingData) {
      const rid = reporterIds[s.reporter % reporterIds.length];
      await opsDb.insert(sightings).values({
        chapterId, reporterId: rid, plate: s.plate,
        lat: s.lat, lng: s.lng,
        locationDescription: s.locDesc,
        activityDescription: s.desc,
        vehicleDescription: s.vehDesc,
        direction: s.dir,
        observedAt: new Date(now - s.hoursAgo * 3600000),
        submittedAt: new Date(now - s.hoursAgo * 3600000 + 60000),
      }).onConflictDoNothing();
    }
    console.log(`+ Demo sightings: ${sightingData.length}`);
  }

  // ACTOR-VEHICLE LINKS
  if (actorIds.length > 0 && vehicleIds.length > 0) {
    const links = [
      { actor: 0, vehicle: 0, notes: "DEMO: Primary driver of FAKE-001" },
      { actor: 0, vehicle: 2, notes: "DEMO: Also seen driving FAKE-003 on cargo runs" },
      { actor: 1, vehicle: 1, notes: "DEMO: Frequent passenger in FAKE-002" },
      { actor: 2, vehicle: 2, notes: "DEMO: Seen loading FAKE-003 at stash location" },
    ];
    for (const l of links) {
      if (actorIds[l.actor] && vehicleIds[l.vehicle]) {
        await opsDb.insert(actorVehicles).values({
          actorId: actorIds[l.actor], vehicleId: vehicleIds[l.vehicle], notes: l.notes,
        }).onConflictDoNothing();
      }
    }
    console.log(`+ Actor-vehicle links: ${links.length}`);
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

  // INCIDENT TYPES (default set per chapter)
  const incidentTypeData = [
    { label: "Surveillance",          icon: "eye",             color: "#D97706", sortOrder: 8, defaultPriority: "elevated",  lawEnforcementFlag: false, evidenceRequired: false, description: "Observed surveillance activity" },
    { label: "Following",             icon: "navigation",      color: "#EA580C", sortOrder: 7, defaultPriority: "elevated",  lawEnforcementFlag: false, evidenceRequired: false, description: "Subject or vehicle following a target" },
    { label: "Assault",               icon: "alert-triangle",  color: "#DC2626", sortOrder: 6, defaultPriority: "critical",  lawEnforcementFlag: true,  evidenceRequired: true,  autoDispatch: true, description: "Physical assault on a person" },
    { label: "Kidnapping/Abduction",  icon: "alert-octagon",   color: "#991B1B", sortOrder: 5, defaultPriority: "critical",  lawEnforcementFlag: true,  evidenceRequired: true,  autoDispatch: true, description: "Person taken against their will" },
    { label: "Property Crime",        icon: "home",            color: "#7C3AED", sortOrder: 4, defaultPriority: "elevated",  lawEnforcementFlag: false, evidenceRequired: false, description: "Damage or theft of property" },
    { label: "Harassment",            icon: "phone-off",       color: "#E11D48", sortOrder: 3, defaultPriority: "elevated",  lawEnforcementFlag: false, evidenceRequired: false, description: "Threatening or intimidating behavior" },
    { label: "Drug Activity",         icon: "package",         color: "#4F46E5", sortOrder: 2, defaultPriority: "routine",   lawEnforcementFlag: false, evidenceRequired: false, description: "Suspected drug-related activity" },
    { label: "Trespassing",           icon: "shield-off",      color: "#64748B", sortOrder: 1, defaultPriority: "routine",   lawEnforcementFlag: false, evidenceRequired: false, description: "Unauthorized entry onto property" },
  ];
  for (const it of incidentTypeData) {
    await opsDb.insert(incidentTypes).values({ ...it, chapterId } as any).onConflictDoNothing();
  }
  console.log(`+ Incident types: ${incidentTypeData.length}`);

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
    { context: "vehicle", label: "Active Concern",   color: "#DC2626", sortOrder: 6 },
    { context: "vehicle", label: "Monitoring",      color: "#D97706", sortOrder: 5 },
    { context: "vehicle", label: "Cleared",         color: "#16A34A", sortOrder: 4 },
    { context: "vehicle", label: "Noted for Authorities",  color: "#7C3AED", sortOrder: 3 },
    { context: "vehicle", label: "Known Resident",  color: "#64748B", sortOrder: 2 },
    { context: "vehicle", label: "Rental/Fleet",    color: "#94A3B8", sortOrder: 1 },
    // Harassment tags
    { context: "harassment", label: "Known Concern",              color: "#DC2626", sortOrder: 6 },
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
