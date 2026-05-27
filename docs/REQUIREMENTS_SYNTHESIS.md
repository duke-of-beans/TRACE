# TRACE — Requirements Synthesis v1.1

> **TRACE** — Tracking, Reporting, Analysis & Community Evidence

**Source:** Client questionnaire responses (Sections 1–2) + follow-up answers
**Date:** 2026-05-24
**Status:** All questions resolved → Ready for spec finalization

---

## Executive Summary

The questionnaire responses confirm the core TRACE architecture (federated cells, reporter PWA, operator interface, pattern engine) but reveal **six new subsystems** not fully scoped in the original design. The current workflow is entirely manual — private chat → Excel → human memory — which means the system isn't replacing existing software but replacing a paper-and-chat process. This simplifies migration but raises the bar on UX: the system must feel faster than scrolling a group chat, or adoption fails.

---

## Section 1: Current Operations & Data

### 1.1 Daily Workflow → Architectural Implications

**What they said:** Spotters monitor chat groups. They collect data on changed license plates on commonly seen vehicles. Different vehicles serve different crime types. Spotters can send notifications on active suspicious vehicles. Need graduated concern levels and associated driver/person profiles.

**New subsystems required:**

#### A. Vehicle Type Taxonomy (NEW)

The system needs a generalizable, chapter-editable classification system for vehicle usage types. These are not make/model — they're operational roles.

| Concept | Example | Notes |
|---------|---------|-------|
| Type | Runner, Scout, Stash car, Decoy | Chapter-defined labels |
| Combination | A vehicle can hold multiple types simultaneously |
| Independence | Types are independent — a vehicle can gain/lose types over time |

**Implementation:** `vehicle_types` table with many-to-many join to `vehicles`. Types are chapter-scoped with optional mesh sharing. Admin UI for CRUD on type definitions. Each type carries a user-defined description and optional icon/color for map rendering.

#### B. Concern Level Engine (NEW — CRITICAL)

Graduated, criteria-based escalation system for vehicles. This is the core intelligence layer.

| Requirement | Detail |
|-------------|--------|
| Levels are user-defined | Admin creates the ladder (e.g., "Noticed → Suspicious → Confirmed → Active Criminal") |
| Criteria-based promotion | Each level has configurable criteria that must be met before a vehicle can be promoted (e.g., "3+ sightings within 30 days" or "plate swap observed" or "operator manual override") |
| Editable at chapter level | Different chapters may use different ladders |
| Audit trail | Every level change is logged with timestamp, actor, and justification |

**Implementation:** `suspicion_levels` config table per chapter. `vehicle_suspicion_history` immutable log. Promotion rules engine — simple predicate system (count-based, time-based, flag-based, OR manual). Operator UI: one-click promote/demote with required justification field.

**Confirmed promotion criteria** (from client — these become the seed predicates, with the system generalized for admin-defined additions):

| Trigger | What it proves | Typical level transition |
|---------|---------------|--------------------------|
| Identified driver | Vehicle linked to a known actor profile | Noticed → Suspicious |
| Identified activities | Observed criminal behavior pattern (type assignment) | Noticed → Suspicious |
| Identified root location | Vehicle traced to a known criminal address | Suspicious → Confirmed |
| Combination of above | Multiple criteria met | Confirmed → Active Criminal |
| Manual operator override | Operator judgment with justification | Any → Any |

The system must be **generalized for addition** — admins create new predicate types (e.g., "co-occurrence with confirmed vehicle," "plate swap count threshold," "community tip corroboration") without code changes. Predicates are composable: a level can require ANY of a set (OR) or ALL of a set (AND).

**Default ladder (shipped as template, fully editable):**
1. **Noticed** — Single sighting, no pattern yet
2. **Suspicious** — Pattern emerging (identified driver OR identified activities OR repeat sightings)
3. **Confirmed** — Multiple criteria met including root location or operator elevation
4. **Active Criminal** — Sufficient evidence for case package generation
5. **Retired** — Vehicle sunsetted (see 1.3)

#### C. Driver/Actor Database (NEW)

Vehicles need associated driver profiles. Known criminals have varying aggression levels and behavioral patterns.

| Concept | Detail |
|---------|--------|
| Driver profile | Name/alias, physical description, aggression/risk level, known associates, photos |
| Vehicle–Driver join | Many-to-many (one driver can use multiple vehicles, one vehicle can have multiple known drivers) |
| Risk classification | Generalizable, chapter-editable labels — **confirmed seed categories: Aggressive, Stalker (will follow spotters)**. System must support admin-defined additions without code changes. |
| Criminal database | Persistent across vehicle retirements — a driver persists even when their vehicles sunset |

**Implementation:** `actors` table with `actor_vehicles` join. `actor_risk_levels` chapter-scoped config. Actor record view in operator UI linked from vehicle records. Actor profiles participate in pattern engine (co-occurrence of actors across vehicles strengthens concern levels).

#### D. Spotter Notification System (NEW)

Spotters can push real-time alerts when they identify active suspicious vehicles in the field.

**Implementation:** Push notification via PWA service worker. Notification channels: per-team, per-reporter, per-vehicle-watch-list. Operator receives prioritized triage queue entry. Maps to 1.6 (immediate turnaround requirement).

### 1.2 Current Data Format → Migration Path

**What they said:** Input is cell phone photos + written data into private chats. An associate manually rips data from chats into Excel spreadsheets. The spreadsheet library grows continuously and is the sole reference.

**Implications:**

- **Migration:** Excel import pipeline needed for day-one onboarding. **Data is dirty** — hundreds of rows, dozen+ columns, inconsistent formatting, no normalization. This is not a simple CSV import; it requires a data cleaning and normalization pass before ingestion. Build a migration tool that: (1) ingests raw Excel, (2) presents a normalization UI where the operator maps columns to TRACE fields, resolves duplicates, and flags garbage rows, (3) produces clean vehicle + sighting records. Budget significant time for this — the data quality problem is the hardest part of onboarding.
- **Chat ingestion:** Future feature consideration — structured intake from chat platforms (Signal, WhatsApp, Telegram) via bot or forwarding address. Not MVP but high-value.
- **Photo handling:** 1–6 photos per sighting (variable, may increase). Photos currently live in phone galleries and chat histories. Bulk upload tool needed — reporter drops a folder of photos, system extracts EXIF (GPS, timestamp), creates sighting records with operator review. Multi-photo sightings are a first-class concept: a sighting record holds 1–N images, not one image per sighting.
- **No existing database to integrate against.** This is greenfield with a data migration, not a system replacement.

### 1.3 Repeat Vehicle Identification → Vehicle Sunsetting

**What they said:** Spotters maintain local knowledge, may not access the database. Criminals "retire" vehicles. Need programmable sunsetting at 90 days default.

**Implications:**

- **Vehicle sunset engine:** Configurable inactivity timer (default 90 days). When a vehicle has no new sightings within the window, it auto-transitions to "Retired" status. Retired vehicles remain in the database (searchable, linkable) but drop out of active dashboards, maps, and pattern engine.
- **Sunset is soft:** Operator can reactivate a retired vehicle with one click if it reappears. Reactivation logs to audit trail.
- **Spotter-side search:** The reporter PWA needs a lightweight vehicle lookup — even if spotters don't formally "access the database," they need to be able to check "has this vehicle been seen before?" from their phone before submitting. This is a read-only search by plate, description, or photo similarity. Prevents duplicate records and connects new sightings to existing data.

### 1.4 Case Packages → Legal-Grade Evidence

**What they said:** Stub this. Build for maximum legal/credential soundness for all audiences.

**Implications:**

- Case packages must be designed as if they'll be submitted to a court, even if early use is informal.
- **Chain of custody:** Every piece of evidence (photo, sighting record, operator note) carries cryptographic hash from point of capture, immutable timestamp, and access log.
- **Package format:** PDF with evidence index, timeline visualization, map of sightings, vehicle record summary, actor profiles, plate history, and integrity verification page (hash manifest).
- **Audience-agnostic:** Same package works for attorneys, law enforcement, partner organizations, or internal review. No audience-specific formatting needed yet.

### 1.5 Communication Channels → System Replaces Chat

**What they said:** Mostly private chat, but less chat and more linear data transference.

**Key insight:** The chat isn't being used for conversation — it's being used as a data pipeline. The system replaces this entirely. The reporter PWA becomes the structured intake channel. No need to build chat features into TRACE — the system IS the replacement for chat-as-data-transfer.

**Implication:** The PWA submission flow must be faster than typing into a group chat. Camera → auto-populate fields → submit. Three taps maximum for a basic sighting report.

### 1.6 Turnaround Time → Real-Time Operations

**What they said:** Immediate. Notifications for members and teams.

**Implications:**

- **WebSocket/SSE for operator interface** — new sightings appear in triage queue without refresh.
- **Push notifications:** Admin-controlled alert configuration. Admin defines notification rules per team, per individual, per vehicle watch list, per concern level. Operators and spotters do not self-configure alerts — the admin sets the alert topology for the chapter.
- **Team channels:** Admin-defined notification groups (e.g., "North sector team," "Plate swap alert," "High-priority vehicles"). Admin assigns members to channels and sets trigger conditions.
- **Latency target:** Sighting submission → operator notification < 5 seconds on reasonable connectivity.

---

## Section 2: Organization Structure & Scale

### 2.1 Chapters → Multi-Tenant from Day One

**What they said:** 1 chapter for now. Open source for any tenant.

**Implications:**

- Build single-tenant MVP but with multi-tenant data model from day one.
- Chapter isolation: all data is chapter-scoped. No cross-chapter data leakage without explicit mesh participation.
- **Tenant 0** is the reference implementation. All configuration, type taxonomies, concern ladders, and notification rules created for tenant 0 become the default template for new tenants.
- Open-source consideration: licensing, documentation, and deployment tooling need to be part of the build plan, not afterthought.

### 2.2 Reporters → ~20, Overbuild

**What they said:** ~20 active reporters. Overbuild but not massively.

**Implications:**

- Size for 50–100 reporters per chapter in the data model and auth system.
- PWA must handle 20 concurrent field reporters submitting photos on mobile data connections.
- Offline-first is confirmed critical — spotters in the field may have spotty connectivity.
- Reporter management: admin can invite, deactivate, and manage reporters. Pseudonymous by default.

### 2.3 Operators → 1 Per Chapter

**What they said:** Ideally only 1 operator per chapter daily.

**Implications:**

- The operator interface must be a **power-user single-pane-of-glass.** One person managing all incoming data, pattern review, and case building.
- Keyboard-driven workflows confirmed essential. Triage queue with hotkeys (approve/flag/dismiss/escalate).
- Dashboard must surface: new sightings since last session, active vehicle count by concern level, pattern alerts, notification queue.
- **Single operator = single point of failure.** System needs to be self-documenting enough that a backup operator can step in with minimal ramp. Audit logs and activity feed serve this purpose.

---

## New Architecture Components (Delta from README)

| Component | Status in README | Status After Questionnaire |
|-----------|-----------------|---------------------------|
| Vehicle Type Taxonomy | Not scoped | **NEW — Required** |
| Concern Level Engine | Not scoped | **NEW — Critical path** |
| Driver/Actor Database | Not scoped | **NEW — Required** |
| Vehicle Sunset Engine | Not scoped | **NEW — Required** |
| Spotter Notification System | Not scoped | **NEW — Required** |
| Excel Migration Pipeline | Not scoped | **NEW — Day-one requirement** |
| Spotter-side Vehicle Search | Implied | **Confirmed — Required in PWA** |
| Real-time Event Stream | Implied | **Confirmed — WebSocket/SSE** |
| Reporter PWA | Scoped | **Confirmed — camera-first, 3-tap submit** |
| Processing Cell | Scoped | **Confirmed — expanded with new engines** |
| Vehicle Identity | Scoped | **Expanded — now includes types + suspicion + actors** |
| Pattern Engine | Scoped | **Expanded — actor co-occurrence, sunset awareness** |
| Operator Interface | Scoped | **Confirmed — single operator, power-user, keyboard-driven** |
| Case Package Builder | Scoped | **Confirmed — legal-grade, stub for now** |
| National Mesh | Scoped | **Confirmed — single chapter first, mesh when federation needed** |
| VIGIL Module | Scoped | **Unchanged — toggleable per cell** |

---

## Build Philosophy

**No MVPs. No timelines. Build it right, build it complete.**

The system ships when it's done, not when an arbitrary phase gate is hit. That said, the build has a natural dependency order — you can't build the pattern engine before the data model exists. The sequence below reflects dependency, not scope cuts.

**Foundation (must exist before anything else)**
- Data model: vehicles, sightings, actors, types, concern levels, sunset engine, audit log
- Excel migration/normalization tool (dirty data → clean dossiers)
- Reporter PWA: camera → submit → offline queue → sync
- Spotter-side vehicle search (read-only lookup in PWA)
- Operator triage queue with real-time WebSocket updates
- Vehicle record view with concern level management + actor linking
- Map view (sighting locations, vehicle heatmaps)
- Admin-controlled notification system (teams, individuals, trigger rules)
- Push notifications (PWA service worker)

**Intelligence (depends on foundation data flowing)**
- Pattern engine: plate swaps, spatiotemporal clustering, co-occurrence, actor correlation
- Concern level auto-promotion (predicate engine evaluating criteria)
- Vehicle sunset engine (90-day default, soft retirement, one-click reactivation)

**Evidence & Federation (depends on intelligence producing actionable output)**
- Case package builder (legal-grade PDF, hash manifest, chain of custody)
- Multi-tenant provisioning (tenant 0 config → template for new chapters)
- VIGIL module integration (toggleable per cell)
- National mesh (cross-chapter matching, corridor analysis)

**Open source from day one.** The codebase is public-service tooling for approved groups. The architecture documentation is shared with trusted associates, not published broadly. Licensing must reflect this: open source with controlled distribution, not permissive open-to-all.

**Deployment reality:** Each cell has a dedicated admin with server access. Hardware will likely be older/modest. Docker composition must be lean — no GPU required for base operation (VIGIL toggle handles the GPU-dependent path). Target: runs on a machine with 8GB RAM and a spinning disk.

---

## Resolved Questions

All seven open questions answered. Key decisions locked:

| # | Question | Answer | Design Impact |
|---|----------|--------|---------------|
| 1 | Suspicion criteria | Identified driver, identified activities, identified root location (known criminal address). Generalized for admin additions. | Predicate engine must be composable (AND/OR), admin-editable, no code changes for new criteria. |
| 2 | Actor risk levels | Aggressive, Stalker (will follow spotters). More via generalization. | `actor_risk_levels` is admin-editable taxonomy, same pattern as vehicle types. Seed with confirmed categories. |
| 3 | Notification priority | Admin-controlled per team, per individual. No self-service alert config. | Notification rules engine owned by admin role. Alert topology is chapter policy, not user preference. |
| 4 | Excel data volume | Hundreds of rows, 12+ columns, dirty/unnormalized. | Migration tool must include a normalization UI, not just blind import. Budget this as a real feature, not a script. |
| 5 | Photo volume | 1–6 per sighting, variable. | Sighting record is 1:N with images. PWA multi-photo capture flow. Storage sizing: ~50 sightings/day × 6 photos × 3MB = ~900MB/day peak. |
| 6 | Deployment | Dedicated admin per cell, server access, likely older hardware. | Docker lean: 8GB RAM target, no GPU for base. VIGIL is the GPU toggle. Spinning disk acceptable. |
| 7 | Open source | From day one. No timelines, no MVPs. Public service tool for approved groups. Architecture shared with trusted associates only. | License: open source with controlled distribution. Documentation for operators/admins public; architecture docs restricted. |

---

## Remaining Open Items

No blocking questions remain. The following are implementation decisions to be made during build:

- **Predicate DSL syntax** — how admin-defined criteria are expressed in the UI (form builder vs. simple rule cards vs. expression language). Recommend rule cards for v1.
- **Notification delivery mechanism** — PWA push via service worker is confirmed, but backup channel (SMS? email?) for operators who aren't in the app. Defer until deployment reality is clearer.
- **Map provider** — OpenStreetMap (free, self-hosted) vs. Mapbox (better UX, usage-based cost). OSM aligns with the open-source ethos and no-cost-per-cell model.
- **Mesh protocol** — WireGuard VPN + Redis pub/sub is scoped in README. Confirm this holds when multi-tenant is built. Likely fine for <10 cells; may need message broker (NATS) at scale.
