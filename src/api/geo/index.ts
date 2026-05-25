/**
 * TRACE API — Geospatial Intelligence
 *
 * Heatmaps, corridors, co-occurrence zones, temporal data.
 * Operator-only endpoints.
 */
import { Hono } from "hono";
import {
  getHeatmapData,
  getVehicleCorridor,
  getCoOccurrences,
  getTemporalData,
  getActorTerritory,
} from "../../services/geospatial.js";

export const geoRouter = new Hono();

// --- GET /geo/heatmap ---
geoRouter.get("/heatmap", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const start = c.req.query("start");
  const end = c.req.query("end");
  const data = await getHeatmapData({
    chapterId,
    startDate: start ? new Date(start) : undefined,
    endDate: end ? new Date(end) : undefined,
  });
  return c.json(data);
});

// --- GET /geo/corridor/:vehicleId ---
geoRouter.get("/corridor/:vehicleId", async (c) => {
  const data = await getVehicleCorridor(c.req.param("vehicleId"));
  return c.json(data);
});

// --- GET /geo/co-occurrence ---
geoRouter.get("/co-occurrence", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const data = await getCoOccurrences({
    chapterId,
    distanceMeters: parseInt(c.req.query("distance") || "200"),
    timeWindowMinutes: parseInt(c.req.query("timeWindow") || "60"),
  });
  return c.json(data);
});

// --- GET /geo/temporal ---
geoRouter.get("/temporal", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const start = c.req.query("start") || new Date(Date.now() - 7 * 86400000).toISOString();
  const end = c.req.query("end") || new Date().toISOString();
  const data = await getTemporalData({
    chapterId,
    startDate: new Date(start),
    endDate: new Date(end),
    bucketMinutes: parseInt(c.req.query("bucket") || "60"),
  });
  return c.json(data);
});

// --- GET /geo/territory/:actorId ---
geoRouter.get("/territory/:actorId", async (c) => {
  const data = await getActorTerritory(c.req.param("actorId"));
  return c.json(data);
});
