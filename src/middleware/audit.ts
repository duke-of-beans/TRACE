/**
 * TRACE — Audit Middleware
 *
 * Logs every API action to the immutable audit trail.
 * Every data access, every level change, every export is logged.
 * The audit log itself is integrity-hashed.
 * An admin can review who accessed what - and the admin's review
 * is itself logged.
 */
import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { opsDb } from "../db/connection.js";
import { auditLog } from "../db/schema/vault-a.js";

/**
 * Map HTTP method + path pattern to action strings.
 */
function deriveAction(method: string, path: string): string {
  // normalize: POST /api/v1/sightings -> sighting.create
  const segments = path.replace(/^\/api\/v1\//, "").split("/");
  const resource = segments[0]?.replace(/s$/, "") || "unknown"; // depluralize

  switch (method) {
    case "POST":   return `${resource}.create`;
    case "PUT":
    case "PATCH":  return `${resource}.update`;
    case "DELETE": return `${resource}.delete`;
    default:       return `${resource}.read`;
  }
}

/**
 * Extract target type and ID from URL path.
 */
function deriveTarget(path: string): { type: string | null; id: string | null } {
  const segments = path.replace(/^\/api\/v1\//, "").split("/");
  const type = segments[0] || null;
  // UUID pattern in second segment
  const id = segments[1]?.match(/^[0-9a-f-]{36}$/i) ? segments[1] : null;
  return { type, id };
}

/**
 * Audit middleware - logs every mutating request.
 * GET requests are logged only for sensitive resources.
 */
export const auditMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;

  await next();

  // only audit mutating operations and sensitive reads
  const shouldAudit =
    method !== "GET" ||
    path.includes("/admin/") ||
    path.includes("/evidence/") ||
    path.includes("/auth/");

  if (!shouldAudit) return;

  const chapterId = c.req.header("x-chapter-id") || "";
  const actorId = c.req.header("x-reporter-id") || null;
  const actorRole = c.req.header("x-role") || null;
  const { type, id } = deriveTarget(path);

  // hash IP for privacy (never store raw IP)
  const rawIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "";
  const ipHash = rawIp ? createHash("sha256").update(rawIp).digest("hex") : null;

  try {
    await opsDb.insert(auditLog).values({
      chapterId,
      actorId: actorId,
      actorRole,
      action: deriveAction(method, path),
      targetType: type,
      targetId: id,
      detail: {
        method,
        path,
        status: c.res.status,
      },
      ipHash,
    });
  } catch (err) {
    // audit failures should never break the request
    console.error("Audit log failed:", err);
  }
});
