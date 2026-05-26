/**
 * TRACE — Vault B: Identity Schema
 *
 * Physically separated from operational data.
 * Separate encryption key stored in OS keychain.
 * A dump of Vault A reveals ZERO real identities because
 * this data literally isn't in the same schema.
 *
 * The ONLY link between Vault A and Vault B is the reporter UUID.
 * Vault B stores the real identity; Vault A stores the callsign.
 */
import {
  uuid, text, timestamp, varchar, boolean,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { ident, id, createdAt, updatedAt, roleEnum } from "./shared.js";

// ============================================================
// REPORTER IDENTITIES (the crown jewel — protect at all costs)
// ============================================================
export const reporterIdentities = ident.table("reporter_identities", {
  id: id(),
  // This UUID matches reporters.id in Vault A — the ONLY cross-vault link
  reporterId: uuid("reporter_id").notNull().unique(),
  realName: text("real_name"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 255 }),
  role: roleEnum("role").default("reporter").notNull(),
  // SHA-256 hash of operator access code (operators/admins only)
  accessCodeHash: varchar("access_code_hash", { length: 64 }),
  // field-level encryption for real_name, phone, email at rest
  encryptedFields: boolean("encrypted_fields").default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("ri_email").on(t.email),
]);

// ============================================================
// MAGIC LINK AUTH (no passwords ever)
// ============================================================
export const magicLinkTokens = ident.table("magic_link_tokens", {
  id: id(),
  identityId: uuid("identity_id").notNull().references(() => reporterIdentities.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),  // SHA-256 of token
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("mlt_token").on(t.tokenHash),
  index("mlt_expires").on(t.expiresAt),
]);

// ============================================================
// TOTP (for operator/admin 2FA)
// ============================================================
export const totpSecrets = ident.table("totp_secrets", {
  id: id(),
  identityId: uuid("identity_id").notNull().references(() => reporterIdentities.id).unique(),
  // encrypted TOTP secret (AES-256, key from TOTP_ENCRYPTION_KEY env)
  encryptedSecret: text("encrypted_secret").notNull(),
  verified: boolean("verified").default(false),
  createdAt: createdAt(),
});

// ============================================================
// SESSIONS
// ============================================================
export const sessions = ident.table("sessions", {
  id: id(),
  identityId: uuid("identity_id").notNull().references(() => reporterIdentities.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  // credential-pinned key for multi-session consistency (MOIRÉ)
  credentialPin: varchar("credential_pin", { length: 64 }),
  userAgent: text("user_agent"),
  ipHash: varchar("ip_hash", { length: 64 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  index("sessions_identity").on(t.identityId),
  index("sessions_expires").on(t.expiresAt),
]);
