/**
 * TRACE — Static File Serving
 *
 * Serves the reporter PWA and operator dashboard
 * from the same Hono server.
 *
 * Routes:
 *   /          -> PWA (reporter)
 *   /operator  -> Operator dashboard
 *   /api/v1/*  -> API
 *   /ws        -> WebSocket
 */
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

export function mountStatic(app: Hono) {
  // Operator dashboard (check first - more specific path)
  app.use("/operator/*", serveStatic({
    root: "./operator/dist",
    rewriteRequestPath: (path) => path.replace(/^\/operator/, ""),
  }));
  app.get("/operator", serveStatic({
    root: "./operator/dist",
    path: "/index.html",
  }));

  // Reporter PWA (root)
  app.use("/*", serveStatic({
    root: "./pwa/dist",
  }));
  // PWA fallback for SPA routing
  app.get("*", serveStatic({
    root: "./pwa/dist",
    path: "/index.html",
  }));
}
