/**
 * TRACE API — Setup & Bootstrap
 *
 * First-run setup creates the initial operator and chapter.
 * Only works when no operators exist in the database.
 * After first operator is created, these endpoints lock.
 */
import { Hono } from "hono";
import { opsDb, identDb } from "../../db/connection.js";
import { reporters, chapters } from "../../db/schema/vault-a.js";
import { reporterIdentities, sessions } from "../../db/schema/vault-b.js";
import { eq, count } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

export const setupRouter = new Hono();

// --- GET /setup/status — check if setup is needed ---
setupRouter.get("/status", async (c) => {
  const [result] = await identDb
    .select({ total: count() })
    .from(reporterIdentities)
    .where(eq(reporterIdentities.role, "operator"));

  const operatorCount = result?.total || 0;
  const [chapterResult] = await opsDb.select({ total: count() }).from(chapters);
  const chapterCount = chapterResult?.total || 0;

  return c.json({
    needsSetup: operatorCount === 0,
    operatorCount,
    chapterCount,
  });
});

// --- POST /setup/bootstrap — create first operator + chapter ---
setupRouter.post("/bootstrap", async (c) => {
  const [result] = await identDb
    .select({ total: count() })
    .from(reporterIdentities)
    .where(eq(reporterIdentities.role, "operator"));

  if ((result?.total || 0) > 0) {
    return c.json({ error: "Setup already complete. Operators exist." }, 403);
  }

  const { callsign, accessCode, chapterName } = await c.req.json();
  if (!callsign || !accessCode) {
    return c.json({ error: "Callsign and access code required" }, 400);
  }
  if (accessCode.length < 6) {
    return c.json({ error: "Access code must be at least 6 characters" }, 400);
  }

  const normalizedCallsign = callsign.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const name = chapterName || "My Chapter";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  let [chapter] = await opsDb.select().from(chapters).limit(1);
  if (!chapter) {
    [chapter] = await opsDb
      .insert(chapters)
      .values({ name, slug, sunsetDays: 90 })
      .returning();
  }

  const [operator] = await opsDb
    .insert(reporters)
    .values({ chapterId: chapter.id, callsign: normalizedCallsign })
    .returning();

  const codeHash = createHash("sha256").update(accessCode).digest("hex");
  const [identity] = await identDb
    .insert(reporterIdentities)
    .values({
      reporterId: operator.id,
      role: "operator",
      accessCodeHash: codeHash,
    })
    .returning();

  const sessionToken = randomBytes(32).toString("hex");
  const sessionHash = createHash("sha256").update(sessionToken).digest("hex");
  await identDb.insert(sessions).values({
    identityId: identity.id,
    tokenHash: sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    status: "setup_complete",
    sessionToken,
    callsign: normalizedCallsign,
    chapterName: chapter.name,
    role: "operator",
  }, 201);
});
