/**
 * TRACE — Vercel Serverless Entry Point
 *
 * Wraps the Hono app for Vercel's serverless runtime.
 * WebSocket is not available in serverless — triage updates
 * fall back to polling on the client.
 */
import { handle } from "hono/vercel";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { sightingsRouter } from "../src/api/sightings/index.js";
import { vehiclesRouter } from "../src/api/vehicles/index.js";
import { actorsRouter } from "../src/api/actors/index.js";
import { authRouter } from "../src/api/auth/index.js";
import { adminRouter } from "../src/api/admin/index.js";
import { geoRouter } from "../src/api/geo/index.js";
import { dispatchRouter } from "../src/api/dispatch/index.js";
import { setupRouter } from "../src/api/setup/index.js";
import { tagRouter } from "../src/api/tags/index.js";
import { integrationsRouter } from "../src/api/integrations/index.js";
import { importRouter } from "../src/api/import/index.js";
import { platesRouter } from "../src/api/plates/index.js";
import { harassmentRouter } from "../src/api/harassment/index.js";
import { incidentsRouter, publicIncidentsRouter } from "../src/api/incidents/index.js";
import { authMiddleware, operatorOnly } from "../src/middleware/auth.js";
import { auditMiddleware } from "../src/middleware/audit.js";

export const config = { runtime: "nodejs" };

const app = new Hono().basePath("/api/v1");

// CORS: restrict to known origins in production
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
app.use("*", cors({
  origin: (origin) => {
    if (!origin) return "*";
    if (CORS_ORIGINS.length && CORS_ORIGINS.includes(origin)) return origin;
    if (origin.endsWith(".vercel.app")) return origin;
    if (origin.startsWith("http://localhost")) return origin;
    if (!CORS_ORIGINS.length) return origin;
    return "";
  },
  credentials: true,
}));

// Health
app.get("/health", (c) => c.json({ status: "ok", service: "trace-vercel", version: "1.0.0" }));

// Auth and setup (public)
app.route("/auth", authRouter);
app.route("/setup", setupRouter);

// Public incident form (no auth, token-gated)
app.route("/incidents/public", publicIncidentsRouter);

// Protected routes
app.use("/*", authMiddleware);
app.use("/*", auditMiddleware);

app.route("/sightings", sightingsRouter);
app.route("/vehicles", vehiclesRouter);
app.route("/actors", actorsRouter);
app.route("/geo", geoRouter);
app.route("/dispatch", dispatchRouter);
app.route("/tag-definitions", tagRouter);
app.route("/plates", platesRouter);
app.route("/harassment-reports", harassmentRouter);
app.route("/incidents", incidentsRouter);

// Feedback
app.post("/feedback", async (c) => {
  const { feedback: feedbackTable } = await import("../src/db/schema/vault-a.js");
  const { opsDb } = await import("../src/db/connection.js");
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const reporterId = c.req.header("x-reporter-id") || "";
  const [item] = await opsDb.insert(feedbackTable).values({
    chapterId, reporterId,
    callsign: body.callsign || "",
    type: body.type || "bug",
    title: body.title,
    description: body.description,
    severity: body.severity || "medium",
    page: body.page || "",
    metadata: body.metadata || {},
  }).returning();
  return c.json(item, 201);
});

// Admin + operator-only routes
app.use("/admin/*", operatorOnly);
app.use("/integrations/*", operatorOnly);
app.use("/import/*", operatorOnly);
app.route("/admin", adminRouter);
app.route("/integrations", integrationsRouter);
app.route("/import", importRouter);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
