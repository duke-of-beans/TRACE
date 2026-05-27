/**
 * TRACE — Suspicion Engine
 *
 * Evaluates predicates to determine if a vehicle should be promoted
 * to a higher suspicion level. The core intelligence layer.
 *
 * Predicates are composable: a level can require ANY (OR) or ALL (AND).
 * New predicate types can be added by admins without code changes.
 */
import { opsDb } from "../db/connection.js";
import {
  vehicles, sightings, concernLevels, concernPredicates,
  vehicleConcernHistory, vehicleTypeAssignments, actorVehicles,
} from "../db/schema/vault-a.js";
import { eq, and, gte, count, sql } from "drizzle-orm";

// ---------- Predicate Evaluators ----------

type PredicateConfig = {
  field: string;
  operator: string;
  value: number;
  window_days?: number;
};

type EvalContext = {
  vehicleId: string;
  chapterId: string;
};

async function evalSightingCount(
  config: PredicateConfig,
  ctx: EvalContext
): Promise<boolean> {
  const windowStart = config.window_days
    ? new Date(Date.now() - config.window_days * 86400000)
    : new Date(0);

  const [result] = await opsDb
    .select({ total: count() })
    .from(sightings)
    .where(
      and(
        eq(sightings.vehicleId, ctx.vehicleId),
        gte(sightings.observedAt, windowStart)
      )
    );

  return compare(result.total, config.operator, config.value);
}

async function evalHasDriver(
  _config: PredicateConfig,
  ctx: EvalContext
): Promise<boolean> {
  const [result] = await opsDb
    .select({ total: count() })
    .from(actorVehicles)
    .where(eq(actorVehicles.vehicleId, ctx.vehicleId));
  return result.total > 0;
}

async function evalHasType(
  config: PredicateConfig,
  ctx: EvalContext
): Promise<boolean> {
  const [result] = await opsDb
    .select({ total: count() })
    .from(vehicleTypeAssignments)
    .where(eq(vehicleTypeAssignments.vehicleId, ctx.vehicleId));
  return result.total > 0;
}

async function evalPlateSwapCount(
  config: PredicateConfig,
  ctx: EvalContext
): Promise<boolean> {
  const [vehicle] = await opsDb
    .select({ plateHistory: vehicles.plateHistory })
    .from(vehicles)
    .where(eq(vehicles.id, ctx.vehicleId))
    .limit(1);

  const history = (vehicle?.plateHistory as Array<unknown>) || [];
  return compare(history.length, config.operator, config.value);
}

// Predicate registry - extensible without code changes for DB-defined types
const EVALUATORS: Record<
  string,
  (config: PredicateConfig, ctx: EvalContext) => Promise<boolean>
> = {
  sighting_count: evalSightingCount,
  has_driver: evalHasDriver,
  has_type: evalHasType,
  plate_swap_count: evalPlateSwapCount,
  // manual override is handled separately (not a predicate)
};

function compare(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case ">=": return actual >= expected;
    case ">":  return actual > expected;
    case "<=": return actual <= expected;
    case "<":  return actual < expected;
    case "==": return actual === expected;
    default:   return false;
  }
}

// ---------- Main Engine ----------

/**
 * Evaluate all predicates for a target suspicion level.
 * Returns true if the vehicle qualifies for promotion to that level.
 */
export async function evaluatePredicates(
  vehicleId: string,
  chapterId: string,
  targetLevelId: string
): Promise<{ qualifies: boolean; met: string[]; unmet: string[] }> {
  const predicates = await opsDb
    .select()
    .from(concernPredicates)
    .where(
      and(
        eq(concernPredicates.chapterId, chapterId),
        eq(concernPredicates.targetLevelId, targetLevelId)
      )
    );

  if (predicates.length === 0) return { qualifies: true, met: [], unmet: [] };

  const ctx: EvalContext = { vehicleId, chapterId };
  const met: string[] = [];
  const unmet: string[] = [];

  // check conjunction mode from first predicate (all share same target level)
  const conjunction = predicates[0].conjunction;

  for (const pred of predicates) {
    const evaluator = EVALUATORS[pred.predicateType];
    if (!evaluator) {
      unmet.push(pred.label);
      continue;
    }

    const config = pred.config as PredicateConfig;
    const result = await evaluator(config, ctx);

    if (result) {
      met.push(pred.label);
    } else {
      unmet.push(pred.label);
    }
  }

  const qualifies =
    conjunction === "AND"
      ? unmet.length === 0
      : met.length > 0;

  return { qualifies, met, unmet };
}

/**
 * Attempt to promote a vehicle to a higher suspicion level.
 * Validates predicates, updates vehicle, logs to history.
 */
export async function promoteVehicle(opts: {
  vehicleId: string;
  chapterId: string;
  toLevelId: string;
  reason: string;
  changedBy: string;
  changedByRole: string;
  force?: boolean; // operator manual override
}): Promise<{ success: boolean; error?: string; met?: string[] }> {
  const { vehicleId, chapterId, toLevelId, reason, changedBy, changedByRole, force } = opts;

  // get current level
  const [vehicle] = await opsDb
    .select({ suspicionLevelId: vehicles.suspicionLevelId })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  if (!vehicle) return { success: false, error: "Vehicle not found" };

  // evaluate predicates (skip if manual override)
  let met: string[] = [];
  if (!force) {
    const eval_ = await evaluatePredicates(vehicleId, chapterId, toLevelId);
    if (!eval_.qualifies) {
      return {
        success: false,
        error: `Predicates not met: ${eval_.unmet.join(", ")}`,
      };
    }
    met = eval_.met;
  }

  // update vehicle
  await opsDb
    .update(vehicles)
    .set({ suspicionLevelId: toLevelId, updatedAt: new Date() })
    .where(eq(vehicles.id, vehicleId));

  // log to immutable history
  await opsDb.insert(vehicleConcernHistory).values({
    vehicleId,
    fromLevelId: vehicle.suspicionLevelId,
    toLevelId,
    reason: force ? `[MANUAL] ${reason}` : reason,
    changedBy,
    changedByRole,
    predicatesMet: met,
  });

  return { success: true, met };
}
