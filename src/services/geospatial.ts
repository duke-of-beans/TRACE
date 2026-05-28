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
import { sightings, vehicles, actorVehicles, reporters } from "../db/schema/vault-a.js";
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
  points: Array<{
    lat: number; lng: number;
    vehicleId: string | null; plate: string | null;
    activityDescription: string | null;
    vehicleDescription: string | null;
    locationDescription: string | null;
    direction: string | null;
    observedAt: string;
  }>;
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
      id: sightings.id,
      lat: sightings.lat,
      lng: sightings.lng,
      vehicleId: sightings.vehicleId,
      plate: sightings.plate,
      activityDescription: sightings.activityDescription,
      vehicleDescription: sightings.vehicleDescription,
      locationDescription: sightings.locationDescription,
      direction: sightings.direction,
      observedAt: sightings.observedAt,
      triaged: sightings.triaged,
      reporterCallsign: reporters.callsign,
    })
    .from(sightings)
    .leftJoin(reporters, eq(sightings.reporterId, reporters.id))
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
        id: s.id,
        lat: s.lat!,
        lng: s.lng!,
        vehicleId: s.vehicleId,
        plate: s.plate,
        activityDescription: s.activityDescription,
        vehicleDescription: s.vehicleDescription,
        locationDescription: s.locationDescription,
        direction: s.direction,
        observedAt: s.observedAt.toISOString(),
        triaged: s.triaged,
        reporterCallsign: s.reporterCallsign,
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


// ---------- Vehicle Behavior Report (P5) ----------

export type BehaviorPattern = {
  vehicleId: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  clusters: Array<{
    centerLat: number;
    centerLng: number;
    locationDescription: string | null;
    sightingCount: number;
    dates: string[];
    timeOfDay: Record<string, number>; // "7am-8am": 3
    firstSeen: string;
    lastSeen: string;
  }>;
  totalSightings: number;
};

/**
 * Generate vehicle behavior report for a chapter.
 * Groups sightings by vehicle + location cluster, surfaces time-of-day patterns.
 * Client format: "Vehicle ABC seen on Wilbur Rd 4 times in 2 weeks, 3 times 7-8am"
 */
export async function getBehaviorReport(opts: {
  chapterId: string;
  startDate?: Date;
  endDate?: Date;
  vehicleId?: string;
  clusterRadius?: number; // degrees, default ~200m
}): Promise<BehaviorPattern[]> {
  const { chapterId, clusterRadius = 0.002 } = opts;
  const startDate = opts.startDate || new Date(Date.now() - 14 * 86400000);
  const endDate = opts.endDate || new Date();

  const conditions = [
    eq(sightings.chapterId, chapterId),
    gte(sightings.observedAt, startDate),
    lte(sightings.observedAt, endDate),
  ];
  if (opts.vehicleId) conditions.push(eq(sightings.vehicleId, opts.vehicleId));

  const raw = await opsDb
    .select({
      vehicleId: sightings.vehicleId,
      plate: vehicles.plate,
      make: vehicles.make,
      model: vehicles.model,
      color: vehicles.color,
      lat: sightings.lat,
      lng: sightings.lng,
      locationDescription: sightings.locationDescription,
      observedAt: sightings.observedAt,
    })
    .from(sightings)
    .leftJoin(vehicles, eq(sightings.vehicleId, vehicles.id))
    .where(and(...conditions))
    .orderBy(sightings.observedAt);

  // Group by vehicle
  const byVehicle = new Map<string, typeof raw>();
  for (const s of raw) {
    if (!s.vehicleId || !s.lat) continue;
    const arr = byVehicle.get(s.vehicleId) || [];
    arr.push(s);
    byVehicle.set(s.vehicleId, arr);
  }

  const results: BehaviorPattern[] = [];

  for (const [vehicleId, vehicleSightings] of byVehicle) {
    if (vehicleSightings.length < 2) continue; // need at least 2 sightings for a pattern

    // Cluster sightings by location proximity
    const clusters: Array<{ points: typeof vehicleSightings; centerLat: number; centerLng: number }> = [];

    for (const s of vehicleSightings) {
      let placed = false;
      for (const c of clusters) {
        if (Math.abs(s.lat! - c.centerLat) < clusterRadius && Math.abs(s.lng! - c.centerLng) < clusterRadius) {
          c.points.push(s);
          c.centerLat = c.points.reduce((sum, p) => sum + p.lat!, 0) / c.points.length;
          c.centerLng = c.points.reduce((sum, p) => sum + p.lng!, 0) / c.points.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        clusters.push({ points: [s], centerLat: s.lat!, centerLng: s.lng! });
      }
    }

    // Only include clusters with 2+ sightings
    const significantClusters = clusters.filter(c => c.points.length >= 2);
    if (significantClusters.length === 0) continue;

    const first = vehicleSightings[0];
    results.push({
      vehicleId,
      plate: first.plate || "",
      make: first.make || "",
      model: first.model || "",
      color: first.color || "",
      totalSightings: vehicleSightings.length,
      clusters: significantClusters.map(c => {
        // Time-of-day buckets (hourly)
        const tod: Record<string, number> = {};
        const dates: string[] = [];
        for (const p of c.points) {
          const h = p.observedAt.getHours();
          const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "am" : "pm"}-${(h + 1) === 0 ? 12 : (h + 1) > 12 ? (h + 1) - 12 : h + 1}${(h + 1) < 12 ? "am" : "pm"}`;
          tod[label] = (tod[label] || 0) + 1;
          const dateStr = p.observedAt.toISOString().split("T")[0];
          if (!dates.includes(dateStr)) dates.push(dateStr);
        }
        const sorted = c.points.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
        // Use most common location description
        const descCounts = new Map<string, number>();
        for (const p of c.points) {
          if (p.locationDescription) descCounts.set(p.locationDescription, (descCounts.get(p.locationDescription) || 0) + 1);
        }
        let bestDesc: string | null = null;
        let bestCount = 0;
        for (const [d, cnt] of descCounts) { if (cnt > bestCount) { bestDesc = d; bestCount = cnt; } }

        return {
          centerLat: c.centerLat,
          centerLng: c.centerLng,
          locationDescription: bestDesc,
          sightingCount: c.points.length,
          dates,
          timeOfDay: tod,
          firstSeen: sorted[0].observedAt.toISOString(),
          lastSeen: sorted[sorted.length - 1].observedAt.toISOString(),
        };
      }).sort((a, b) => b.sightingCount - a.sightingCount),
    });
  }

  return results.sort((a, b) => b.totalSightings - a.totalSightings);
}


// ---------- Co-Occurrence Rolling Report (P6) ----------

export type CoOccurrenceReport = {
  vehicleA: { id: string; plate: string; make: string; model: string; color: string };
  vehicleB: { id: string; plate: string; make: string; model: string; color: string };
  encounters: number;
  locations: Array<{ lat: number; lng: number; date: string }>;
  firstSeen: string;
  lastSeen: string;
};

/**
 * Rolling report of vehicle pairs seen together.
 * "Which vehicles are seen together within 2 weeks?"
 */
export async function getCoOccurrenceReport(opts: {
  chapterId: string;
  startDate?: Date;
  endDate?: Date;
  distanceMeters?: number;
  timeWindowMinutes?: number;
}): Promise<CoOccurrenceReport[]> {
  const { chapterId, distanceMeters = 200, timeWindowMinutes = 60 } = opts;
  const startDate = opts.startDate || new Date(Date.now() - 14 * 86400000);
  const endDate = opts.endDate || new Date();
  const degreeThreshold = distanceMeters / 111000;
  const timeThresholdMs = timeWindowMinutes * 60 * 1000;

  const conditions = [
    eq(sightings.chapterId, chapterId),
    gte(sightings.observedAt, startDate),
    lte(sightings.observedAt, endDate),
  ];

  const raw = await opsDb
    .select({
      vehicleId: sightings.vehicleId,
      plate: vehicles.plate,
      make: vehicles.make,
      model: vehicles.model,
      color: vehicles.color,
      lat: sightings.lat,
      lng: sightings.lng,
      observedAt: sightings.observedAt,
    })
    .from(sightings)
    .leftJoin(vehicles, eq(sightings.vehicleId, vehicles.id))
    .where(and(...conditions))
    .orderBy(sightings.observedAt);

  // Find co-occurring pairs
  const pairMap = new Map<string, {
    vehicleA: { id: string; plate: string; make: string; model: string; color: string };
    vehicleB: { id: string; plate: string; make: string; model: string; color: string };
    locations: Array<{ lat: number; lng: number; date: string }>;
  }>();

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!a.vehicleId || !a.lat) continue;

    for (let j = i + 1; j < raw.length; j++) {
      const b = raw[j];
      if (!b.vehicleId || !b.lat) continue;
      if (a.vehicleId === b.vehicleId) continue;

      const timeDiff = Math.abs(a.observedAt.getTime() - b.observedAt.getTime());
      if (timeDiff > timeThresholdMs) {
        if (b.observedAt.getTime() - a.observedAt.getTime() > timeThresholdMs) break;
        continue;
      }

      const latDiff = Math.abs(a.lat - b.lat);
      const lngDiff = Math.abs(a.lng! - b.lng!);
      if (latDiff > degreeThreshold || lngDiff > degreeThreshold) continue;

      const key = [a.vehicleId, b.vehicleId].sort().join(":");
      const existing = pairMap.get(key);
      if (existing) {
        existing.locations.push({ lat: (a.lat + b.lat) / 2, lng: (a.lng! + b.lng!) / 2, date: a.observedAt.toISOString() });
      } else {
        const [idA, idB] = [a.vehicleId, b.vehicleId].sort();
        const infoA = idA === a.vehicleId ? a : b;
        const infoB = idA === a.vehicleId ? b : a;
        pairMap.set(key, {
          vehicleA: { id: idA, plate: infoA.plate || "", make: infoA.make || "", model: infoA.model || "", color: infoA.color || "" },
          vehicleB: { id: idB, plate: infoB.plate || "", make: infoB.make || "", model: infoB.model || "", color: infoB.color || "" },
          locations: [{ lat: (a.lat + b.lat) / 2, lng: (a.lng! + b.lng!) / 2, date: a.observedAt.toISOString() }],
        });
      }
    }
  }

  return Array.from(pairMap.values())
    .filter(p => p.locations.length >= 2) // at least 2 encounters
    .map(p => ({
      ...p,
      encounters: p.locations.length,
      firstSeen: p.locations[0].date,
      lastSeen: p.locations[p.locations.length - 1].date,
    }))
    .sort((a, b) => b.encounters - a.encounters);
}
