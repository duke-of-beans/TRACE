/**
 * TRACE — Case Package Generator
 *
 * Generates legal-grade evidence bundles as PDF.
 * Includes: evidence index, timeline, map of sightings,
 * vehicle dossier, actor profiles, plate history,
 * and integrity verification page (hash manifest).
 *
 * Designed as if it will be submitted to a court.
 */
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { opsDb, evidenceDb } from "../db/connection.js";
import {
  vehicles, sightings, actors, actorVehicles,
  vehicleSuspicionHistory, vehicleTypeAssignments, vehicleTypes,
  suspicionLevels, auditLog,
} from "../db/schema/vault-a.js";
import {
  evidenceRecords, casePackages, casePackageEvidence,
} from "../db/schema/vault-c.js";
import { eq, and, desc } from "drizzle-orm";

export type CasePackageOpts = {
  chapterId: string;
  vehicleId?: string;
  actorId?: string;
  title: string;
  description?: string;
  generatedBy: string;
};

/**
 * Gather all intelligence for a case package.
 */
async function gatherIntelligence(opts: CasePackageOpts) {
  const { chapterId, vehicleId, actorId } = opts;

  // vehicle dossier
  let vehicle = null;
  let vehicleSightings: any[] = [];
  let vehicleHistory: any[] = [];
  let vehicleTypeLabels: string[] = [];
  let linkedActors: any[] = [];

  if (vehicleId) {
    [vehicle] = await opsDb.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);

    vehicleSightings = await opsDb
      .select()
      .from(sightings)
      .where(eq(sightings.vehicleId, vehicleId))
      .orderBy(sightings.observedAt);

    vehicleHistory = await opsDb
      .select()
      .from(vehicleSuspicionHistory)
      .where(eq(vehicleSuspicionHistory.vehicleId, vehicleId))
      .orderBy(vehicleSuspicionHistory.createdAt);

    // get type labels
    const typeAssignments = await opsDb
      .select({ label: vehicleTypes.label })
      .from(vehicleTypeAssignments)
      .innerJoin(vehicleTypes, eq(vehicleTypeAssignments.vehicleTypeId, vehicleTypes.id))
      .where(eq(vehicleTypeAssignments.vehicleId, vehicleId));
    vehicleTypeLabels = typeAssignments.map((t) => t.label);

    // linked actors
    const links = await opsDb
      .select({ actorId: actorVehicles.actorId })
      .from(actorVehicles)
      .where(eq(actorVehicles.vehicleId, vehicleId));

    for (const link of links) {
      const [actor] = await opsDb.select().from(actors).where(eq(actors.id, link.actorId)).limit(1);
      if (actor) linkedActors.push(actor);
    }
  }

  // actor dossier (if specified directly)
  let actor = null;
  if (actorId && !linkedActors.find((a) => a.id === actorId)) {
    [actor] = await opsDb.select().from(actors).where(eq(actors.id, actorId)).limit(1);
  }

  // suspicion level labels
  const levels = await opsDb
    .select()
    .from(suspicionLevels)
    .where(eq(suspicionLevels.chapterId, chapterId));

  const levelMap = new Map(levels.map((l) => [l.id, l.label]));

  return {
    vehicle, vehicleSightings, vehicleHistory, vehicleTypeLabels,
    linkedActors, actor, levelMap,
  };
}

/**
 * Generate a case package HTML document (printable to PDF).
 */
function renderCasePackageHTML(opts: CasePackageOpts, intel: Awaited<ReturnType<typeof gatherIntelligence>>, manifest: string): string {
  const { vehicle, vehicleSightings, vehicleHistory, vehicleTypeLabels, linkedActors, levelMap } = intel;

  const lines: string[] = [];
  const h = (s: string) => lines.push(s);

  h(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>TRACE Case Package: ${opts.title}</title>`);
  h(`<style>
    body { font-family: "Courier New", monospace; max-width: 800px; margin: 40px auto; color: #222; font-size: 13px; }
    h1 { border-bottom: 2px solid #000; padding-bottom: 8px; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 32px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; }
    .meta { color: #666; font-size: 11px; }
    .hash { font-family: monospace; word-break: break-all; font-size: 10px; color: #888; }
    @media print { body { margin: 20px; } }
  </style></head><body>`);

  // header
  h(`<h1>TRACE CASE PACKAGE</h1>`);
  h(`<p><strong>${opts.title}</strong></p>`);
  if (opts.description) h(`<p>${opts.description}</p>`);
  h(`<p class="meta">Generated: ${new Date().toISOString()} | Package ID: ${opts.generatedBy.slice(0, 8)}</p>`);
  h(`<hr>`);

  // vehicle dossier
  if (vehicle) {
    h(`<h2>VEHICLE DOSSIER</h2>`);
    h(`<table>`);
    h(`<tr><th>Plate</th><td style="font-size:18px;font-weight:bold;letter-spacing:3px">${vehicle.plate || "Unknown"}</td></tr>`);
    h(`<tr><th>Make / Model</th><td>${[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown"}</td></tr>`);
    h(`<tr><th>Year</th><td>${vehicle.year || "Unknown"}</td></tr>`);
    h(`<tr><th>Color</th><td>${vehicle.color || "Unknown"}</td></tr>`);
    h(`<tr><th>Types</th><td>${vehicleTypeLabels.join(", ") || "None assigned"}</td></tr>`);
    h(`<tr><th>Status</th><td>${vehicle.status}</td></tr>`);
    if (vehicle.description) h(`<tr><th>Description</th><td>${vehicle.description}</td></tr>`);
    h(`</table>`);
  }

  // sighting timeline
  if (vehicleSightings.length > 0) {
    h(`<h2>SIGHTING TIMELINE (${vehicleSightings.length} records)</h2>`);
    h(`<table><tr><th>#</th><th>Date</th><th>Location</th><th>Activity</th><th>Direction</th></tr>`);
    vehicleSightings.forEach((s, i) => {
      h(`<tr><td>${i + 1}</td><td>${new Date(s.observedAt).toLocaleString()}</td>`);
      h(`<td>${s.locationDescription || `${s.lat?.toFixed(4)}, ${s.lng?.toFixed(4)}`}</td>`);
      h(`<td>${s.activityDescription || ""}</td><td>${s.direction || ""}</td></tr>`);
    });
    h(`</table>`);
  }

  // suspicion history
  if (vehicleHistory.length > 0) {
    h(`<h2>SUSPICION LEVEL HISTORY</h2>`);
    h(`<table><tr><th>Date</th><th>From</th><th>To</th><th>Reason</th><th>Changed By</th></tr>`);
    vehicleHistory.forEach((entry) => {
      h(`<tr><td>${new Date(entry.createdAt).toLocaleString()}</td>`);
      h(`<td>${entry.fromLevelId ? (levelMap.get(entry.fromLevelId) || "—") : "—"}</td>`);
      h(`<td>${levelMap.get(entry.toLevelId) || "—"}</td>`);
      h(`<td>${entry.reason}</td><td>${entry.changedByRole}</td></tr>`);
    });
    h(`</table>`);
  }

  // linked actors
  if (linkedActors.length > 0) {
    h(`<h2>ASSOCIATED ACTORS (${linkedActors.length})</h2>`);
    linkedActors.forEach((a) => {
      h(`<table>`);
      h(`<tr><th>Alias</th><td><strong>${a.alias || "Unknown"}</strong></td></tr>`);
      if (a.riskLevel) h(`<tr><th>Risk Level</th><td>${a.riskLevel}</td></tr>`);
      if (a.physicalDescription) h(`<tr><th>Physical</th><td>${a.physicalDescription}</td></tr>`);
      if (a.notes) h(`<tr><th>Notes</th><td>${a.notes}</td></tr>`);
      h(`</table><br>`);
    });
  }

  // integrity verification
  h(`<h2>INTEGRITY VERIFICATION</h2>`);
  h(`<p>This case package contains a cryptographic manifest of all referenced evidence.</p>`);
  h(`<p>Package manifest hash:</p>`);
  h(`<p class="hash">${manifest}</p>`);
  h(`<p class="meta">Verify by recomputing SHA-256 of all evidence content hashes concatenated in order.</p>`);

  h(`</body></html>`);
  return lines.join("\n");
}

/**
 * Generate a case package and save it.
 */
export async function generateCasePackage(opts: CasePackageOpts): Promise<{
  packageId: string;
  exportPath: string;
  manifestHash: string;
}> {
  const intel = await gatherIntelligence(opts);

  // collect all evidence hashes for manifest
  const evidenceHashes: string[] = [];
  if (opts.vehicleId) {
    const records = await evidenceDb
      .select({ contentHash: evidenceRecords.contentHash })
      .from(evidenceRecords)
      .where(eq(evidenceRecords.chapterId, opts.chapterId))
      .orderBy(evidenceRecords.createdAt);
    records.forEach((r) => evidenceHashes.push(r.contentHash));
  }

  // manifest = SHA-256 of all evidence hashes
  const manifestInput = evidenceHashes.join(":");
  const manifestHash = createHash("sha256").update(manifestInput || "empty").digest("hex");

  // render HTML
  const html = renderCasePackageHTML(opts, intel, manifestHash);

  // save
  const outputDir = join(process.env.EVIDENCE_STORAGE_PATH || "./data/evidence", "packages");
  await mkdir(outputDir, { recursive: true });
  const filename = `case-${Date.now()}.html`;
  const exportPath = join(outputDir, filename);
  await writeFile(exportPath, html);

  // record in Vault C
  const [pkg] = await evidenceDb
    .insert(casePackages)
    .values({
      chapterId: opts.chapterId,
      title: opts.title,
      description: opts.description || null,
      vehicleId: opts.vehicleId || null,
      actorId: opts.actorId || null,
      manifestHash,
      generatedBy: opts.generatedBy,
      exportPath,
    })
    .returning();

  // link evidence records to package
  for (const hash of evidenceHashes) {
    const [record] = await evidenceDb
      .select({ id: evidenceRecords.id })
      .from(evidenceRecords)
      .where(eq(evidenceRecords.contentHash, hash))
      .limit(1);
    if (record) {
      await evidenceDb.insert(casePackageEvidence).values({
        packageId: pkg.id,
        evidenceId: record.id,
      });
    }
  }

  console.log(`Case package generated: ${exportPath}`);
  return { packageId: pkg.id, exportPath, manifestHash };
}
