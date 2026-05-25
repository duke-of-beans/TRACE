/**
 * TRACE — Evidence Service
 *
 * Write-once evidence storage with SHA-256 hash chain.
 * Every piece of evidence carries a cryptographic proof of integrity
 * from point of capture. The chain is verifiable by anyone with
 * the case package - no trust in the operator required.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { evidenceDb } from "../db/connection.js";
import { evidenceRecords, evidenceAccessLog } from "../db/schema/vault-c.js";
import { desc, eq } from "drizzle-orm";
import { encryptEvidence, decryptEvidence } from "./encryption.js";

const EVIDENCE_PATH = process.env.EVIDENCE_STORAGE_PATH || "./data/evidence";

/**
 * Compute SHA-256 hash of a buffer.
 */
function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Compute the chain hash: SHA-256(contentHash + previousHash + timestamp)
 * This links each evidence record to the one before it.
 */
function computeChainHash(
  contentHash: string,
  previousHash: string | null,
  timestamp: string
): string {
  const input = `${contentHash}:${previousHash || "genesis"}:${timestamp}`;
  return sha256(input);
}

/**
 * Get the most recent chain hash for a chapter (the "tip" of the chain).
 */
async function getChainTip(chapterId: string): Promise<string | null> {
  const [latest] = await evidenceDb
    .select({ chainHash: evidenceRecords.chainHash })
    .from(evidenceRecords)
    .where(eq(evidenceRecords.chapterId, chapterId))
    .orderBy(desc(evidenceRecords.createdAt))
    .limit(1);

  return latest?.chainHash || null;
}

/**
 * Store a piece of evidence in Vault C.
 * Computes content hash, extends hash chain, writes encrypted blob to disk.
 *
 * Returns the evidence record (write-once, never updated).
 */
export async function storeEvidence(opts: {
  chapterId: string;
  data: Buffer;
  evidenceType: string;
  mimeType?: string;
  exifLat?: string;
  exifLng?: string;
  exifTimestamp?: Date;
}): Promise<{ id: string; contentHash: string; chainHash: string }> {
  const { chapterId, data, evidenceType, mimeType, exifLat, exifLng, exifTimestamp } = opts;

  // 1. Hash the raw content
  const contentHash = sha256(data);

  // 2. Get the previous chain tip
  const previousHash = await getChainTip(chapterId);

  // 3. Compute chain hash
  const now = new Date();
  const chainHash = computeChainHash(contentHash, previousHash, now.toISOString());

  // 4. Write encrypted blob to disk
  // Storage path: EVIDENCE_PATH/chapterId/YYYY-MM/contentHash
  const dateDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const storagePath = join(EVIDENCE_PATH, chapterId, dateDir, contentHash);
  await mkdir(dirname(storagePath), { recursive: true });

  // TODO: encrypt data with EVIDENCE_ENCRYPTION_KEY before writing
  const shouldEncrypt = !!process.env.EVIDENCE_ENCRYPTION_KEY;
  const writeData = shouldEncrypt ? encryptEvidence(data) : data;
  await writeFile(storagePath, writeData);

  // 5. Insert record (write-once)
  const [record] = await evidenceDb
    .insert(evidenceRecords)
    .values({
      chapterId,
      contentHash,
      previousHash,
      chainHash,
      evidenceType,
      mimeType: mimeType || "application/octet-stream",
      storagePath,
      fileSizeBytes: data.length,
      exifLat,
      exifLng,
      exifTimestamp,
      encrypted: shouldEncrypt,
    })
    .returning();

  return { id: record.id, contentHash, chainHash };
}

/**
 * Verify the integrity of the evidence chain for a chapter.
 * Walks the chain from genesis to tip, recomputing each chain hash.
 * Returns any broken links.
 */
export async function verifyChain(
  chapterId: string
): Promise<{ valid: boolean; totalRecords: number; brokenLinks: string[] }> {
  const records = await evidenceDb
    .select()
    .from(evidenceRecords)
    .where(eq(evidenceRecords.chapterId, chapterId))
    .orderBy(evidenceRecords.createdAt);

  const brokenLinks: string[] = [];
  let expectedPrevious: string | null = null;

  for (const record of records) {
    // verify previous hash pointer
    if (record.previousHash !== expectedPrevious) {
      brokenLinks.push(record.id);
    }

    // verify chain hash computation
    const expected = computeChainHash(
      record.contentHash,
      record.previousHash,
      record.createdAt.toISOString()
    );
    if (record.chainHash !== expected) {
      brokenLinks.push(record.id);
    }

    expectedPrevious = record.chainHash;
  }

  return {
    valid: brokenLinks.length === 0,
    totalRecords: records.length,
    brokenLinks,
  };
}

/**
 * Read evidence data from disk and log the access.
 */
export async function readEvidence(opts: {
  evidenceId: string;
  accessorId: string;
  accessorRole: string;
  action?: string;
}): Promise<Buffer | null> {
  const [record] = await evidenceDb
    .select()
    .from(evidenceRecords)
    .where(eq(evidenceRecords.id, opts.evidenceId))
    .limit(1);

  if (!record) return null;

  // log access (append-only)
  await evidenceDb.insert(evidenceAccessLog).values({
    evidenceId: opts.evidenceId,
    accessorId: opts.accessorId,
    accessorRole: opts.accessorRole,
    action: opts.action || "view",
  });

  // decrypt if encrypted
  const rawData = await readFile(record.storagePath);
  const data = record.encrypted ? decryptEvidence(rawData) : rawData;
  return data;
}
