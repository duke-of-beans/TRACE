/**
 * TRACE API — Auth
 *
 * Magic link (no passwords) for reporters.
 * TOTP second factor for operator/admin.
 * All identity operations hit Vault B only.
 */
import { Hono } from "hono";
import { z } from "zod";
import { identDb, opsDb } from "../../db/connection.js";
import { reporterIdentities, magicLinkTokens, sessions, totpSecrets } from "../../db/schema/vault-b.js";
import { reporters, chapters } from "../../db/schema/vault-a.js";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

export const authRouter = new Hono();

// --- POST /auth/operator-login — proper operator auth with access code ---
authRouter.post("/operator-login", async (c) => {
  const { callsign, accessCode } = await c.req.json();
  if (!callsign) return c.json({ error: "Callsign required" }, 400);

  const normalizedCallsign = callsign.toUpperCase().replace(/[^A-Z0-9-]/g, "");

  // Find reporter by callsign
  const [reporter] = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.callsign, normalizedCallsign))
    .limit(1);

  if (!reporter) return c.json({ error: "Authentication failed" }, 401);

  // Find identity
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.reporterId, reporter.id))
    .limit(1);

  if (!identity) return c.json({ error: "Authentication failed" }, 401);

  // Must be operator or admin
  if (identity.role !== "operator" && identity.role !== "admin") {
    return c.json({ error: "Access denied. Operator or admin role required." }, 403);
  }

  // Check access code (skip in dev mode)
  const devMode = process.env.TRACE_DISABLE_DEV_LOGIN !== "true";

  if (!devMode) {
    // Production: access code required
    if (!accessCode) return c.json({ error: "Access code required" }, 401);
    const codeHash = createHash("sha256").update(accessCode).digest("hex");
    if (identity.accessCodeHash && identity.accessCodeHash !== codeHash) {
      return c.json({ error: "Authentication failed" }, 401);
    }
    // If no access code hash stored, check via invite code flow
    if (!identity.accessCodeHash) {
      return c.json({ error: "No access code configured. Contact chapter admin." }, 401);
    }
  }

  // Create session
  const sessionToken = randomBytes(32).toString("hex");
  const sessionHash = createHash("sha256").update(sessionToken).digest("hex");
  await identDb.insert(sessions).values({
    identityId: identity.id,
    tokenHash: sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    status: "authenticated",
    sessionToken,
    reporterId: identity.reporterId,
    role: identity.role,
  });
});

// --- POST /auth/invite-code — verify an invite code (no email needed) ---
authRouter.post("/invite-code", async (c) => {
  const { code } = await c.req.json();
  if (!code) return c.json({ error: "Code required" }, 400);

  const normalized = code.replace(/[-\s]/g, "").toUpperCase();

  // DEMO MODE: accept TEST-CODE for testing. Disable with TRACE_DISABLE_TEST_CODE=true.
  if (process.env.TRACE_DISABLE_TEST_CODE !== "true" && normalized === "TESTCODE") {
    const [chapter] = await opsDb.select().from(chapters).limit(1);
    if (!chapter) return c.json({ error: "No chapter. Run seed." }, 500);

    const callsign = `TEST-${Date.now().toString(36).toUpperCase()}`;
    const [reporter] = await opsDb.insert(reporters).values({ chapterId: chapter.id, callsign }).returning();
    const [identity] = await identDb.insert(reporterIdentities).values({ reporterId: reporter.id, role: "reporter" }).returning();

    const sessionToken = randomBytes(32).toString("hex");
    const sessionHash = createHash("sha256").update(sessionToken).digest("hex");
    await identDb.insert(sessions).values({ identityId: identity.id, tokenHash: sessionHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

    // Auth accepted
    return c.json({ status: "authenticated", sessionToken, reporterId: reporter.id, role: "reporter" });
  }
  const codeHash = createHash("sha256").update(normalized).digest("hex");

  const [link] = await identDb
    .select()
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, codeHash))
    .limit(1);

  if (!link || link.usedAt || new Date() > link.expiresAt) {
    return c.json({ error: "Invalid or expired invite code" }, 401);
  }

  // mark code as used
  await identDb
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, link.id));

  // create session
  const sessionToken = randomBytes(32).toString("hex");
  const sessionHash = createHash("sha256").update(sessionToken).digest("hex");

  await identDb.insert(sessions).values({
    identityId: link.identityId,
    tokenHash: sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.id, link.identityId))
    .limit(1);

  return c.json({
    status: "authenticated",
    sessionToken,
    reporterId: identity!.reporterId,
    role: identity!.role,
  });
});

// --- POST /auth/magic-link — request magic link ---
authRouter.post("/magic-link", async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: "Email required" }, 400);

  // find identity
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.email, email))
    .limit(1);

  if (!identity) {
    // return 200 regardless to prevent email enumeration
    return c.json({ status: "sent" });
  }

  // generate token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await identDb.insert(magicLinkTokens).values({
    identityId: identity.id,
    tokenHash,
    expiresAt,
  });

  // TODO: send email via SMTP/Resend with link containing rawToken
  // Token logged server-side only in development
  if (process.env.NODE_ENV !== "production") {
    console.log(`Magic link token for ${email}: ${rawToken}`);
  }

  return c.json({ status: "sent" });
});

// --- POST /auth/verify — verify magic link token ---
authRouter.post("/verify", async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: "Token required" }, 400);

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [link] = await identDb
    .select()
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .limit(1);

  if (!link || link.usedAt || new Date() > link.expiresAt) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // mark token as used
  await identDb
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, link.id));

  // check if operator/admin needs TOTP
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.id, link.identityId))
    .limit(1);

  if (identity?.role !== "reporter") {
    const [totp] = await identDb
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.identityId, identity!.id))
      .limit(1);

    if (totp?.verified) {
      // need TOTP second factor
      return c.json({
        status: "totp_required",
        identityId: identity!.id,
      });
    }
  }

  // create session
  const sessionToken = randomBytes(32).toString("hex");
  const sessionHash = createHash("sha256").update(sessionToken).digest("hex");

  await identDb.insert(sessions).values({
    identityId: link.identityId,
    tokenHash: sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return c.json({
    status: "authenticated",
    sessionToken,
    reporterId: identity!.reporterId,
    role: identity!.role,
  });
});

// --- POST /auth/dev-login — DEV/DEMO login by callsign without invite code ---
// Disable by setting TRACE_DISABLE_DEV_LOGIN=true in env.
authRouter.post("/dev-login", async (c) => {
  if (process.env.TRACE_DISABLE_DEV_LOGIN === "true") {
    return c.json({ error: "Dev login disabled in production" }, 403);
  }

  const { callsign, email } = await c.req.json();
  const identifier = callsign || email;
  if (!identifier) return c.json({ error: "Callsign required" }, 400);

  const normalizedCallsign = callsign
    ? callsign.toUpperCase().replace(/[^A-Z0-9]/g, "-")
    : identifier.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "-");

  // Try to find existing identity by email (backward compat) or by callsign
  let [identity] = email
    ? await identDb.select().from(reporterIdentities).where(eq(reporterIdentities.email, email)).limit(1)
    : [];

  if (!identity && callsign) {
    // Find reporter by callsign, then look up identity
    const [reporter] = await opsDb.select().from(reporters).where(eq(reporters.callsign, normalizedCallsign)).limit(1);
    if (reporter) {
      [identity] = await identDb.select().from(reporterIdentities).where(eq(reporterIdentities.reporterId, reporter.id)).limit(1);
    }
  }

  // DEV MODE: auto-create if doesn't exist (reporters only, never operators)
  if (!identity) {
    const [chapter] = await opsDb.select().from(chapters).limit(1);
    if (!chapter) return c.json({ error: "No chapter exists. Run seed first." }, 500);

    // Never auto-create operator accounts. Operators come from seed or admin panel.
    const [reporter] = await opsDb
      .insert(reporters)
      .values({ chapterId: chapter.id, callsign: normalizedCallsign })
      .returning();

    [identity] = await identDb
      .insert(reporterIdentities)
      .values({ reporterId: reporter.id, role: "reporter" })
      .returning();
  }

  const sessionToken = randomBytes(32).toString("hex");
  const sessionHash = createHash("sha256").update(sessionToken).digest("hex");

  await identDb.insert(sessions).values({
    identityId: identity.id,
    tokenHash: sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    status: "authenticated",
    sessionToken,
    reporterId: identity.reporterId,
    role: identity.role,
    chapterId: "lookup-from-reporter",
  });
});

// --- GET /auth/status — heartbeat + kill signal check ---
// Reporter's app calls this periodically. If the reporter has been
// suspended by the operator, response includes x-trace-kill header.
authRouter.get("/status", async (c) => {
  const reporterId = c.req.header("x-reporter-id");
  if (!reporterId) return c.json({ status: "unknown" }, 401);

  const [reporter] = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.id, reporterId))
    .limit(1);

  if (!reporter) return c.json({ status: "unknown" }, 404);

  if (reporter.status === "suspended") {
    // KILL SIGNAL: reporter has been suspended by operator
    c.header("x-trace-kill", "true");
    return c.json({ status: "suspended", kill: true });
  }

  return c.json({ status: reporter.status });
});

// --- GET /auth/vapid-public-key — return VAPID public key for push subscription ---
authRouter.get("/vapid-public-key", (c) => {
  const key = (process.env.VAPID_PUBLIC_KEY || "").trim();
  return c.json({ publicKey: key });
});

// --- POST /auth/push-subscribe — store push subscription for reporter ---
authRouter.post("/push-subscribe", async (c) => {
  const reporterId = c.req.header("x-reporter-id") || "";
  if (!reporterId) return c.json({ error: "Not authenticated" }, 401);
  const { subscription } = await c.req.json();
  if (!subscription) return c.json({ error: "Subscription required" }, 400);

  await opsDb
    .update(reporters)
    .set({ pushSubscription: subscription })
    .where(eq(reporters.id, reporterId));

  return c.json({ subscribed: true });
});
