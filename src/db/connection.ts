/**
 * TRACE — Database Connections
 *
 * Three separate connection pools for three vaults.
 * Each vault uses a different PostgreSQL role with minimal privileges.
 * Vault A (ops): read/write operational data
 * Vault B (ident): read/write identity data (restricted role)
 * Vault C (evidence): append-only (INSERT + SELECT, no UPDATE/DELETE)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as opsSchema from "./schema/vault-a.js";
import * as identSchema from "./schema/vault-b.js";
import * as evidenceSchema from "./schema/vault-c.js";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

// --- Vault A: Operational ---
const opsClient = postgres(env("DATABASE_URL_OPS"), {
  max: 10,
  idle_timeout: 20,
});
export const opsDb = drizzle(opsClient, { schema: opsSchema });

// --- Vault B: Identity ---
const identClient = postgres(env("DATABASE_URL_IDENT"), {
  max: 5,  // fewer connections — identity lookups are infrequent
  idle_timeout: 20,
});
export const identDb = drizzle(identClient, { schema: identSchema });

// --- Vault C: Evidence ---
const evidenceClient = postgres(env("DATABASE_URL_EVIDENCE"), {
  max: 5,
  idle_timeout: 20,
});
export const evidenceDb = drizzle(evidenceClient, { schema: evidenceSchema });

// --- Shutdown ---
export async function closeAll() {
  await opsClient.end();
  await identClient.end();
  await evidenceClient.end();
}
