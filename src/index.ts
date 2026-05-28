/**
 * TRACE — Server Entry Point
 *
 * Hono HTTP server with WebSocket upgrade for real-time.
 * All routes are chapter-scoped via middleware.
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sightingsRouter } from "./api/sightings/index.js";
import { vehiclesRouter } from "./api/vehicles/index.js";
import { actorsRouter } from "./api/actors/index.js";
import { authRouter } from "./api/auth/index.js";
import { adminRouter } from "./api/admin/index.js";
import { geoRouter } from "./api/geo/index.js";
import { dispatchRouter } from "./api/dispatch/index.js";
import { setupRouter } from "./api/setup/index.js";
import { tagRouter } from "./api/tags/index.js";
import { integrationsRouter } from "./api/integrations/index.js";
import { importRouter } from "./api/import/index.js";
import { platesRouter } from "./api/plates/index.js";
import { harassmentRouter } from "./api/harassment/index.js";
import { incidentsRouter, publicIncidentsRouter } from "./api/incidents/index.js";
import { vehicleGroupsRouter } from "./api/vehicle-groups/index.js";
import { watchpointsRouter } from "./api/watchpoints/index.js";
import { closeAll } from "./db/connection.js";
import { authMiddleware, operatorOnly, adminOnly } from "./middleware/auth.js";
import { auditMiddleware } from "./middleware/audit.js";
import { runSunsetCheck } from "./services/vehicle-sunset.js";
import { addClient, removeClient, getClientCount } from "./services/realtime.js";
import { mountStatic } from "./static.js";
import { nanoid } from "nanoid";

const app = new Hono();

// ---------- Middleware ----------
app.use("*", logger());

// CORS: restrict to known origins in production
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
app.use("*", cors({
  origin: (origin) => {
    if (!origin) return "*"; // allow non-browser requests (cURL, Postman)
    if (CORS_ORIGINS.length && CORS_ORIGINS.includes(origin)) return origin;
    if (origin.endsWith(".vercel.app")) return origin; // all Vercel preview deploys
    if (origin.startsWith("http://localhost")) return origin; // local dev
    if (!CORS_ORIGINS.length) return origin; // no config = allow all (dev mode)
    return ""; // reject
  },
  credentials: true,
}));

// ---------- Health ----------
app.get("/health", (c) => c.json({
  status: "ok",
  service: "trace",
  version: "1.0.0",
  wsClients: getClientCount(),
}));

// ---------- WebSocket ----------
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/ws", upgradeWebSocket((c) => {
  const clientId = nanoid();
  return {
    onOpen(_evt, ws) {
      // client sends auth + chapter info in first message
      console.log(`WS connection opened: ${clientId}`);
    },
    onMessage(evt, ws) {
      try {
        const msg = JSON.parse(String(evt.data));
        if (msg.type === "auth") {
          addClient({
            id: clientId,
            chapterId: msg.chapterId || "",
            role: msg.role || "reporter",
            send: (data) => ws.send(data),
          });
        }
      } catch {}
    },
    onClose() {
      removeClient(clientId);
    },
  };
}));

// ---------- API Routes ----------
const api = new Hono();

// Auth and setup routes are public
api.route("/auth", authRouter);
api.route("/setup", setupRouter);

// Public incident form (no auth, token-gated)
api.route("/incidents/public", publicIncidentsRouter);

// All other routes require authentication
api.use("/*", authMiddleware);
api.use("/*", auditMiddleware);

api.route("/sightings", sightingsRouter);
api.route("/vehicles", vehiclesRouter);
api.route("/actors", actorsRouter);
api.route("/geo", geoRouter);
api.route("/dispatch", dispatchRouter);
api.route("/tag-definitions", tagRouter);
api.route("/plates", platesRouter);
api.route("/harassment-reports", harassmentRouter);
api.route("/incidents", incidentsRouter);
api.route("/vehicle-groups", vehicleGroupsRouter);
api.route("/watchpoints", watchpointsRouter);

// Feedback — any authenticated user can submit
api.post("/feedback", async (c) => {
  const { feedback: feedbackTable } = await import("./db/schema/vault-a.js");
  const { opsDb } = await import("./db/connection.js");
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

// Admin routes require operator or admin role
api.use("/admin/*", operatorOnly);
api.use("/integrations/*", operatorOnly);
api.use("/import/*", operatorOnly);
api.route("/admin", adminRouter);
api.route("/integrations", integrationsRouter);
api.route("/import", importRouter);

app.route("/api/v1", api);

// ---------- Static Files (PWA + Operator) ----------
mountStatic(app);

// ---------- Scheduled Tasks ----------
// Vehicle sunset check - runs every hour
const SUNSET_INTERVAL_MS = 60 * 60 * 1000;
setInterval(async () => {
  try {
    const result = await runSunsetCheck();
    if (result.vehiclesRetired > 0) {
      console.log(`Sunset: retired ${result.vehiclesRetired} vehicles`);
    }
  } catch (err) {
    console.error("Sunset check failed:", err);
  }
}, SUNSET_INTERVAL_MS);

// ---------- Start ----------
const port = parseInt(process.env.PORT || "3100", 10);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`TRACE server running on http://localhost:${info.port}`);
});
injectWebSocket(server);

// ---------- Graceful shutdown ----------
async function shutdown() {
  console.log("Shutting down...");
  await closeAll();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
