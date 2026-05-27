/**
 * TRACE — Comprehensive Seed Data
 * 
 * Creates every entity type in every possible state with stock photos.
 * Run: npx tsx --env-file=.env.neon _seed_comprehensive.ts
 * 
 * DESTRUCTIVE: Deletes all DEMO-labeled data first, then recreates.
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL_OPS || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const sql = postgres(url, { ssl: "require" });
const PEXELS_KEY = "52KwMPMh4ErEx1YYZzK3CkxEdC9Vo40Gx1edVZc34SoNB7QI4v2CalmR";

// ================================================================
// PEXELS API
// ================================================================
async function pexelsSearch(query: string, count: number): Promise<string[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&size=small`,
    { headers: { Authorization: PEXELS_KEY } }
  );
  const data = await res.json() as { photos: { src: { medium: string } }[] };
  return (data.photos || []).map(p => p.src.medium);
}

console.log("Fetching stock photos from Pexels...");
const [carPhotos, personPhotos] = await Promise.all([
  pexelsSearch("car parked side view", 8),
  pexelsSearch("person portrait casual", 5),
]);
console.log(`  Cars: ${carPhotos.length}, People: ${personPhotos.length}`);

// ================================================================
// GET CHAPTER + CONFIG IDs
// ================================================================
const [chapter] = await sql`SELECT id FROM ops.chapters LIMIT 1`;
if (!chapter) { console.error("No chapter found. Run base seed first."); process.exit(1); }
const chapterId = chapter.id;
console.log(`Chapter: ${chapterId}`);

// Get concern levels
const vLevels = await sql`SELECT id, label, rank FROM ops.suspicion_levels WHERE chapter_id = ${chapterId} ORDER BY rank`;
const aLevels = await sql`SELECT id, label, rank FROM ops.actor_suspicion_levels WHERE chapter_id = ${chapterId} ORDER BY rank`;
const vTypes = await sql`SELECT id, label FROM ops.vehicle_types WHERE chapter_id = ${chapterId}`;
const dTypes = await sql`SELECT id, label FROM ops.dispatch_event_types WHERE chapter_id = ${chapterId}`;
const iTypes = await sql`SELECT id, label FROM ops.incident_types WHERE chapter_id = ${chapterId}`;
const tags = await sql`SELECT id, label, context FROM ops.tag_definitions WHERE chapter_id = ${chapterId}`;
const [demoReporter] = await sql`SELECT id FROM ops.reporters WHERE chapter_id = ${chapterId} LIMIT 1`;
const reporterId = demoReporter?.id || null;

// Helper to find IDs
const findLevel = (arr: any[], rank: number) => arr.find(l => l.rank === rank)?.id;
const findType = (arr: any[], label: string) => arr.find(t => t.label?.includes(label))?.id;
const findTag = (arr: any[], ctx: string, label: string) => arr.find(t => t.context === ctx && t.label?.includes(label))?.id;

// ================================================================
// NUKE DEMO DATA
// ================================================================
console.log("\nCleaning existing demo data...");
await sql`DELETE FROM ops.incident_evidence WHERE incident_id IN (SELECT id FROM ops.incidents WHERE title LIKE '%(DEMO)%' OR description LIKE '%DEMO%')`;
await sql`DELETE FROM ops.incident_actors WHERE incident_id IN (SELECT id FROM ops.incidents WHERE title LIKE '%(DEMO)%' OR description LIKE '%DEMO%')`;
await sql`DELETE FROM ops.incident_vehicles WHERE incident_id IN (SELECT id FROM ops.incidents WHERE title LIKE '%(DEMO)%' OR description LIKE '%DEMO%')`;
await sql`DELETE FROM ops.incidents WHERE title LIKE '%(DEMO)%' OR description LIKE '%DEMO%'`;
await sql`DELETE FROM ops.sighting_photos WHERE sighting_id IN (SELECT id FROM ops.sightings WHERE notes LIKE '%DEMO%')`;
await sql`DELETE FROM ops.sightings WHERE notes LIKE '%DEMO%'`;
await sql`DELETE FROM ops.dispatch_events WHERE notes LIKE '%DEMO%'`;
await sql`DELETE FROM ops.harassment_reports WHERE description LIKE '%DEMO%'`;
await sql`DELETE FROM ops.actor_identifiers WHERE actor_id IN (SELECT id FROM ops.actors WHERE alias LIKE '%(DEMO)%')`;
await sql`DELETE FROM ops.actor_photos WHERE actor_id IN (SELECT id FROM ops.actors WHERE alias LIKE '%(DEMO)%')`;
await sql`DELETE FROM ops.vehicle_type_assignments WHERE vehicle_id IN (SELECT id FROM ops.vehicles WHERE notes LIKE '%DEMO%')`;
await sql`DELETE FROM ops.vehicles WHERE notes LIKE '%DEMO%'`;
await sql`DELETE FROM ops.actors WHERE alias LIKE '%(DEMO)%'`;
console.log("  Demo data cleared.");

// ================================================================
// VEHICLES (8 — all concern levels, various states)
// ================================================================
console.log("\nSeeding vehicles...");
const vehicleData = [
  { plate: "DEMO-001", state: "CA", make: "Honda",   model: "Accord",  year: 2019, color: "Gray",    levelRank: 1, notes: "DEMO: Frequent runner. Seen at 4 stash locations.", status: "active" },
  { plate: "DEMO-002", state: "CA", make: "Ford",    model: "F-150",   year: 2021, color: "Black",   levelRank: 2, notes: "DEMO: Scout vehicle. Usually precedes runner.", status: "active" },
  { plate: "DEMO-003", state: "NV", make: "Toyota",  model: "Camry",   year: 2020, color: "White",   levelRank: 3, notes: "DEMO: Plate swap suspected. Two plates observed.", status: "active" },
  { plate: "DEMO-004", state: "CA", make: "Nissan",  model: "Altima",  year: 2018, color: "Red",     levelRank: 4, notes: "DEMO: High-frequency. 18 confirmed sightings in 2 weeks.", status: "active" },
  { plate: "DEMO-005", state: "CA", make: "Chevy",   model: "Malibu",  year: 2022, color: "Silver",  levelRank: 5, notes: "DEMO: Linked to GHOST and NINE. Network vehicle.", status: "active" },
  { plate: "DEMO-006", state: "AZ", make: "BMW",     model: "3 Series",year: 2023, color: "Blue",    levelRank: 1, notes: "DEMO: New addition. Single sighting.", status: "active" },
  { plate: "DEMO-007", state: "CA", make: "Mercedes",model: "C-Class", year: 2020, color: "Black",   levelRank: 2, notes: "DEMO: Regular at north checkpoint.", status: "active" },
  { plate: "DEMO-008", state: "CA", make: "Ford",    model: "Transit", year: 2017, color: "White",   levelRank: 3, notes: "DEMO: Fleet vehicle. Retired from tracking.", status: "retired" },
];

const vehicleIds: string[] = [];
for (let i = 0; i < vehicleData.length; i++) {
  const v = vehicleData[i];
  const levelId = findLevel(vLevels, v.levelRank);
  const photo = carPhotos[i] || null;
  const [row] = await sql`
    INSERT INTO ops.vehicles (id, chapter_id, plate, make, model, year, color, suspicion_level_id, notes, photo_url, status)
    VALUES (gen_random_uuid(), ${chapterId}, ${v.plate}, ${v.make}, ${v.model}, ${v.year}, ${v.color}, ${levelId}, ${v.notes}, ${photo}, ${v.status})
    ON CONFLICT DO NOTHING RETURNING id`;
  if (row) vehicleIds.push(row.id);
  else { const [existing] = await sql`SELECT id FROM ops.vehicles WHERE plate = ${v.plate} AND chapter_id = ${chapterId}`; if (existing) vehicleIds.push(existing.id); }
}
console.log(`  Vehicles: ${vehicleIds.length}`);

// Assign vehicle types
const runnerType = findType(vTypes, "Runner");
const scoutType = findType(vTypes, "Scout");
if (runnerType && vehicleIds[0]) await sql`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), ${vehicleIds[0]}, ${runnerType}) ON CONFLICT DO NOTHING`;
if (scoutType && vehicleIds[1]) await sql`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), ${vehicleIds[1]}, ${scoutType}) ON CONFLICT DO NOTHING`;
if (runnerType && vehicleIds[3]) await sql`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), ${vehicleIds[3]}, ${runnerType}) ON CONFLICT DO NOTHING`;
if (runnerType && vehicleIds[4]) await sql`INSERT INTO ops.vehicle_type_assignments (id, vehicle_id, vehicle_type_id) VALUES (gen_random_uuid(), ${vehicleIds[4]}, ${runnerType}) ON CONFLICT DO NOTHING`;

// ================================================================
// ACTORS (5 — all concern levels, with identifiers)
// ================================================================
console.log("\nSeeding actors...");
const actorData = [
  { alias: "GHOST (DEMO)",   desc: "DEMO: Male, 30s. Frequently seen driving DEMO-001 and DEMO-004. Distinctive neck tattoo.", levelRank: 3 },
  { alias: "SPARKS (DEMO)",  desc: "DEMO: Female, 20s. Passenger in DEMO-004 on multiple occasions. Short dark hair.", levelRank: 1 },
  { alias: "NINE (DEMO)",    desc: "DEMO: Male, 40s. Always wears a black hat. Seen at stash locations and with DEMO-005.", levelRank: 2 },
  { alias: "SHADE (DEMO)",   desc: "DEMO: Unknown gender. Hooded figure observed near drop points. No direct vehicle link yet.", levelRank: 1 },
  { alias: "FLICKER (DEMO)", desc: "DEMO: Male, 25-30. Linked to DEMO-003 plate swap. Scar on left hand.", levelRank: 3 },
];

const actorIds: string[] = [];
for (let i = 0; i < actorData.length; i++) {
  const a = actorData[i];
  const levelId = findLevel(aLevels, a.levelRank);
  const photo = personPhotos[i] || null;
  const [row] = await sql`
    INSERT INTO ops.actors (id, chapter_id, alias, physical_description, photo_url)
    VALUES (gen_random_uuid(), ${chapterId}, ${a.alias}, ${a.desc}, ${photo})
    ON CONFLICT DO NOTHING RETURNING id`;
  if (row) actorIds.push(row.id);
  else { const [existing] = await sql`SELECT id FROM ops.actors WHERE alias = ${a.alias} AND chapter_id = ${chapterId}`; if (existing) actorIds.push(existing.id); }
}
console.log(`  Actors: ${actorIds.length}`);

// Actor identifiers
const idTypes = await sql`SELECT id, label FROM ops.actor_identifier_types WHERE chapter_id = ${chapterId}`;
const tattooType = idTypes.find((t: any) => t.label === "Tattoo")?.id;
const scarType = idTypes.find((t: any) => t.label === "Scar")?.id;
if (tattooType && actorIds[0]) await sql`INSERT INTO ops.actor_identifiers (id, actor_id, identifier_type_id, value, notes) VALUES (gen_random_uuid(), ${actorIds[0]}, ${tattooType}, 'Dragon on neck, left side', 'Visible in multiple sighting photos') ON CONFLICT DO NOTHING`;
if (scarType && actorIds[4]) await sql`INSERT INTO ops.actor_identifiers (id, actor_id, identifier_type_id, value, notes) VALUES (gen_random_uuid(), ${actorIds[4]}, ${scarType}, 'Linear scar across left palm, ~3 inches', 'Confirmed by two reporters') ON CONFLICT DO NOTHING`;

// ================================================================
// SIGHTINGS (12 — all statuses, spread across last 14 days)
// ================================================================
console.log("\nSeeding sightings...");
const now = Date.now();
const day = 86400000;
const hour = 3600000;

// McLean / Langley VA residential area: ~38.925-38.950 lat, ~-77.165 to -77.200 lng
// Create clusters for heat map visibility + spread for corridors
const sightingData = [
  // CLUSTER 1: Langley Forest area (hot zone — many sightings)
  { vehicleIdx: 0, lat: 38.937, lng: -77.184, hoursAgo: 2,   notes: "DEMO: Gray Accord parked at Langley Forest. Engine running.", triaged: false },
  { vehicleIdx: 0, lat: 38.938, lng: -77.1830, hoursAgo: 26,  notes: "DEMO: Same Accord, different spot in Langley Forest.", triaged: true, dir: "eastbound" },
  { vehicleIdx: 3, lat: 38.936, lng: -77.1832, hoursAgo: 50,  notes: "DEMO: Red Altima circling the block near Langley Forest.", triaged: true, dir: "westbound" },
  { vehicleIdx: 4, lat: 38.937, lng: -77.1833, hoursAgo: 74,  notes: "DEMO: Silver Malibu brief stop at Langley Forest.", triaged: true },
  { vehicleIdx: 0, lat: 38.940, lng: -77.1830, hoursAgo: 170, notes: "DEMO: Accord night sighting near Langley Forest.", triaged: true },
  // CLUSTER 2: Chain Bridge & Dolley Madison intersection (medium activity)
  { vehicleIdx: 1, lat: 38.945, lng: -77.170, hoursAgo: 5,   notes: "DEMO: Black F-150 scout at Chain Bridge & Dolley Madison.", triaged: false },
  { vehicleIdx: 1, lat: 38.946, lng: -77.171, hoursAgo: 48,  notes: "DEMO: Scout vehicle returning eastbound on Main.", triaged: true, dir: "eastbound" },
  { vehicleIdx: 6, lat: 38.944, lng: -77.1839, hoursAgo: 96,  notes: "DEMO: Black Mercedes at Chain Bridge & Dolley Madison, two occupants.", triaged: true },
  { vehicleIdx: 3, lat: 38.945, lng: -77.172, hoursAgo: 200, notes: "DEMO: Red Altima quick stop near gas station.", triaged: true },
  // CLUSTER 3: North checkpoint (consistent pattern)
  { vehicleIdx: 6, lat: 38.950, lng: -77.192, hoursAgo: 8,   notes: "DEMO: Mercedes at north checkpoint. Regular.", triaged: false },
  { vehicleIdx: 2, lat: 38.951, lng: -77.193, hoursAgo: 36,  notes: "DEMO: White Camry with DIFFERENT plate. Plate swap?", triaged: true, dir: "northbound" },
  { vehicleIdx: 4, lat: 38.949, lng: -77.191, hoursAgo: 120, notes: "DEMO: Malibu spotted at checkpoint. Driver matches GHOST.", triaged: true },
  // CLUSTER 4: South residential (low activity, spread out)
  { vehicleIdx: 5, lat: 38.926, lng: -77.1780, hoursAgo: 168, notes: "DEMO: Blue BMW in residential area. Belongs to resident. Cleared.", triaged: true },
  { vehicleIdx: 7, lat: 38.927, lng: -77.175, hoursAgo: 240, notes: "DEMO: White Transit van, Amazon delivery. Cleared.", triaged: true },
  { vehicleIdx: 3, lat: 38.925, lng: -77.1850, hoursAgo: 60,  notes: "DEMO: Red Altima at school zone during pickup hours.", triaged: true, dir: "southbound" },
  // CORRIDOR: Repeated sightings along a route (east-west on Old Dominion Dr)
  { vehicleIdx: 0, lat: 38.942, lng: -77.1650, hoursAgo: 300, notes: "DEMO: Accord heading west on Old Dominion Dr.", triaged: true, dir: "westbound" },
  { vehicleIdx: 0, lat: 38.942, lng: -77.1782, hoursAgo: 295, notes: "DEMO: Accord still westbound, Old Dominion Dr & Kirby Rd.", triaged: true, dir: "westbound" },
  { vehicleIdx: 0, lat: 38.942, lng: -77.1835, hoursAgo: 290, notes: "DEMO: Accord westbound, approaching Langley Forest.", triaged: true, dir: "westbound" },
  { vehicleIdx: 0, lat: 38.942, lng: -77.178, hoursAgo: 285, notes: "DEMO: Accord passed Langley Forest heading west.", triaged: true, dir: "westbound" },
  // WIDE DATE RANGE: older sightings for time playback
  { vehicleIdx: 4, lat: 38.9420, lng: -77.1780, hoursAgo: 360, notes: "DEMO: Malibu 15 days ago at stash house.", triaged: true },
  { vehicleIdx: 1, lat: 38.9280, lng: -77.18300, hoursAgo: 480, notes: "DEMO: Scout 20 days ago, south patrol.", triaged: true },
  { vehicleIdx: 3, lat: 38.9425, lng: -77.1835, hoursAgo: 600, notes: "DEMO: Altima 25 days ago, north area.", triaged: true },
  { vehicleIdx: 0, lat: 38.940, lng: -77.192, hoursAgo: 720, notes: "DEMO: Accord 30 days ago, first sighting.", triaged: true },
];

const sightingIds: string[] = [];
for (const s of sightingData) {
  const vehicleId = vehicleIds[s.vehicleIdx];
  if (!vehicleId) continue;
  const observedAt = new Date(now - s.hoursAgo * hour).toISOString();
  const dir = (s as any).dir || null;
  const triaged = (s as any).triaged || false;
  const [row] = await sql`
    INSERT INTO ops.sightings (id, chapter_id, reporter_id, vehicle_id, lat, lng, observed_at, notes, direction, triaged)
    VALUES (gen_random_uuid(), ${chapterId}, ${reporterId}, ${vehicleId}, ${s.lat}, ${s.lng}, ${observedAt}, ${s.notes}, ${dir}, ${triaged})
    ON CONFLICT DO NOTHING RETURNING id`;
  if (row) sightingIds.push(row.id);
}
console.log(`  Sightings: ${sightingIds.length}`);

// ================================================================
// DISPATCHES (6 — all statuses and types)
// ================================================================
console.log("\nSeeding dispatches...");
const confirmedVehicleType = findType(dTypes, "Confirmed");
const communityType = findType(dTypes, "Community");
const areaCheckType = findType(dTypes, "Area Check");
const plateSwapType = findType(dTypes, "Plate Swap");
const suspActType = findType(dTypes, "Suspicious");

const dispatchData = [
  { typeId: confirmedVehicleType, status: "open",       priority: "urgent",  lat: 38.937, lng: -77.184, hoursAgo: 1, notes: "DEMO: DEMO-001 spotted at Langley Forest. Respond immediately." },
  { typeId: communityType,       status: "responding",  priority: "routine", lat: 38.945, lng: -77.170, hoursAgo: 3, notes: "DEMO: Community member called in suspicious activity on Elm St." },
  { typeId: areaCheckType,       status: "on_scene",    priority: "routine", lat: 38.9420, lng: -77.1780, hoursAgo: 6, notes: "DEMO: Patrol the north parking lot area." },
  { typeId: confirmedVehicleType, status: "closed",     priority: "urgent",  lat: 38.926, lng: -77.18300, hoursAgo: 48, notes: "DEMO: DEMO-002 confirmed and tracked. No longer in area." },
  { typeId: plateSwapType,       status: "closed",      priority: "urgent",  lat: 38.950, lng: -77.1830, hoursAgo: 72, notes: "DEMO: Plate swap on DEMO-003 confirmed. Photos captured." },
  { typeId: suspActType,         status: "expired",     priority: "routine", lat: 38.9280, lng: -77.1850, hoursAgo: 200, notes: "DEMO: Suspicious person near playground. Auto-expired." },
];

for (const d of dispatchData) {
  const createdAt = new Date(now - d.hoursAgo * 3600000).toISOString();
  await sql`
    INSERT INTO ops.dispatch_events (id, chapter_id, event_type_id, status, priority, lat, lng, notes, created_at)
    VALUES (gen_random_uuid(), ${chapterId}, ${d.typeId}, ${d.status}, ${d.priority}, ${d.lat}, ${d.lng}, ${d.notes}, ${createdAt})
    ON CONFLICT DO NOTHING`;
}
console.log(`  Dispatches: ${dispatchData.length}`);

// ================================================================
// HARASSMENT REPORTS (4 — various states)
// ================================================================
console.log("\nSeeding harassment reports...");
const harassData = [
  { phone: "+15555550101", desc: "DEMO: Persistent caller. Three separate reporters flagged this number.", type: "call", status: "escalated", tag: "Known Concern" },
  { phone: "+15555550102", desc: "DEMO: Single report. Caller ID shows unknown business.", type: "call", status: "pending", tag: null },
  { phone: "+15555550103", desc: "DEMO: Known concern. Matched to organized harassment campaign.", type: "voicemail", status: "reviewed", tag: "Known Concern" },
  { phone: "+15555550104", desc: "DEMO: Threatening voicemails left for two reporters.", type: "voicemail", status: "escalated", tag: "Under Investigation" },
  { phone: "+15555550105", desc: "DEMO: Threatening text messages received by reporter.", type: "text", status: "pending", tag: null },
  { phone: "+15555550106", desc: "DEMO: Person approached reporter in parking lot.", type: "in_person", status: "escalated", tag: "Known Concern" },
];

for (const h of harassData) {
  await sql`
    INSERT INTO ops.harassment_reports (id, chapter_id, reporter_id, phone_number, description, incident_type, status, operator_tag, created_at)
    VALUES (gen_random_uuid(), ${chapterId}, ${reporterId}, ${h.phone}, ${h.desc}, ${h.type}, ${h.status}, ${h.tag}, ${new Date(now - Math.random() * 14 * day).toISOString()})
    ON CONFLICT DO NOTHING`;
}
console.log(`  Harassment reports: ${harassData.length}`);

// ================================================================
// INCIDENTS (7 — all statuses, severities, types)
// ================================================================
console.log("\nSeeding incidents...");
const surveillanceType = findType(iTypes, "Surveillance");
const followingType = findType(iTypes, "Following");
const assaultType = findType(iTypes, "Assault");
const kidnappingType = findType(iTypes, "Kidnap");
const propertyType = findType(iTypes, "Property");
const drugType = findType(iTypes, "Drug");
const harassmentIncType = findType(iTypes, "Harassment");

const incidentData = [
  { typeId: surveillanceType, status: "open",         severity: "elevated", title: "Repeated surveillance near school (DEMO)", desc: "DEMO: Unknown vehicle seen idling near Oak Elementary on three consecutive days. Different parking spots each time.", hoursAgo: 12 },
  { typeId: followingType,   status: "documenting",   severity: "urgent",   title: "Reporter followed home (DEMO)", desc: "DEMO: Reporter R-ALPHA reports being followed from the grocery store to their neighborhood. Silver sedan, partial plate match to DEMO-005.", hoursAgo: 36 },
  { typeId: assaultType,     status: "under_review",  severity: "critical", title: "Physical confrontation at gas station (DEMO)", desc: "DEMO: Two reporters witnessed a confrontation between GHOST and an unknown person at the Shell station on Main St. No injuries reported.", hoursAgo: 72 },
  { typeId: kidnappingType,  status: "escalated_to_le", severity: "critical", title: "Attempted abduction report (DEMO)", desc: "DEMO: Community member reports a child was approached by occupants of a white van (matches DEMO-008 description). Child ran to safety. Escalated to authorities.", hoursAgo: 120 },
  { typeId: propertyType,    status: "closed",        severity: "elevated", title: "Catalytic converter theft ring (DEMO)", desc: "DEMO: Series of catalytic converter thefts linked to DEMO-002. Three victims in one week. Case closed after vehicle identified and reported.", hoursAgo: 240 },
  { typeId: drugType,        status: "open",          severity: "urgent",   title: "Rapid capture: suspicious exchange (DEMO)", desc: "DEMO: Filed via rapid capture. Hand-to-hand exchange observed near park. Two vehicles present.", hoursAgo: 4 },
  { typeId: harassmentIncType, status: "documenting", severity: "elevated", title: "Phone harassment escalation (DEMO)", desc: "DEMO: Harassment from +15555550103 has escalated to in-person visits. Two reporters affected. Evidence being collected.", hoursAgo: 48 },
];

const incidentIds: string[] = [];
for (const inc of incidentData) {
  const occurredAt = new Date(now - inc.hoursAgo * 3600000).toISOString();
  const closedAt = inc.status === "closed" ? new Date(now - (inc.hoursAgo - 24) * 3600000).toISOString() : null;
  const [row] = await sql`
    INSERT INTO ops.incidents (id, chapter_id, incident_type_id, status, severity, title, description, occurred_at, closed_at, lat, lng, location_description)
    VALUES (gen_random_uuid(), ${chapterId}, ${inc.typeId}, ${inc.status}, ${inc.severity}, ${inc.title}, ${inc.desc}, ${occurredAt}, ${closedAt},
      ${38.9285 + Math.random() * 0.03}, ${-77.170 + Math.random() * 0.03}, ${"McLean VA area (DEMO)"})
    ON CONFLICT DO NOTHING RETURNING id`;
  if (row) incidentIds.push(row.id);
}
console.log(`  Incidents: ${incidentIds.length}`);

// Link actors and vehicles to incidents
if (incidentIds[0] && actorIds[3]) await sql`INSERT INTO ops.incident_actors (id, incident_id, actor_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[0]}, ${actorIds[3]}, 'associated', 'Seen near school in hooded clothing') ON CONFLICT DO NOTHING`;
if (incidentIds[1] && actorIds[0]) await sql`INSERT INTO ops.incident_actors (id, incident_id, actor_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[1]}, ${actorIds[0]}, 'associated', 'Driving the vehicle that followed reporter') ON CONFLICT DO NOTHING`;
if (incidentIds[1] && vehicleIds[4]) await sql`INSERT INTO ops.incident_vehicles (id, incident_id, vehicle_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[1]}, ${vehicleIds[4]}, 'associated', 'Silver Malibu, partial plate match') ON CONFLICT DO NOTHING`;
if (incidentIds[2] && actorIds[0]) await sql`INSERT INTO ops.incident_actors (id, incident_id, actor_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[2]}, ${actorIds[0]}, 'associated', 'Identified by tattoo') ON CONFLICT DO NOTHING`;
if (incidentIds[2] && vehicleIds[0]) await sql`INSERT INTO ops.incident_vehicles (id, incident_id, vehicle_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[2]}, ${vehicleIds[0]}, 'associated', 'Parked at the gas station') ON CONFLICT DO NOTHING`;
if (incidentIds[3] && vehicleIds[7]) await sql`INSERT INTO ops.incident_vehicles (id, incident_id, vehicle_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[3]}, ${vehicleIds[7]}, 'associated', 'White van matching description') ON CONFLICT DO NOTHING`;
if (incidentIds[5] && vehicleIds[3]) await sql`INSERT INTO ops.incident_vehicles (id, incident_id, vehicle_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[5]}, ${vehicleIds[3]}, 'associated', 'Red Altima present during exchange') ON CONFLICT DO NOTHING`;
if (incidentIds[5] && vehicleIds[1]) await sql`INSERT INTO ops.incident_vehicles (id, incident_id, vehicle_id, role, notes) VALUES (gen_random_uuid(), ${incidentIds[5]}, ${vehicleIds[1]}, 'associated', 'Black F-150 also present') ON CONFLICT DO NOTHING`;

// Add evidence to incidents with evidence
if (incidentIds[1]) {
  await sql`INSERT INTO ops.incident_evidence (id, incident_id, evidence_type, caption, phase, captured_at, metadata) VALUES
    (gen_random_uuid(), ${incidentIds[1]}, 'photo', 'Dashboard cam capture of following vehicle', 'during_incident', ${new Date(now - 35 * 3600000).toISOString()}, '{}'),
    (gen_random_uuid(), ${incidentIds[1]}, 'text_note', 'Reporter statement: vehicle followed for 12 minutes across 4 turns', 'follow_up', ${new Date(now - 34 * 3600000).toISOString()}, '{}')
    ON CONFLICT DO NOTHING`;
}
if (incidentIds[2]) {
  await sql`INSERT INTO ops.incident_evidence (id, incident_id, evidence_type, caption, phase, captured_at, metadata) VALUES
    (gen_random_uuid(), ${incidentIds[2]}, 'photo', 'Security camera still from gas station', 'during_incident', ${new Date(now - 71 * 3600000).toISOString()}, '{}'),
    (gen_random_uuid(), ${incidentIds[2]}, 'video', 'Cell phone video of confrontation, 45 seconds', 'during_incident', ${new Date(now - 71 * 3600000).toISOString()}, '{}'),
    (gen_random_uuid(), ${incidentIds[2]}, 'document', 'Written witness statement from bystander', 'post_scene', ${new Date(now - 68 * 3600000).toISOString()}, '{}')
    ON CONFLICT DO NOTHING`;
}

console.log("  Actor/vehicle links and evidence added.");

// ================================================================
// DONE
// ================================================================
console.log("\n========================================");
console.log("COMPREHENSIVE SEED COMPLETE");
console.log(`  Vehicles: ${vehicleIds.length}`);
console.log(`  Actors: ${actorIds.length}`);
console.log(`  Sightings: ${sightingIds.length}`);
console.log(`  Dispatches: ${dispatchData.length}`);
console.log(`  Harassment: ${harassData.length}`);
console.log(`  Incidents: ${incidentIds.length}`);
console.log("========================================");

await sql.end();
process.exit(0);
