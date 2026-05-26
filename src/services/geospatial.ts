/**
 * TRACE — Geospatial Intelligence Service
 *
 * Area heatmaps, vehicle corridor visualization, temporal layers,
 * co-occurrence zones, driver territory mapping.
 *
 * All computations happen server-side; the operator dashboard
 * receives pre-computed data for Leaflet rendering.
 */
import { opsDb } from "../db/connection.js";
import { sightings, vehicles, actorVehicles } from "../db/schema/vault-a.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// ---------- Heatmap ----------

export type HeatmapPoint = {
  lat: number;
  lng: number;
  weight: number; // sighting density
};

/**
 * Generate heatmap data for a chapter within a time window.
 * Groups sightings into grid cells and returns weighted points.
 */
export async function getHeatmapData(opts: {
  chapterId: string;
  startDate?: Date;
  endDate?: Date;
  gridSize?: number; // degrees, default 0.001 (~100m)
  vehicleId?: string;
}): Promise<HeatmapPoint[]> {
  const { chapterId, gridSize = 0.001 } = opts;
  const startDate = opts.startDate || new Date(0);
  const endDate = opts.endDate || new Date();

  const conditions = [
    eq(sightings.chapterId, chapterId),
    gte(sightings.observedAt, startDate),
    lte(sightings.observedAt, endDate),
  ];
  if (opts.vehicleId) conditions.push(eq(sightings.vehicleId, opts.vehicleId));

  const raw = await opsDb
    .select({ lat: sightings.lat, lng: sightings.lng })
    .from(sightings)
    .where(and(...conditions));

  // aggregate into grid cells
  const grid = new Map<string, { lat: number; lng: number; count: number }>();

  for (const point of raw) {
    if (!point.lat || !point.lng) continue;
    const gridLat = Math.round(point.lat / gridSize) * gridSize;
    const gridLng = Math.round(point.lng / gridSize) * gridSize;
    const key = `${gridLat}:${gridLng}`;

    const cell = grid.get(key) || { lat: gridLat, lng: gridLng, count: 0 };
    cell.count++;
    grid.set(key, cell);
  }

  // normalize weights (0-1)
  const maxCount = Math.max(...Array.from(grid.values()).map((c) => c.count), 1);
  return Array.from(grid.values()).map((cell) => ({
    lat: cell.lat,
    lng: cell.lng,
    weight: cell.count / maxCount,
  }));
}

// ---------- Vehicle Corridors ----------

export type CorridorSegment = {
  from: { lat: number; lng: number; observedAt: string };
  to: { lat: number; lng: number; observedAt: string };
};

/**
 * Generate corridor data for a specific vehicle.
 * Tries vehicleId first, falls back to plate matching.
 */
export async function getVehicleCorridor(
  vehicleId: string
): Promise<CorridorSegment[]> {
  // First try by vehicleId
  let points = await opsDb
    .select({
      lat: sightings.lat,
      lng: sightings.lng,
      observedAt: sightings.observedAt,
    })
    .from(sightings)
    .where(eq(sightings.vehicleId, vehicleId))
    .orderBy(sightings.observedAt);

  // If no results, try by plate matching (look up the vehicle's plate first)
  if (points.length === 0) {
    const [vehicle] = await opsDb.select({ plate: vehicles.plate }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (vehicle?.plate) {
      points = await opsDb
        .select({
          lat: sightings.lat,
          lng: sightings.lng,
          observedAt: sightings.observedAt,
        })
        .from(sightings)
        .where(eq(sightings.plate, vehicle.plate))
        .orderBy(sightings.observedAt);
    }
  }

  const segments: CorridorSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    if (!points[i - 1].lat || !points[i].lat) continue;
    segments.push({
      from: {
        lat: points[i - 1].lat!,
        lng: points[i - 1].lng!,
        observedAt: points[i - 1].observedAt.toISOString(),
      },
      to: {
        lat: points[i].lat!,
        lng: points[i].lng!,
        observedAt: points[i].observedAt.toISOString(),
      },
    });
  }

  return segments;
}

// ---------- Co-Occurrence Zones ----------

export type CoOccurrence = {
  vehicleA: string;
  vehicleB: string;
  lat: number;
  lng: number;
  count: number;
  timeWindowMinutes: number;
};

/**
 * Find locations where two or more vehicles have been seen
 * within a time and distance window. Indicates coordination.
 */
export async function getCoOccurrences(opts: {
  chapterId: string;
  distanceMeters?: number;  // default 200m
  timeWindowMinutes?: number; // default 60 min
  startDate?: Date;
  endDate?: Date;
}): Promise<CoOccurrence[]> {
  const { chapterId, distanceMeters = 200, timeWindowMinutes = 60 } = opts;

  // approximate degree distance (rough: 1 degree ~ 111km at equator)
  const degreeThreshold = distanceMeters / 111000;
  const timeThresholdMs = timeWindowMinutes * 60 * 1000;

  const conditions = [eq(sightings.chapterId, chapterId)];
  if (opts.startDate) conditions.push(gte(sightings.observedAt, opts.startDate));
  if (opts.endDate) conditions.push(lte(sightings.observedAt, opts.endDate));

  const allSightings = await opsDb
    .select({
      vehicleId: sightings.vehicleId,
      lat: sightings.lat,
      lng: sightings.lng,
      observedAt: sightings.observedAt,
    })
    .from(sightings)
    .where(and(...conditions))
    .orderBy(sightings.observedAt);

  const coOccurrences: CoOccurrence[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < allSightings.length; i++) {
    const a = allSightings[i];
    if (!a.vehicleId || !a.lat) continue;

    for (let j = i + 1; j < allSightings.length; j++) {
      const b = allSightings[j];
      if (!b.vehicleId || !b.lat) continue;
      if (a.vehicleId === b.vehicleId) continue;

      // time check
      const timeDiff = Math.abs(a.observedAt.getTime() - b.observedAt.getTime());
      if (timeDiff > timeThresholdMs) continue;

      // distance check
      const latDiff = Math.abs(a.lat - b.lat);
      const lngDiff = Math.abs(a.lng! - b.lng!);
      if (latDiff > degreeThreshold || lngDiff > degreeThreshold) continue;

      const key = [a.vehicleId, b.vehicleId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      coOccurrences.push({
        vehicleA: a.vehicleId,
        vehicleB: b.vehicleId,
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng! + b.lng!) / 2,
        count: 1,
        timeWindowMinutes,
      });
    }
  }

  return coOccurrences;
}

// ---------- Temporal Layer (time slider) ----------

export type TemporalBucket = {
  startTime: string;
  endTime: string;
  points: Array<{ lat: number; lng: number; vehicleId: string | null; plate: string | null; activityDescription: string | null; observedAt: string }>;
};

/**
 * Bucket sightings into time intervals for a slider visualization.
 * Default: 1-hour buckets.
 */
export async function getTemporalData(opts: {
  chapterId: string;
  startDate: Date;
  endDate: Date;
  bucketMinutes?: number;
  vehicleId?: string;
}): Promise<TemporalBucket[]> {
  const { chapterId, startDate, endDate, bucketMinutes = 60 } = opts;

  const conditions = [
    eq(sightings.chapterId, chapterId),
    gte(sightings.observedAt, startDate),
    lte(sightings.observedAt, endDate),
  ];
  if (opts.vehicleId) conditions.push(eq(sightings.vehicleId, opts.vehicleId));

  const allSightings = await opsDb
    .select({
      lat: sightings.lat,
      lng: sightings.lng,
      vehicleId: sightings.vehicleId,
      plate: sightings.plate,
      activityDescription: sightings.activityDescription,
      observedAt: sightings.observedAt,
    })
    .from(sightings)
    .where(and(...conditions))
    .orderBy(sightings.observedAt);

  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets: TemporalBucket[] = [];
  let currentStart = new Date(startDate);

  while (currentStart < endDate) {
    const currentEnd = new Date(currentStart.getTime() + bucketMs);
    const points = allSightings
      .filter((s) => s.observedAt >= currentStart && s.observedAt < currentEnd && s.lat)
      .map((s) => ({
        lat: s.lat!,
        lng: s.lng!,
        vehicleId: s.vehicleId,
        plate: s.plate,
        activityDescription: s.activityDescription,
        observedAt: s.observedAt.toISOString(),
      }));

    if (points.length > 0) {
      buckets.push({
        startTime: currentStart.toISOString(),
        endTime: currentEnd.toISOString(),
        points,
      });
    }

    currentStart = currentEnd;
  }

  return buckets;
}

// ---------- Driver Territory ----------

/**
 * Get territory data for an actor (all sighting locations
 * across all vehicles linked to this actor).
 */
export async function getActorTerritory(actorId: string): Promise<Array<{
  lat: number;
  lng: number;
  vehicleId: string;
  observedAt: string;
}>> {
  // get all vehicles linked to this actor
  const links = await opsDb
    .select({ vehicleId: actorVehicles.vehicleId })
    .from(actorVehicles)
    .where(eq(actorVehicles.actorId, actorId));

  const points: Array<{ lat: number; lng: number; vehicleId: string; observedAt: string }> = [];

  for (const link of links) {
    const vehicleSightings = await opsDb
      .select({
        lat: sightings.lat,
        lng: sightings.lng,
        observedAt: sightings.observedAt,
      })
      .from(sightings)
      .where(eq(sightings.vehicleId, link.vehicleId))
      .orderBy(sightings.observedAt);

    for (const s of vehicleSightings) {
      if (!s.lat) continue;
      points.push({
        lat: s.lat,
        lng: s.lng!,
        vehicleId: link.vehicleId,
        observedAt: s.observedAt.toISOString(),
      });
    }
  }

  return points;
}
