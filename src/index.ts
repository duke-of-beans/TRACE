/**
 * TRACE — Server Entry Point
 *
 * Hono HTTP server with WebSocket upgrade for real-time.
 * All routes are chapter-scoped via middleware.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sightingsRouter } from "./api/sightings/index.js";
import { vehiclesRouter } from "./api/vehicles/index.js";
import { actorsRouter } from "./api/actors/index.js";
import { authRouter } from "./api/auth/index.js";
import { adminRouter } from "./api/admin/index.js";
import { closeAll } from "./db/connection.js";

const app = new Hono();

// ---------- Middleware ----------
app.use("*", logger());
app.use("*", cors({
  origin: "*",  // lock down in production
  credentials: true,
}));

// ---------- Health ----------
app.get("/health", (c) => c.json({ status: "ok", service: "trace" }));

// ---------- API Routes ----------
const api = new Hono();
api.route("/sightings", sightingsRouter);
api.route("/vehicles", vehiclesRouter);
api.route("/actors", actorsRouter);
api.route("/auth", authRouter);
api.route("/admin", adminRouter);
app.route("/api/v1", api);

// ---------- Start ----------
const port = parseInt(process.env.PORT || "3100", 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`TRACE server running on http://localhost:${info.port}`);
});

// ---------- Graceful shutdown ----------
async function shutdown() {
  console.log("Shutting down...");
  await closeAll();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
