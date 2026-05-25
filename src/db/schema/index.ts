/**
 * TRACE — Database Schema Index
 *
 * Three-vault architecture:
 *   Vault A (ops)      — Operational data, pseudonymous. Zero real identities.
 *   Vault B (ident)    — Reporter real identities. Separate encryption key.
 *   Vault C (evidence) — Write-once evidence locker. SHA-256 hash chain.
 *
 * The ONLY cross-vault link is the reporter UUID.
 */

// Shared types
export * from "./shared.js";

// Vault A — Operational
export * from "./vault-a.js";

// Vault B — Identity
export * from "./vault-b.js";

// Vault C — Evidence
export * from "./vault-c.js";
