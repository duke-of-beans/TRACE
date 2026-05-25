/**
 * TRACE API — Auth
 *
 * Magic link (no passwords) for reporters.
 * TOTP second factor for operator/admin.
 * All identity operations hit Vault B only.
 */
import { Hono } from "hono";
import { z } from "zod";
import { identDb } from "../../db/connection.js";
import {
  reporterIdentities, magicLinkTokens, sessions, totpSecrets,
} from "../../db/schema/vault-b.js";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

export const authRouter = new Hono();

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
  console.log(`Magic link token for ${email}: ${rawToken}`);

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
