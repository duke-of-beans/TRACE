/**
 * TRACE — Vault C: Evidence Locker
 *
 * Write-once, append-only evidence storage.
 * Every record carries a SHA-256 hash from point of capture.
 * Hash chain links records for tamper detection.
 * This is the legal-grade evidence foundation.
 *
 * Design principle: if you can verify the hash chain,
 * you can verify the evidence — no trust in the operator required.
 */
import {
  uuid, text, timestamp, varchar, integer, boolean, jsonb,
  index,
} from "drizzle-orm/pg-core";
import { evidence, id, createdAt } from "./shared.js";

// ============================================================
// EVIDENCE RECORDS (write-once, never updated)
// ============================================================
export const evidenceRecords = evidence.table("evidence_records", {
  id: id(),
  chapterId: uuid("chapter_id").notNull(),
  // SHA-256 hash of the raw content at capture time
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  // hash of previous record in chain (genesis record has null)
  previousHash: varchar("previous_hash", { length: 64 }),
  // chain hash = SHA-256(contentHash + previousHash + createdAt)
  chainHash: varchar("chain_hash", { length: 64 }).notNull(),
  // evidence type
  evidenceType: varchar("evidence_type", { length: 32 }).notNull(), // photo, document, note, export
  mimeType: varchar("mime_type", { length: 128 }),
  // storage
  storagePath: text("storage_path").notNull(),            // local path to encrypted blob
  fileSizeBytes: integer("file_size_bytes"),
  // EXIF (preserved from original, device info stripped)
  exifLat: varchar("exif_lat", { length: 32 }),           // stored as string to preserve precision
  exifLng: varchar("exif_lng", { length: 32 }),
  exifTimestamp: timestamp("exif_timestamp", { withTimezone: true }),
  // metadata
  encrypted: boolean("encrypted").default(true),
  createdAt: createdAt(),
  // NO updatedAt — evidence records are immutable
}, (t) => [
  index("er_chapter").on(t.chapterId),
  index("er_chain").on(t.chainHash),
  index("er_type").on(t.evidenceType),
]);

// ============================================================
// EVIDENCE ACCESS LOG (who touched what, when)
// ============================================================
export const evidenceAccessLog = evidence.table("evidence_access_log", {
  id: id(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidenceRecords.id),
  accessorId: uuid("accessor_id").notNull(),              // reporter/operator UUID
  accessorRole: varchar("accessor_role", { length: 16 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),    // view, export, include_in_package
  ipHash: varchar("ip_hash", { length: 64 }),
  createdAt: createdAt(),
}, (t) => [
  index("eal_evidence").on(t.evidenceId),
]);

// ============================================================
// CASE PACKAGES (generated legal-grade evidence bundles)
// ============================================================
export const casePackages = evidence.table("case_packages", {
  id: id(),
  chapterId: uuid("chapter_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  vehicleId: uuid("vehicle_id"),                          // primary vehicle (if applicable)
  actorId: uuid("actor_id"),                              // primary actor (if applicable)
  // package integrity
  manifestHash: varchar("manifest_hash", { length: 64 }), // SHA-256 of all included evidence hashes
  generatedBy: uuid("generated_by").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  // exported file
  exportPath: text("export_path"),                         // path to generated PDF
  createdAt: createdAt(),
});

export const casePackageEvidence = evidence.table("case_package_evidence", {
  id: id(),
  packageId: uuid("package_id").notNull().references(() => casePackages.id),
  evidenceId: uuid("evidence_id").notNull().references(() => evidenceRecords.id),
  sortOrder: integer("sort_order").default(0),
  annotation: text("annotation"),                          // operator notes on this evidence item
  createdAt: createdAt(),
});
