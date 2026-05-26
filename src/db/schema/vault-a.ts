/**
 * TRACE — Vault A: Operational Schema (pseudonymous)
 *
 * Contains ALL operational data. Zero real identities.
 * A full dump of this schema reveals no reporter names,
 * emails, or phone numbers - by architecture, not policy.
 */
import {
  uuid, text, timestamp, integer, boolean, jsonb,
  real, index, uniqueIndex, varchar, smallint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  ops, id, createdAt, updatedAt,
  reporterStatusEnum, vehicleStatusEnum, actorStatusEnum,
} from "./shared.js";

// ============================================================
// CHAPTERS (multi-tenant)
// ============================================================
export const chapters = ops.table("chapters", {
  id: id(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  config: jsonb("config").default({}),        // chapter-specific settings
  sunsetDays: integer("sunset_days").default(90),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ============================================================
// REPORTERS (pseudonymous — no real identity here)
// ============================================================
export const reporters = ops.table("reporters", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  callsign: varchar("callsign", { length: 64 }).notNull(),
  status: reporterStatusEnum("status").default("active").notNull(),
  pushSubscription: jsonb("push_subscription"),  // web-push endpoint
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("reporters_chapter_callsign").on(t.chapterId, t.callsign),
]);

// ============================================================
// VEHICLE TYPE TAXONOMY (chapter-editable)
// ============================================================
export const vehicleTypes = ops.table("vehicle_types", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 64 }).notNull(),   // Runner, Scout, Stash, Decoy
  description: text("description"),
  color: varchar("color", { length: 7 }),               // hex for map rendering
  icon: varchar("icon", { length: 32 }),                // icon name
  sortOrder: smallint("sort_order").default(0),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("vehicle_types_chapter_label").on(t.chapterId, t.label),
]);

// ============================================================
// SUSPICION LEVELS (chapter-editable ladder)
// ============================================================
export const suspicionLevels = ops.table("suspicion_levels", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 64 }).notNull(),
  rank: smallint("rank").notNull(),                      // 1=lowest, higher=more suspicious
  description: text("description"),
  color: varchar("color", { length: 7 }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("suspicion_levels_chapter_rank").on(t.chapterId, t.rank),
]);

// ============================================================
// SUSPICION PREDICATES (promotion criteria)
// ============================================================
export const suspicionPredicates = ops.table("suspicion_predicates", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  targetLevelId: uuid("target_level_id").notNull().references(() => suspicionLevels.id),
  label: varchar("label", { length: 128 }).notNull(),
  // predicate type: count_based, time_based, flag_based, manual
  predicateType: varchar("predicate_type", { length: 32 }).notNull(),
  // JSON config for the predicate engine
  // e.g. { "field": "sighting_count", "operator": ">=", "value": 3, "window_days": 30 }
  config: jsonb("config").notNull(),
  // AND = all predicates for a level must be met; OR = any one suffices
  conjunction: varchar("conjunction", { length: 3 }).default("OR").notNull(),
  createdAt: createdAt(),
});

// ============================================================
// VEHICLES
// ============================================================
export const vehicles = ops.table("vehicles", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  plate: varchar("plate", { length: 32 }),
  plateHistory: jsonb("plate_history").default([]),       // array of { plate, firstSeen, lastSeen }
  make: varchar("make", { length: 64 }),
  model: varchar("model", { length: 64 }),
  year: smallint("year"),
  color: varchar("color", { length: 32 }),
  description: text("description"),
  photoUrl: text("photo_url"),                             // base64 data URI or external URL
  status: vehicleStatusEnum("status").default("active").notNull(),
  suspicionLevelId: uuid("suspicion_level_id").references(() => suspicionLevels.id),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastSeenLat: real("last_seen_lat"),
  lastSeenLng: real("last_seen_lng"),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("vehicles_chapter_status").on(t.chapterId, t.status),
  index("vehicles_plate").on(t.plate),
  index("vehicles_last_seen").on(t.lastSeenAt),
]);

// ============================================================
// VEHICLE <-> TYPE (many-to-many)
// ============================================================
export const vehicleTypeAssignments = ops.table("vehicle_type_assignments", {
  id: id(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  vehicleTypeId: uuid("vehicle_type_id").notNull().references(() => vehicleTypes.id),
  assignedAt: createdAt(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("vta_vehicle_type_active").on(t.vehicleId, t.vehicleTypeId),
]);

// ============================================================
// SUSPICION HISTORY (immutable audit of level changes)
// ============================================================
export const vehicleSuspicionHistory = ops.table("vehicle_suspicion_history", {
  id: id(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  fromLevelId: uuid("from_level_id").references(() => suspicionLevels.id),
  toLevelId: uuid("to_level_id").notNull().references(() => suspicionLevels.id),
  reason: text("reason").notNull(),                       // justification
  changedBy: uuid("changed_by").notNull(),                // reporter or operator ID
  changedByRole: varchar("changed_by_role", { length: 16 }).notNull(),
  predicatesMet: jsonb("predicates_met").default([]),      // which predicates triggered
  createdAt: createdAt(),
}, (t) => [
  index("vsh_vehicle").on(t.vehicleId),
]);

// ============================================================
// ACTORS (criminal profiles — persistent across vehicle retirements)
// ============================================================
export const actors = ops.table("actors", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  alias: varchar("alias", { length: 128 }),
  physicalDescription: text("physical_description"),
  photoUrl: text("photo_url"),                             // base64 data URI or external URL
  suspicionLevelId: uuid("actor_suspicion_level_id"),     // links to actor_suspicion_levels
  status: actorStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("actors_chapter_status").on(t.chapterId, t.status),
]);

// ============================================================
// ACTOR SUSPICION LEVELS (parallel to vehicle levels, own criteria)
// ============================================================
export const actorSuspicionLevels = ops.table("actor_suspicion_levels", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 64 }).notNull(),
  rank: smallint("rank").notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("actor_susp_levels_chapter_rank").on(t.chapterId, t.rank),
]);

// ============================================================
// ACTOR SUSPICION PREDICATES (behavioral promotion criteria)
// ============================================================
export const actorSuspicionPredicates = ops.table("actor_suspicion_predicates", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  targetLevelId: uuid("target_level_id").notNull().references(() => actorSuspicionLevels.id),
  label: varchar("label", { length: 128 }).notNull(),
  predicateType: varchar("predicate_type", { length: 32 }).notNull(),
  config: jsonb("config").notNull(),
  conjunction: varchar("conjunction", { length: 3 }).default("OR").notNull(),
  createdAt: createdAt(),
});

// ============================================================
// ACTOR SUSPICION HISTORY (immutable audit)
// ============================================================
export const actorSuspicionHistory = ops.table("actor_suspicion_history", {
  id: id(),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  fromLevelId: uuid("from_level_id").references(() => actorSuspicionLevels.id),
  toLevelId: uuid("to_level_id").notNull().references(() => actorSuspicionLevels.id),
  reason: text("reason").notNull(),
  changedBy: uuid("changed_by").notNull(),
  changedByRole: varchar("changed_by_role", { length: 16 }).notNull(),
  predicatesMet: jsonb("predicates_met").default([]),
  createdAt: createdAt(),
}, (t) => [
  index("ash_actor").on(t.actorId),
]);

// ============================================================
// ACTOR IDENTIFIER TYPES (chapter-defined, fully customizable)
// e.g. "Tattoo", "Clothing Pattern", "Scar", "Piercing",
//      "Speech Pattern", "Gait", "Vehicle Preference"
// Each chapter defines what matters for their operation.
// ============================================================
export const actorIdentifierTypes = ops.table("actor_identifier_types", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 64 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 32 }),
  color: varchar("color", { length: 7 }),
  // data type hint for the UI: text, select, multiselect, location
  fieldType: varchar("field_type", { length: 16 }).default("text").notNull(),
  // for select/multiselect: predefined options as JSON array
  // e.g. ["Left arm", "Right arm", "Neck", "Face", "Chest", "Back"]
  options: jsonb("options").default([]),
  sortOrder: smallint("sort_order").default(0),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("ait_chapter_label").on(t.chapterId, t.label),
]);

// ============================================================
// ACTOR IDENTIFIERS (actual values per actor)
// e.g. Actor X has Tattoo: "Dragon on left forearm"
//      Actor X has Clothing: "Always wears red bandana"
// ============================================================
export const actorIdentifiers = ops.table("actor_identifiers", {
  id: id(),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  identifierTypeId: uuid("identifier_type_id").notNull().references(() => actorIdentifierTypes.id),
  value: text("value").notNull(),
  confidence: varchar("confidence", { length: 16 }).default("confirmed"), // confirmed, probable, unverified
  firstObserved: timestamp("first_observed", { withTimezone: true }).defaultNow(),
  lastObserved: timestamp("last_observed", { withTimezone: true }),
  notes: text("notes"),
  reportedBy: uuid("reported_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("ai_actor").on(t.actorId),
  index("ai_type").on(t.identifierTypeId),
]);

export const actorVehicles = ops.table("actor_vehicles", {
  id: id(),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("actor_vehicles_pair").on(t.actorId, t.vehicleId),
]);

export const actorPhotos = ops.table("actor_photos", {
  id: id(),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  evidenceId: uuid("evidence_id"),                        // links to Vault C
  description: text("description"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: createdAt(),
});

// ============================================================
// SIGHTINGS (the core intelligence record)
// ============================================================
export const sightings = ops.table("sightings", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  reporterId: uuid("reporter_id").notNull().references(() => reporters.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  // location
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  locationDescription: text("location_description"),
  // timing
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  // timing jitter applied (±30s for reporter protection)
  jitterApplied: boolean("jitter_applied").default(false),
  // content
  plate: varchar("plate", { length: 32 }),
  vehicleDescription: text("vehicle_description"),
  activityDescription: text("activity_description"),
  direction: varchar("direction", { length: 16 }),         // N, NE, E, SE, etc.
  notes: text("notes"),
  // triage
  triaged: boolean("triaged").default(false),
  triagedBy: uuid("triaged_by"),
  triagedAt: timestamp("triaged_at", { withTimezone: true }),
  // auto plate lookup result
  plateMatched: boolean("plate_matched"),                       // null=not checked, true=matched, false=no match
  matchedVehicleId: uuid("matched_vehicle_id").references(() => vehicles.id),
  // metadata
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("sightings_chapter_submitted").on(t.chapterId, t.submittedAt),
  index("sightings_vehicle").on(t.vehicleId),
  index("sightings_reporter").on(t.reporterId),
  index("sightings_location").on(t.lat, t.lng),
  index("sightings_observed").on(t.observedAt),
]);

// ============================================================
// SIGHTING PHOTOS (1-N per sighting)
// ============================================================
export const sightingPhotos = ops.table("sighting_photos", {
  id: id(),
  sightingId: uuid("sighting_id").notNull().references(() => sightings.id),
  evidenceId: uuid("evidence_id"),                        // links to Vault C
  // EXIF-extracted (GPS preserved, device info stripped)
  exifLat: real("exif_lat"),
  exifLng: real("exif_lng"),
  exifTimestamp: timestamp("exif_timestamp", { withTimezone: true }),
  // thumbnail stored locally, full-res in Vault C
  thumbnailPath: text("thumbnail_path"),
  sortOrder: smallint("sort_order").default(0),
  createdAt: createdAt(),
});

// ============================================================
// NOTIFICATIONS (admin-controlled topology)
// ============================================================
export const notificationChannels = ops.table("notification_channels", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 128 }).notNull(),     // "North sector", "Plate swap alert"
  description: text("description"),
  createdAt: createdAt(),
});

export const notificationRules = ops.table("notification_rules", {
  id: id(),
  channelId: uuid("channel_id").notNull().references(() => notificationChannels.id),
  // trigger config: { event: "new_sighting", conditions: { suspicion_level_gte: 3 } }
  triggerConfig: jsonb("trigger_config").notNull(),
  enabled: boolean("enabled").default(true),
  createdAt: createdAt(),
});

export const notificationSubscriptions = ops.table("notification_subscriptions", {
  id: id(),
  channelId: uuid("channel_id").notNull().references(() => notificationChannels.id),
  reporterId: uuid("reporter_id").notNull().references(() => reporters.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("ns_channel_reporter").on(t.channelId, t.reporterId),
]);

// ============================================================
// AUDIT LOG (immutable, append-only)
// ============================================================
export const auditLog = ops.table("audit_log", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  actorId: uuid("actor_id_ref"),                          // who performed the action (reporter/operator UUID)
  actorRole: varchar("actor_role", { length: 16 }),
  action: varchar("action", { length: 64 }).notNull(),    // e.g. "sighting.create", "vehicle.promote"
  targetType: varchar("target_type", { length: 32 }),     // "vehicle", "sighting", "actor"
  targetId: uuid("target_id"),
  detail: jsonb("detail").default({}),
  ipHash: varchar("ip_hash", { length: 64 }),             // SHA-256 of IP (not raw IP)
  createdAt: createdAt(),
}, (t) => [
  index("audit_log_chapter_created").on(t.chapterId, t.createdAt),
  index("audit_log_target").on(t.targetType, t.targetId),
]);

// ============================================================
// FEEDBACK (bug reports, feature requests — semi-public)
// ============================================================
export const feedback = ops.table("feedback", {
  id: id(),
  chapterId: uuid("chapter_id").references(() => chapters.id),
  reporterId: uuid("reporter_id"),
  callsign: varchar("callsign", { length: 64 }),
  type: varchar("type", { length: 16 }).notNull().default("bug"),    // bug | feature | other
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 16 }).default("medium"),   // low | medium | high | critical
  page: varchar("page", { length: 128 }),                            // route where submitted
  metadata: jsonb("metadata").default({}),                            // device info, errors
  status: varchar("status", { length: 16 }).default("open"),         // open | acknowledged | resolved | closed
  operatorNotes: text("operator_notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("feedback_chapter_status").on(t.chapterId, t.status),
]);

// ============================================================
// DISPATCH EVENT TYPES (chapter-configurable)
// e.g. "Confirmed Vehicle", "Community Report", "Area Check"
// ============================================================
export const dispatchEventTypes = ops.table("dispatch_event_types", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 64 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 32 }).default("alert-triangle"),
  color: varchar("color", { length: 7 }).default("#D97706"),
  defaultPriority: varchar("default_priority", { length: 16 }).default("routine").notNull(),
  autoCloseHours: smallint("auto_close_hours").default(4),
  sortOrder: smallint("sort_order").default(0),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("det_chapter_label").on(t.chapterId, t.label),
]);

// ============================================================
// DISPATCH EVENTS (the core dispatch record)
// Created from triage (sighting-triggered) or from map (community call)
// ============================================================
export const dispatchEvents = ops.table("dispatch_events", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  sightingId: uuid("sighting_id").references(() => sightings.id),
  eventTypeId: uuid("event_type_id").references(() => dispatchEventTypes.id),
  // location
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  locationDescription: text("location_description"),
  // details
  plate: varchar("plate", { length: 32 }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  notes: text("notes"),
  source: varchar("source", { length: 16 }).default("sighting").notNull(), // sighting, community_call, operator
  priority: varchar("priority", { length: 16 }).default("routine").notNull(), // urgent, routine, info
  status: varchar("status", { length: 16 }).default("open").notNull(), // open, responding, on_scene, closed, expired
  // lifecycle
  createdBy: uuid("created_by"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closeReason: varchar("close_reason", { length: 32 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("dispatch_events_chapter_status").on(t.chapterId, t.status),
  index("dispatch_events_created").on(t.createdAt),
]);

// ============================================================
// DISPATCH ASSIGNMENTS (who was dispatched)
// ============================================================
export const dispatchAssignments = ops.table("dispatch_assignments", {
  id: id(),
  dispatchEventId: uuid("dispatch_event_id").notNull().references(() => dispatchEvents.id),
  reporterId: uuid("reporter_id").notNull().references(() => reporters.id),
  status: varchar("status", { length: 16 }).default("assigned").notNull(), // assigned, responding, on_scene, completed, declined
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(),
}, (t) => [
  index("da_dispatch").on(t.dispatchEventId),
  index("da_reporter").on(t.reporterId),
  uniqueIndex("da_dispatch_reporter").on(t.dispatchEventId, t.reporterId),
]);

// ============================================================
// DISPATCH OUTCOMES (what happened when patroller arrived)
// ============================================================
export const dispatchOutcomes = ops.table("dispatch_outcomes", {
  id: id(),
  dispatchEventId: uuid("dispatch_event_id").notNull().references(() => dispatchEvents.id),
  reporterId: uuid("reporter_id").notNull().references(() => reporters.id),
  sightingId: uuid("sighting_id").references(() => sightings.id),
  outcome: varchar("outcome", { length: 16 }).notNull(), // confirmed, not_found, suspect_fled, false_alarm, other
  notes: text("notes"),
  createdAt: createdAt(),
}, (t) => [
  index("do_dispatch").on(t.dispatchEventId),
]);

// ============================================================
// SIGHTING FEEDBACK (pushed back to the original reporter)
// "Confirmed, patrollers dispatched" or "Not in database, disregard"
// ============================================================
export const sightingFeedback = ops.table("sighting_feedback", {
  id: id(),
  sightingId: uuid("sighting_id").notNull().references(() => sightings.id),
  reporterId: uuid("reporter_id").notNull().references(() => reporters.id),
  feedbackType: varchar("feedback_type", { length: 16 }).notNull(), // confirmed, dismissed, info
  message: text("message").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("sf_sighting").on(t.sightingId),
  index("sf_reporter").on(t.reporterId),
]);
