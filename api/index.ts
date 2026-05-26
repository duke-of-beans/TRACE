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
import { authMiddleware, operatorOnly } from "../src/middleware/auth.js";
import { auditMiddleware } from "../src/middleware/audit.js";

export const config = { runtime: "nodejs" };

const app = new Hono().basePath("/api/v1");

app.use("*", cors({ origin: "*", credentials: true }));

// Health
app.get("/health", (c) => c.json({ status: "ok", service: "trace-vercel" }));

// Auth (public)
app.route("/auth", authRouter);

// Protected routes
app.use("/*", authMiddleware);
app.use("/*", auditMiddleware);

app.route("/sightings", sightingsRouter);
app.route("/vehicles", vehiclesRouter);
app.route("/actors", actorsRouter);
app.route("/geo", geoRouter);

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

// Admin
app.use("/admin/*", operatorOnly);
app.route("/admin", adminRouter);

export default handle(app);
