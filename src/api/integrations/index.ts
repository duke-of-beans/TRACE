/**
 * TRACE — Integrations API
 *
 * Admin-only. Manages API key configuration for external services
 * (CarAPI, Spokeo, future: Bumper). Keys are encrypted at rest
 * using the same AES-256-GCM as Vault B identity fields.
 * Keys never leave the server. Client sees masked status only.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { integrationConfig } from "../../db/schema/vault-a.js";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../../services/encryption.js";

const KNOWN_SERVICES = ["carapi", "spokeo", "bumper"];

export const integrationsRouter = new Hono();

// GET / — list all integrations for the chapter (keys masked)
integrationsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const configs = await opsDb
    .select()
    .from(integrationConfig)
    .where(eq(integrationConfig.chapterId, chapterId));

  // Mask API keys, return status info only
  const result = configs.map((cfg) => ({
    id: cfg.id,
    serviceName: cfg.serviceName,
    enabled: cfg.enabled,
    configured: true,
    lastTestedAt: cfg.lastTestedAt,
    lastTestResult: cfg.lastTestResult,
    lookupsThisMonth: cfg.lookupsThisMonth,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  }));

  // Add unconfigured services as placeholders
  for (const svc of KNOWN_SERVICES) {
    if (!result.find((r) => r.serviceName === svc)) {
      result.push({
        id: null as any,
        serviceName: svc,
        enabled: false,
        configured: false,
        lastTestedAt: null,
        lastTestResult: null,
        lookupsThisMonth: 0,
        createdAt: null as any,
        updatedAt: null as any,
      });
    }
  }

  return c.json(result);
});

// PUT /:service — configure or update an integration
integrationsRouter.put("/:service", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const service = c.req.param("service");
  if (!KNOWN_SERVICES.includes(service)) {
    return c.json({ error: `Unknown service: ${service}` }, 400);
  }

  const body = await c.req.json();
  const { apiKey, enabled } = body;

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
    return c.json({ error: "API key required (min 8 chars)" }, 400);
  }

  const encrypted = encrypt(apiKey.trim());

  // Upsert
  const existing = await opsDb
    .select()
    .from(integrationConfig)
    .where(and(
      eq(integrationConfig.chapterId, chapterId),
      eq(integrationConfig.serviceName, service),
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await opsDb
      .update(integrationConfig)
      .set({
        apiKeyEncrypted: encrypted,
        enabled: enabled ?? existing[0].enabled,
        updatedAt: new Date(),
      })
      .where(eq(integrationConfig.id, existing[0].id))
      .returning();
    return c.json({ serviceName: service, configured: true, enabled: updated.enabled });
  }

  const [created] = await opsDb
    .insert(integrationConfig)
    .values({
      chapterId,
      serviceName: service,
      apiKeyEncrypted: encrypted,
      enabled: enabled ?? false,
    })
    .returning();

  return c.json({ serviceName: service, configured: true, enabled: created.enabled }, 201);
});

// POST /:service/test — test the connection
integrationsRouter.post("/:service/test", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const service = c.req.param("service");

  const [cfg] = await opsDb
    .select()
    .from(integrationConfig)
    .where(and(
      eq(integrationConfig.chapterId, chapterId),
      eq(integrationConfig.serviceName, service),
    ))
    .limit(1);

  if (!cfg) return c.json({ error: "Integration not configured" }, 404);

  let apiKey: string;
  try {
    apiKey = decrypt(cfg.apiKeyEncrypted);
  } catch {
    await opsDb
      .update(integrationConfig)
      .set({ lastTestedAt: new Date(), lastTestResult: "error", updatedAt: new Date() })
      .where(eq(integrationConfig.id, cfg.id));
    return c.json({ result: "error", message: "Failed to decrypt API key" });
  }

  // Service-specific test logic
  let result: "success" | "auth_failed" | "error" = "error";
  let message = "";

  try {
    if (service === "carapi") {
      // CarAPI: test with auth endpoint
      const resp = await fetch("https://carapi.app/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: apiKey }),
      });
      result = resp.ok ? "success" : "auth_failed";
      message = resp.ok ? "Connected to CarAPI" : "Authentication failed";
    } else if (service === "spokeo") {
      // Spokeo: test with a known-safe phone number lookup
      const resp = await fetch(`https://api.spokeo.com/v1/search?phone=0000000000`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      // 200 or 404 both mean the key works; 401/403 means auth failed
      result = resp.status === 401 || resp.status === 403 ? "auth_failed" : "success";
      message = result === "success" ? "Connected to Spokeo" : "Authentication failed";
    } else {
      result = "error";
      message = `No test available for ${service}`;
    }
  } catch (err: any) {
    result = "error";
    message = `Connection failed: ${err.message || "unknown error"}`;
  }

  await opsDb
    .update(integrationConfig)
    .set({ lastTestedAt: new Date(), lastTestResult: result, updatedAt: new Date() })
    .where(eq(integrationConfig.id, cfg.id));

  return c.json({ result, message });
});

// DELETE /:service — remove an integration
integrationsRouter.delete("/:service", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const service = c.req.param("service");

  const deleted = await opsDb
    .delete(integrationConfig)
    .where(and(
      eq(integrationConfig.chapterId, chapterId),
      eq(integrationConfig.serviceName, service),
    ))
    .returning();

  if (deleted.length === 0) return c.json({ error: "Integration not found" }, 404);
  return c.json({ deleted: true });
});

/**
 * Helper: check if a service is configured and enabled for a chapter.
 * Used by other routes to determine whether API buttons should appear.
 */
export async function isIntegrationEnabled(
  chapterId: string,
  service: string
): Promise<boolean> {
  const [cfg] = await opsDb
    .select({ enabled: integrationConfig.enabled })
    .from(integrationConfig)
    .where(and(
      eq(integrationConfig.chapterId, chapterId),
      eq(integrationConfig.serviceName, service),
    ))
    .limit(1);
  return cfg?.enabled ?? false;
}

/**
 * Helper: get the decrypted API key for a service.
 * Returns null if not configured or disabled.
 */
export async function getApiKey(
  chapterId: string,
  service: string
): Promise<string | null> {
  const [cfg] = await opsDb
    .select()
    .from(integrationConfig)
    .where(and(
      eq(integrationConfig.chapterId, chapterId),
      eq(integrationConfig.serviceName, service),
    ))
    .limit(1);

  if (!cfg || !cfg.enabled) return null;

  try {
    return decrypt(cfg.apiKeyEncrypted);
  } catch {
    return null;
  }
}

/**
 * Helper: increment the lookup counter for a service.
 */
export async function incrementLookupCount(
  chapterId: string,
  service: string
): Promise<void> {
  const [cfg] = await opsDb
    .select()
    .from(integrationConfig)
    .where(and(
      eq(integrationConfig.chapterId, chapterId),
      eq(integrationConfig.serviceName, service),
    ))
    .limit(1);

  if (!cfg) return;

  // Reset counter if month changed
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const resetNeeded = cfg.monthResetAt < monthStart;

  await opsDb
    .update(integrationConfig)
    .set({
      lookupsThisMonth: resetNeeded ? 1 : cfg.lookupsThisMonth + 1,
      monthResetAt: resetNeeded ? monthStart : cfg.monthResetAt,
      updatedAt: now,
    })
    .where(eq(integrationConfig.id, cfg.id));
}
