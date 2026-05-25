/**
 * TRACE — Static File Serving
 *
 * Serves the reporter PWA and operator dashboard
 * from the same Hono server.
 *
 * Routes:
 *   /operator/* -> Operator dashboard (base: /operator/)
 *   /*          -> PWA (reporter)
 *   /api/v1/*   -> API (handled before static)
 *   /ws         -> WebSocket (handled before static)
 */
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

export function mountStatic(app: Hono) {
  // Operator dashboard assets (must come before PWA catch-all)
  app.use("/operator/*", serveStatic({
    root: "./operator/dist",
    rewriteRequestPath: (path) => path.replace(/^\/operator/, ""),
  }));

  // Reporter PWA
  app.use("/*", serveStatic({ root: "./pwa/dist" }));
}
