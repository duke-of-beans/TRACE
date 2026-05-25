/**
 * TRACE API — Admin
 *
 * Chapter configuration, reporter management,
 * notification topology, vehicle type/suspicion ladder CRUD.
 * All admin-only endpoints.
 */
import { Hono } from "hono";
import { opsDb, identDb } from "../../db/connection.js";
import {
  chapters, vehicleTypes, suspicionLevels, suspicionPredicates,
  actorRiskLevels, notificationChannels, notificationRules,
  reporters,
} from "../../db/schema/vault-a.js";
import { reporterIdentities } from "../../db/schema/vault-b.js";
import { eq } from "drizzle-orm";

export const adminRouter = new Hono();

// TODO: admin auth middleware (role check)

// --- GET /admin/chapter ---
adminRouter.get("/chapter", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const [chapter] = await opsDb.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return c.json(chapter || { error: "Not found" });
});

// --- CRUD: Vehicle Types ---
adminRouter.get("/vehicle-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(vehicleTypes).where(eq(vehicleTypes.chapterId, chapterId));
  return c.json(types);
});

adminRouter.post("/vehicle-types", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [vt] = await opsDb.insert(vehicleTypes).values({ chapterId, ...body }).returning();
  return c.json(vt, 201);
});

// --- CRUD: Suspicion Levels ---
adminRouter.get("/suspicion-levels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const levels = await opsDb.select().from(suspicionLevels).where(eq(suspicionLevels.chapterId, chapterId));
  return c.json(levels);
});

// --- CRUD: Reporters (invite/deactivate) ---
adminRouter.post("/reporters/invite", async (c) => {
  const { callsign, email, realName, phone } = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";

  // Vault A: create pseudonymous reporter
  const [reporter] = await opsDb
    .insert(reporters)
    .values({ chapterId, callsign })
    .returning();

  // Vault B: create identity (cross-vault link via reporterId)
  await identDb.insert(reporterIdentities).values({
    reporterId: reporter.id,
    realName,
    email,
    phone,
    role: "reporter",
  });

  // TODO: send magic link to email for first login
  return c.json({ reporterId: reporter.id, callsign }, 201);
});

// --- Notification Channels ---
adminRouter.get("/notifications/channels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const channels = await opsDb
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.chapterId, chapterId));
  return c.json(channels);
});

adminRouter.post("/notifications/channels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [ch] = await opsDb
    .insert(notificationChannels)
    .values({ chapterId, ...body })
    .returning();
  return c.json(ch, 201);
});
