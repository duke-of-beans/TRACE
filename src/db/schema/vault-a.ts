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
  incidentStatusEnum, incidentSeverityEnum, evidencePhaseEnum,
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
export const concernLevels = ops.table("suspicion_levels", {
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
export const concernPredicates = ops.table("suspicion_predicates", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  targetLevelId: uuid("target_level_id").notNull().references(() => concernLevels.id),
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
  suspicionLevelId: uuid("suspicion_level_id").references(() => concernLevels.id),
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
export const vehicleConcernHistory = ops.table("vehicle_suspicion_history", {
  id: id(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  fromLevelId: uuid("from_level_id").references(() => concernLevels.id),
  toLevelId: uuid("to_level_id").notNull().references(() => concernLevels.id),
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
export const actorConcernLevels = ops.table("actor_suspicion_levels", {
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
export const actorConcernPredicates = ops.table("actor_suspicion_predicates", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  targetLevelId: uuid("target_level_id").notNull().references(() => actorConcernLevels.id),
  label: varchar("label", { length: 128 }).notNull(),
  predicateType: varchar("predicate_type", { length: 32 }).notNull(),
  config: jsonb("config").notNull(),
  conjunction: varchar("conjunction", { length: 3 }).default("OR").notNull(),
  createdAt: createdAt(),
});

// ============================================================
// ACTOR SUSPICION HISTORY (immutable audit)
// ============================================================
export const actorConcernHistory = ops.table("actor_suspicion_history", {
  id: id(),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  fromLevelId: uuid("from_level_id").references(() => actorConcernLevels.id),
  toLevelId: uuid("to_level_id").notNull().references(() => actorConcernLevels.id),
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
  // operator feedback (tag + response pushed back to reporter)
  operatorTag: varchar("operator_tag", { length: 60 }),
  operatorResponse: varchar("operator_response", { length: 280 }),
  operatorRespondedAt: timestamp("operator_responded_at", { withTimezone: true }),
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
  // base64-encoded photo data (MVP: stored in DB; production: move to object storage)
  photoData: text("photo_data"),
  mimeType: varchar("mime_type", { length: 32 }).default("image/jpeg"),
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

// ============================================================
// TAG DEFINITIONS (chapter-configurable, context-scoped)
// Contexts: sighting, vehicle, harassment
// ============================================================
export const tagDefinitions = ops.table("tag_definitions", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  context: varchar("context", { length: 20 }).notNull(),   // sighting | vehicle | harassment
  label: varchar("label", { length: 60 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#818CF8"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("tag_defs_chapter_context_label").on(t.chapterId, t.context, t.label),
]);

// ============================================================
// KNOWN NUMBERS (phone number entities — parallel to vehicles)
// Each number is a first-class entity with its own record.
// Multiple reporters can report the same number.
// ============================================================
export const knownNumbers = ops.table("known_numbers", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  operatorTag: varchar("operator_tag", { length: 60 }),
  operatorNotes: text("operator_notes"),
  operatorResponse: varchar("operator_response", { length: 280 }),  // visible to reporters
  spokeoResult: jsonb("spokeo_result"),                              // full cached API response
  spokeoLookupAt: timestamp("spokeo_lookup_at", { withTimezone: true }),
  reportCount: integer("report_count").notNull().default(0),
  reportersAffected: integer("reporters_affected").notNull().default(0),
  firstReportedAt: timestamp("first_reported_at", { withTimezone: true }),
  lastReportedAt: timestamp("last_reported_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | resolved | escalated | reported_to_le
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("known_numbers_chapter_phone").on(t.chapterId, t.phoneNumber),
  index("known_numbers_chapter").on(t.chapterId),
  index("known_numbers_phone").on(t.phoneNumber),
]);

// ============================================================
// HARASSMENT REPORTS (individual incidents linked to known_numbers)
// Each report references a phone number entity.
// Cross-reporter correlation is the key intelligence value.
// ============================================================
export const harassmentReports = ops.table("harassment_reports", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  knownNumberId: uuid("known_number_id").references(() => knownNumbers.id),
  reporterId: uuid("reporter_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  incidentType: varchar("incident_type", { length: 20 }).notNull(), // call | text | voicemail | in_person | other
  description: text("description"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  evidenceRefs: jsonb("evidence_refs").default([]),   // [{type, key, size}]
  operatorTag: varchar("operator_tag", { length: 60 }),
  operatorResponse: varchar("operator_response", { length: 280 }),
  operatorRespondedAt: timestamp("operator_responded_at", { withTimezone: true }),
  lookupResult: jsonb("lookup_result"),               // cached Spokeo response
  lookupAt: timestamp("lookup_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | reviewed | escalated
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("harassment_chapter").on(t.chapterId),
  index("harassment_reporter").on(t.reporterId),
  index("harassment_phone").on(t.phoneNumber),
  index("harassment_status").on(t.status),
  index("harassment_known_number").on(t.knownNumberId),
]);

// ============================================================
// INTEGRATION CONFIG (API key storage for external services)
// Keys encrypted at rest. Never sent to client.
// ============================================================
export const integrationConfig = ops.table("integration_config", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  serviceName: varchar("service_name", { length: 40 }).notNull(), // carapi | spokeo | bumper
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestResult: varchar("last_test_result", { length: 20 }), // success | auth_failed | error
  lookupsThisMonth: integer("lookups_this_month").notNull().default(0),
  monthResetAt: timestamp("month_reset_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("integration_chapter_service").on(t.chapterId, t.serviceName),
]);

// ============================================================
// VEHICLE ENRICHMENTS (cached API responses for plate lookups)
// CarAPI, Bumper, or manual entry. Expires after 30 days.
// ============================================================
export const vehicleEnrichments = ops.table("vehicle_enrichments", {
  id: id(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  source: varchar("source", { length: 20 }).notNull(),  // carapi | bumper | manual
  vin: varchar("vin", { length: 17 }),
  year: integer("year"),
  make: varchar("make", { length: 60 }),
  model: varchar("model", { length: 60 }),
  trim: varchar("trim", { length: 60 }),
  color: varchar("color", { length: 30 }),
  bodyType: varchar("body_type", { length: 30 }),
  rawResponse: jsonb("raw_response"),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("enrichment_vehicle").on(t.vehicleId),
]);

// ============================================================
// INCIDENT TYPES (chapter-configurable taxonomy)
// Same pattern as vehicleTypes/dispatchEventTypes.
// ============================================================
export const incidentTypes = ops.table("incident_types", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  label: varchar("label", { length: 64 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 32 }).default("alert-triangle"),
  color: varchar("color", { length: 7 }).default("#EF4444"),
  sortOrder: smallint("sort_order").default(0),
  defaultPriority: varchar("default_priority", { length: 16 }).default("elevated").notNull(),
  autoDispatch: boolean("auto_dispatch").default(false),
  requiresFields: jsonb("requires_fields").default([]),       // JSON array of extra required fields
  notificationRule: varchar("notification_rule", { length: 32 }).default("standard"),
  lawEnforcementFlag: boolean("law_enforcement_flag").default(false),
  evidenceRequired: boolean("evidence_required").default(false),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("incident_types_chapter_label").on(t.chapterId, t.label),
]);

// ============================================================
// INCIDENTS (the core incident record)
// Parallel to sightings but for documenting harm.
// Accumulates evidence over days/weeks until closed.
// ============================================================
export const incidents = ops.table("incidents", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  incidentTypeId: uuid("incident_type_id").references(() => incidentTypes.id),
  reporterId: uuid("reporter_id").references(() => reporters.id),        // who filed it
  filedOnBehalfOf: text("filed_on_behalf_of"),                            // verbal report source
  // location
  lat: real("lat"),
  lng: real("lng"),
  locationDescription: text("location_description"),
  // timing
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  // content
  title: varchar("title", { length: 256 }),
  description: text("description"),
  // lifecycle
  status: incidentStatusEnum("status").default("open").notNull(),
  severity: incidentSeverityEnum("severity").default("elevated").notNull(),
  // operator fields
  operatorNotes: text("operator_notes"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: uuid("closed_by"),
  closeReason: varchar("close_reason", { length: 64 }),
  // public form support
  publicToken: varchar("public_token", { length: 64 }),                   // shareable link token
  publicTokenExpiresAt: timestamp("public_token_expires_at", { withTimezone: true }),
  publicSubmissionCount: integer("public_submission_count").default(0),
  submittedViaPublic: boolean("submitted_via_public").default(false),
  publicContactInfo: text("public_contact_info"),                          // optional contact from public form
  // linked sighting (a sighting can be part of an incident)
  linkedSightingId: uuid("linked_sighting_id").references(() => sightings.id),
  // metadata
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("incidents_chapter_status").on(t.chapterId, t.status),
  index("incidents_reporter").on(t.reporterId),
  index("incidents_occurred").on(t.occurredAt),
  index("incidents_public_token").on(t.publicToken),
]);

// ============================================================
// INCIDENT <-> ACTOR (many-to-many)
// ============================================================
export const incidentActors = ops.table("incident_actors", {
  id: id(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  role: varchar("role", { length: 32 }).default("associated"),   // associated, witness, victim, bystander
  notes: text("notes"),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("incident_actors_pair").on(t.incidentId, t.actorId),
  index("incident_actors_incident").on(t.incidentId),
  index("incident_actors_actor").on(t.actorId),
]);

// ============================================================
// INCIDENT <-> VEHICLE (many-to-many)
// ============================================================
export const incidentVehicles = ops.table("incident_vehicles", {
  id: id(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  role: varchar("role", { length: 32 }).default("involved"),  // involved, suspect, getaway, blocking
  notes: text("notes"),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("incident_vehicles_pair").on(t.incidentId, t.vehicleId),
  index("incident_vehicles_incident").on(t.incidentId),
  index("incident_vehicles_vehicle").on(t.vehicleId),
]);

// ============================================================
// INCIDENT EVIDENCE (timeline of attachments)
// An incident grows over days/weeks as evidence accumulates.
// ============================================================
export const incidentEvidence = ops.table("incident_evidence", {
  id: id(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id),
  uploadedBy: uuid("uploaded_by"),                                         // reporter or operator UUID
  evidenceType: varchar("evidence_type", { length: 20 }).notNull(),        // photo, video, audio, document, text_note, medical_record
  caption: text("caption"),
  phase: evidencePhaseEnum("phase").default("during_incident").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }),            // when media was taken
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  // storage (base64 initially, object storage later)
  mimeType: varchar("mime_type", { length: 64 }),
  fileSize: integer("file_size"),                                          // bytes
  storageKey: text("storage_key"),                                         // base64 data or future object key
  metadata: jsonb("metadata").default({}),                                 // EXIF, dimensions, duration
  createdAt: createdAt(),
}, (t) => [
  index("incident_evidence_incident").on(t.incidentId),
  index("incident_evidence_phase").on(t.phase),
  index("incident_evidence_added").on(t.addedAt),
]);

// ============================================================
// VEHICLE GROUPS (fast dispatch, convoy tracking)
// ============================================================
export const vehicleGroups = ops.table("vehicle_groups", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("vehicle_groups_chapter_name").on(t.chapterId, t.name),
]);

export const vehicleGroupMembers = ops.table("vehicle_group_members", {
  id: id(),
  groupId: uuid("group_id").notNull().references(() => vehicleGroups.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("vgm_group_vehicle").on(t.groupId, t.vehicleId),
  index("vgm_vehicle").on(t.vehicleId),
]);

// ============================================================
// WATCHPOINTS (saved hotspot locations with city grouping)
// ============================================================
export const watchpoints = ops.table("watchpoints", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
  name: varchar("name", { length: 128 }).notNull(),
  address: text("address"),
  cityGroup: varchar("city_group", { length: 64 }),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radiusMeters: integer("radius_meters").default(200),
  createdAt: createdAt(),
}, (t) => [
  index("watchpoints_chapter").on(t.chapterId),
  index("watchpoints_city").on(t.chapterId, t.cityGroup),
]);
