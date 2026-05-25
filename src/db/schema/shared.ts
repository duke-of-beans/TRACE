/**
 * TRACE — Shared schema types and helpers
 * Used across all three vaults.
 */
import { pgSchema, uuid, timestamp, text } from "drizzle-orm/pg-core";

// ---------- Vault schemas (physical separation) ----------
export const ops = pgSchema("ops");
export const ident = pgSchema("ident");
export const evidence = pgSchema("evidence");

// ---------- Common column helpers ----------
export const id = () => uuid("id").primaryKey().defaultRandom();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Enums ----------
export const reporterStatusEnum = ops.enum("reporter_status", [
  "active",
  "inactive",
  "suspended",
]);

export const vehicleStatusEnum = ops.enum("vehicle_status", [
  "active",
  "retired",
  "archived",
]);

export const actorStatusEnum = ops.enum("actor_status", [
  "active",
  "inactive",
  "archived",
]);

export const roleEnum = ident.enum("user_role", [
  "reporter",
  "operator",
  "admin",
]);
