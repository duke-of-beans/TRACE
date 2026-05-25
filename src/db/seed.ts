/**
 * TRACE — Database Seed
 *
 * Creates default chapter, suspicion ladder, vehicle types,
 * and actor risk levels for tenant 0 (reference implementation).
 *
 * Usage: npx tsx src/db/seed.ts
 */
import "dotenv/config";
import { opsDb } from "./connection.js";
import {
  chapters, vehicleTypes, suspicionLevels, actorRiskLevels,
} from "./schema/vault-a.js";

async function seed() {
  console.log("Seeding TRACE database...");

  // --- Chapter 0 (reference implementation) ---
  const [chapter] = await opsDb
    .insert(chapters)
    .values({
      name: "Chapter Zero",
      slug: "chapter-zero",
      sunsetDays: 90,
    })
    .returning();

  const cid = chapter.id;

  // --- Default vehicle types ---
  await opsDb.insert(vehicleTypes).values([
    { chapterId: cid, label: "Runner",  description: "Active transport vehicle", color: "#e74c3c", sortOrder: 1 },
    { chapterId: cid, label: "Scout",   description: "Reconnaissance / lookout vehicle", color: "#f39c12", sortOrder: 2 },
    { chapterId: cid, label: "Stash",   description: "Storage / drop vehicle", color: "#9b59b6", sortOrder: 3 },
    { chapterId: cid, label: "Decoy",   description: "Diversion / distraction vehicle", color: "#95a5a6", sortOrder: 4 },
  ]);

  // --- Default suspicion ladder ---
  await opsDb.insert(suspicionLevels).values([
    { chapterId: cid, label: "Noticed",         rank: 1, description: "Single sighting, no pattern yet", color: "#3498db" },
    { chapterId: cid, label: "Suspicious",       rank: 2, description: "Pattern emerging - identified driver, activities, or repeat sightings", color: "#f39c12" },
    { chapterId: cid, label: "Confirmed",        rank: 3, description: "Multiple criteria met including root location or operator elevation", color: "#e67e22" },
    { chapterId: cid, label: "Active Criminal",  rank: 4, description: "Sufficient evidence for case package generation", color: "#e74c3c" },
    { chapterId: cid, label: "Retired",          rank: 0, description: "Vehicle sunsetted - inactive 90+ days", color: "#95a5a6" },
  ]);

  // --- Default actor risk levels ---
  await opsDb.insert(actorRiskLevels).values([
    { chapterId: cid, label: "Unknown",    severity: 0, description: "Risk level not yet assessed", color: "#95a5a6" },
    { chapterId: cid, label: "Low",        severity: 1, description: "No known aggressive behavior", color: "#3498db" },
    { chapterId: cid, label: "Aggressive", severity: 2, description: "Known aggressive behavior toward others", color: "#e67e22" },
    { chapterId: cid, label: "Stalker",    severity: 3, description: "Will follow spotters - extreme caution", color: "#e74c3c" },
  ]);

  console.log(`Seeded chapter "${chapter.name}" (${cid})`);
  console.log("  4 vehicle types, 5 suspicion levels, 4 risk levels");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
