/**
 * TRACE — Auth Middleware
 *
 * Validates session tokens against Vault B.
 * Injects reporter identity and chapter context into request.
 * Operators/admins get elevated permissions.
 */
import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { identDb, opsDb } from "../db/connection.js";
import { sessions, reporterIdentities } from "../db/schema/vault-b.js";
import { reporters } from "../db/schema/vault-a.js";
import { eq, and, gte } from "drizzle-orm";

export type AuthContext = {
  sessionId: string;
  identityId: string;
  reporterId: string;
  chapterId: string;
  role: "reporter" | "operator" | "admin";
};

/**
 * Auth middleware - validates Bearer token, resolves identity,
 * injects AuthContext into request headers for downstream routes.
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // look up session in Vault B
  const [session] = await identDb
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gte(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  // resolve identity
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.id, session.identityId))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 401);
  }

  // resolve reporter (Vault A) to get chapterId
  const [reporter] = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.id, identity.reporterId))
    .limit(1);

  if (!reporter) {
    return c.json({ error: "Reporter not found" }, 401);
  }

  // update last active
  await identDb
    .update(sessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(sessions.id, session.id));

  // inject context via headers (consumed by route handlers)
  c.req.raw.headers.set("x-session-id", session.id);
  c.req.raw.headers.set("x-identity-id", identity.id);
  c.req.raw.headers.set("x-reporter-id", identity.reporterId);
  c.req.raw.headers.set("x-chapter-id", reporter.chapterId);
  c.req.raw.headers.set("x-role", identity.role);

  await next();
});

/**
 * Role guard - restricts routes to operator/admin only.
 */
export const operatorOnly = createMiddleware(async (c, next) => {
  const role = c.req.header("x-role");
  if (role !== "operator" && role !== "admin") {
    return c.json({ error: "Operator access required" }, 403);
  }
  await next();
});

export const adminOnly = createMiddleware(async (c, next) => {
  const role = c.req.header("x-role");
  if (role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
});
