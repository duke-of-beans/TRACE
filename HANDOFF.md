# TRACE — Session Handoff
# Generated: 2026-05-26 | 59 commits | 144 files | 25,524 lines
# YUMA: 22/22 passing, score 89

## PROJECT OVERVIEW

TRACE (Tracking, Reporting, Analysis & Community Evidence) is a community
vehicle tracking platform. Field reporters submit sightings via a mobile
PWA. Chapter operators triage, analyze, and manage intelligence via a
desktop dashboard. The system is built for hostile environments where
reporter safety is the primary constraint.

Repository: https://github.com/duke-of-beans/TRACE
Path: D:\Projects\TRACE
KERNL project ID: trace

## TECH STACK

Server: Node.js 22 + TypeScript + Hono + Drizzle ORM
Database: PostgreSQL (3 vaults: ops/ident/evidence, separate roles)
Reporter PWA: Preact + Vite (63KB JS, 11.5KB CSS)
Operator Dashboard: React + Vite + Tailwind (465KB JS, 16.5KB CSS)
Map: Leaflet (OSM/CARTO tiles)
Design: Exo 2 Thin wordmark, Slate+Indigo palette, CSS custom properties

## HOW TO RUN

```
# WSL: sudo service postgresql start
# CMD:
cd /d D:\Projects\TRACE
npx tsx src/db/seed.ts      # seed demo data
npx tsx src/index.ts         # start server on :3100
```

Reporter: http://localhost:3100 (test code: TEST-CODE)
Operator: http://localhost:3100/operator (email: operator@trace.local)

## FILE STRUCTURE (key files)

```
src/
  index.ts                    — Hono app, routes, middleware, WebSocket
  middleware/auth.ts           — Auth middleware (3 guards: auth, operatorOnly, adminOnly)
  api/auth/index.ts            — Auth routes (dev-login, invite-code, magic-link, status)
  api/sightings/index.ts       — Sighting CRUD + triage
  api/vehicles/index.ts        — Vehicle CRUD + promote + retire
  api/actors/index.ts          — Actor CRUD + vehicle linking
  api/admin/index.ts           — Admin CRUD (types, levels, predicates, reporters, feedback)
  api/geo/index.ts             — Heatmap, corridor analysis
  db/schema/vault-a.ts         — Operational schema (pseudonymous)
  db/schema/vault-b.ts         — Identity schema (encrypted)
  db/schema/vault-c.ts         — Evidence schema (write-once)
  db/seed.ts                   — Demo data seeder
  services/                    — Suspicion engine, geospatial, jitter, photo, notification

pwa/
  src/app.tsx                  — PWA root (gate flow: PIN→lock→invite→briefing→app)
  src/pages/submit.tsx         — Sighting submission (camera, file picker, EXIF scrub)
  src/components/onboarding.tsx — Security briefing (7 steps, post-auth)
  src/components/pin-setup.tsx  — PIN setup (pre-auth, minimal)
  src/components/pin-lock.tsx   — PIN lock screen
  src/components/security-info.tsx — Security docs (laymen + technical)
  src/components/feedback-button.tsx — Bug report form
  src/components/panic-button.tsx — Emergency wipe button
  src/lib/photo-scrub.ts       — EXIF metadata scrubber (canvas re-encode)
  src/lib/deadman.ts           — Dead man's switch (72h TTL, background sync)
  src/lib/crypto.ts            — AES-256-GCM encryption
  src/lib/queue.ts             — Offline queue
  src/lib/panic.ts             — Self-destruct sequence
  src/lib/app-lock.ts          — PIN lock + auto-lock
  public/sw.js                 — Service worker (cache, push kill, background sync)

operator/
  src/app.tsx                  — Operator root (auth gate → onboarding → dashboard)
  src/pages/dashboard.tsx      — Overview stats
  src/pages/triage.tsx         — Sighting triage (keyboard-driven: A/F/D/E)
  src/pages/vehicles.tsx       — Vehicle list + dossier + add/edit/retire
  src/pages/actors.tsx         — Actor list + dossier + add/edit/deactivate
  src/pages/admin.tsx          — Full CRUD admin panel (7 tabs including Feedback)
  src/pages/security.tsx       — Security ops (overview + device control + nuke)
  src/components/operator-onboarding.tsx — 7-step operator briefing (post-login)
  src/components/map-view.tsx  — Leaflet Intel Map
  src/lib/api.ts               — API client (all endpoints)
  src/lib/auth-gate.tsx        — Login screen

shared/design/
  tokens.css                   — CSS custom properties (light/dark)
  icons.ts                     — 30+ custom SVG icons
  theme.ts                     — Theme toggle + persistence
  wordmark.ts                  — Wordmark constants

VOICE_GUIDE.md                 — Tranche-adapted voice rules
DESIGN_SYSTEM.md               — Full design system spec + WCAG audit
scripts/test-api.ts            — API contract test runner
scripts/test-regression.ts     — Regression + chain test runner
```

## ARCHITECTURE DECISIONS

[DECISION] Three-vault PostgreSQL: ops (pseudonymous), ident (encrypted),
  evidence (write-once). Separate DB roles with minimal privileges.
[DECISION] Invite code auth: no email. XXXX-XXXX format, no confusing chars
  (0/O/1/I excluded). Single-use, 7-day expiry. TEST-CODE accepted in dev.
[DECISION] Onboarding AFTER auth in BOTH apps. Bad actors see only PIN
  setup and invite code screens. Security briefing gated behind authentication.
[DECISION] Callsign is the identity. Operators know reporters by callsign only.
  PIN protects the device. Never shared with operator.
[DECISION] EXIF scrubbing: canvas re-encode destroys all metadata. GPS and
  timestamp extracted before stripping. No device fingerprint survives.
[DECISION] Dead man's switch: 72h TTL, background sync (6h periodic, 5min
  in-app heartbeat), 4h grace period with warnings. Auto-wipe on expiry.
[DECISION] Voice: Tranche-adapted. Data forward, no emotion, approachable
  deadpan. All copy has laymen summary (bold, readable) + technical detail
  (smaller, muted). Zero AI patterns (no em-dashes, no "designed to", etc).
[DECISION] Reporter flow: Wiped → PIN setup → PIN lock → Invite code → 
  Security briefing → Main app. Emergency wipe on Report screen.
[DECISION] Operator flow: Login → Operator onboarding → Dashboard.
  Keyboard shortcuts throughout (1-7 nav, A/F/D/E triage, ? overlay).

## SECURITY FEATURES

- AES-256-GCM device encryption (key from PIN via PBKDF2)
- Gallery-free camera (getUserMedia → encrypted storage)
- EXIF metadata scrubbing (canvas re-encode, no device identifiers)
- Encrypted offline queue (auto-drain on connectivity)
- Emergency wipe (destroy key first, then clear all storage)
- Dead man's switch (72h auto-wipe, background sync keepalive)
- Remote kill (suspend/kill/nuke-all, push + heartbeat delivery)
- 10-attempt PIN brute force auto-wipe
- Auto-lock (30s background, 5min inactivity)
- Time jitter on sighting timestamps (±30s reporter protection)
- Three-vault data isolation
- Write-once evidence vault (SHA-256 hash chain)

## YUMA TEST SUITE (22/22)

SMOKE (4): Server health, TypeScript compiles, PWA builds, Operator builds
CONTRACT (10): Dev login, TEST-CODE, 401 unauth, GET vehicles/actors/sightings/
  vehicle-types, generate invite, nuke auth, triage workflow
REGRESSION (5): Operator role, admin access, invite chars, auth required, nuke perms
CHAIN (3): Reporter lifecycle, suspicion config, device kill

Run: KERNL:test_run project "trace" (server must be running)

## REMAINING WORK (priority order)

### HIGH PRIORITY
1. Map analytics — the Intel Map needs date range filtering, a time slider
   for historical playback, and the ability to filter by vehicle/actor/type.
   Currently shows live data only. Operators need to study patterns over time.
   The time-slider component exists (operator/src/components/time-slider.tsx)
   but isn't wired to filter map data.

2. Selected vehicle highlight on map — when clicking a vehicle in the
   vehicles list, its sightings should be visually distinct from all other
   sightings on the Intel Map. Currently all markers are the same color.

### MEDIUM PRIORITY
3. Responsive audit on operator dashboard — some pages may not render well
   on smaller screens. Needs testing at tablet breakpoints.

4. Wire actor identifiers into actor dossier view — the actor page shows
   basic info but doesn't display or manage the actor's identifiers
   (tattoos, clothing, build, habits) which are stored in the DB.

5. History page (reporter PWA) — not implemented. Should show past
   submissions from the offline queue.

### LOW PRIORITY
6. Case package PDF generation — export vehicle/actor dossier as PDF.
7. Docker compose config for deployment.
8. Production deployment adapter (PM2, systemd, etc).
9. Auth middleware not wired to all API routes consistently — some
   routes may lack proper chapter-scoping.

## .env REQUIRED

```
DATABASE_URL_OPS=postgresql://trace_ops:trace_ops_dev@127.0.0.1:5432/trace
DATABASE_URL_IDENT=postgresql://trace_ident:trace_ident_dev@127.0.0.1:5432/trace
DATABASE_URL_EVIDENCE=postgresql://trace_evidence:trace_evidence_dev@127.0.0.1:5432/trace
NODE_ENV=development
```
