/**
 * TRACE — Database Connections
 *
 * Three logical vaults using PostgreSQL schemas:
 *   ops    — operational data (vehicles, sightings, actors)
 *   ident  — identity data (reporter identities, sessions)
 *   evidence — write-once evidence locker
 *
 * In development: three separate connection strings + roles.
 * In production (Neon/Vercel): single DATABASE_URL, schema separation.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as opsSchema from "./schema/vault-a.js";
import * as identSchema from "./schema/vault-b.js";
import * as evidenceSchema from "./schema/vault-c.js";

function env(key: string, fallback?: string): string {
  const val = process.env[key] || fallback;
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const poolMax = isServerless ? 1 : 10;
const idleTimeout = isServerless ? 5 : 20;

// Single DATABASE_URL mode (production) or three separate URLs (dev)
const singleUrl = process.env.DATABASE_URL;

// --- Vault A: Operational ---
const opsClient = postgres(singleUrl || env("DATABASE_URL_OPS"), {
  max: poolMax,
  idle_timeout: idleTimeout,
  connection: { search_path: "ops,public" },
});
export const opsDb = drizzle(opsClient, { schema: opsSchema });

// --- Vault B: Identity ---
const identClient = postgres(singleUrl || env("DATABASE_URL_IDENT"), {
  max: isServerless ? 1 : 5,
  idle_timeout: idleTimeout,
  connection: { search_path: "ident,public" },
});
export const identDb = drizzle(identClient, { schema: identSchema });

// --- Vault C: Evidence ---
const evidenceClient = postgres(singleUrl || env("DATABASE_URL_EVIDENCE"), {
  max: isServerless ? 1 : 5,
  idle_timeout: idleTimeout,
  connection: { search_path: "evidence,public" },
});
export const evidenceDb = drizzle(evidenceClient, { schema: evidenceSchema });

// --- Shutdown ---
export async function closeAll() {
  await opsClient.end();
  await identClient.end();
  await evidenceClient.end();
}
