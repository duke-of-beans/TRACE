# TRACE — Session Handoff
# Updated: 2026-05-26 | Post Auth + Productization Session
# Deployment: https://trace-jet.vercel.app (Vercel + Neon PostgreSQL)

## PROJECT OVERVIEW

TRACE (Tracking, Reporting, Analysis & Community Evidence) — community
vehicle tracking platform with dispatch system. Reporter PWA + Operator
Dashboard. Three-vault PostgreSQL architecture. Hono + Drizzle + Preact/React + Leaflet.

- **Repo:** https://github.com/duke-of-beans/TRACE
- **Local:** D:\Projects\TRACE
- **Live Reporter:** https://trace-jet.vercel.app
- **Live Operator:** https://trace-jet.vercel.app/operator/
- **API Health:** https://trace-jet.vercel.app/api/v1/health
- **Design Doc:** D:\Projects\TRACE\DISPATCH_DESIGN.md
- **Voice Guide:** D:\Projects\TRACE\VOICE_GUIDE.md
- **Design System:** D:\Projects\TRACE\DESIGN_SYSTEM.md

## ARCHITECTURE

```
pwa/               Preact reporter app (mobile-first PWA)
operator/           React operator dashboard (desktop)
src/                Hono API server
  api/              Route handlers (sightings, vehicles, actors, auth, admin, geo, dispatch)
  db/               Drizzle schema + connection (3-vault: ops, ident, evidence)
  services/         Business logic (plate-lookup, geospatial, notification, jitter)
  middleware/       Auth, audit
api/index.ts        Vercel serverless entry point
shared/design/      Design tokens, theme
```

## DATABASE

**Neon PostgreSQL** — Project `late-wave-08620201`, database `trace`
- Pooler (app): `postgresql://neondb_owner:npg_yQfC4A6DsbFx@ep-restless-scene-aqhfsf50-pooler.c-8.us-east-1.aws.neon.tech/trace?sslmode=require`
- Direct (migrations): `postgresql://neondb_owner:npg_yQfC4A6DsbFx@ep-restless-scene-aqhfsf50.c-8.us-east-1.aws.neon.tech/trace?sslmode=require`

Three schemas: ops (operational), ident (identity), evidence (write-once)

**Key tables added this session:**
- `ops.dispatch_event_types` — chapter-configurable event categories
- `ops.dispatch_events` — core dispatch records with location, priority, lifecycle
- `ops.dispatch_assignments` — reporter assignments with response tracking
- `ops.dispatch_outcomes` — what happened when patroller arrived
- `ops.sighting_feedback` — feedback pushed back to original reporter
- `ops.sightings` gained: `plate_matched` (bool), `matched_vehicle_id` (uuid)
- `ops.vehicles` gained: `photo_url` (text, base64)
- `ops.actors` gained: `photo_url` (text, base64)

## VERCEL DEPLOYMENT

**Project:** prj_qvFAyYUjX246zdNX0wGtuOCz6gmZ
**Team:** team_3Bg0XHuxlkLx71xnTGn2G6PA
**Env vars:** DATABASE_URL (sensitive, production+preview)

Deploy: `npx vercel --prod`
Schema push: use direct URL with `drizzle-kit generate` then `migrate`
Seed: use pooler URL with `npx tsx src/db/seed.ts`

## AUTH

- **Reporter:** invite code → PIN setup → onboarding. TEST-CODE works in dev mode.
- **Operator:** callsign + access code via `/auth/operator-login`. Dev mode: code optional. Prod: required.
- **Bootstrap:** `/setup/bootstrap` creates first operator + chapter. Self-locking after first use.
- **Operator management:** Admin panel > Operators tab. Create with callsign + access code.
- Dev-login disabled by `TRACE_DISABLE_DEV_LOGIN=true`
- Test code disabled by `TRACE_DISABLE_TEST_CODE=true`
- Operator login checks role — rejects non-operator/admin
- Dev-login never auto-creates operator accounts
- Access codes stored as SHA-256 hashes in `ident.reporter_identities.access_code_hash`

## WHAT WAS BUILT THIS SESSION (Latest: Auth + Productization)

### Security Model (deployed)
- **access_code_hash** column added to `ident.reporter_identities` (migration 0003)
- **`/api/v1/auth/operator-login`** — proper operator auth. Callsign + access code. Dev mode (default): access code optional. Prod mode (`TRACE_DISABLE_DEV_LOGIN=true`): access code required, verified against SHA-256 hash.
- **`/api/v1/setup/status`** — returns `needsSetup` (no operators exist) + `devLoginEnabled`
- **`/api/v1/setup/bootstrap`** — creates first operator + chapter in one shot. Self-locking: returns 403 once any operator exists. Creates session immediately.
- Setup router registered in both `src/index.ts` and `api/index.ts` (Vercel entry)
- Same codebase for dev and prod. Env-var driven behavior.

### Bootstrap (Option B, deployed)
- Operator login screen checks `/setup/status` on mount
- If `needsSetup: true` → shows "First-Time Setup" form (chapter name, callsign, access code)
- Self-locking after first operator created
- Bootstrap creates chapter + operator + session, logs user in immediately

### Operator Management (Option C, deployed)
- `GET /admin/operators` — lists all operators with status
- `POST /admin/operators/create` — callsign + access code (min 6 chars)
- `PUT /admin/operators/:id/access-code` — update access code
- "Operators" tab in Admin panel with create UI

### Portal Guide Sections (deployed)
- **Operator:** "Operator Guide" button in sidebar footer opens modal overlay covering all 6 pages with descriptions and keyboard shortcuts
- **Reporter:** "Quick Guide" section in Settings tab with compact descriptions of Report, Check Plate, Map, and History tabs

### Favicons (deployed)
- `operator/public/favicon.svg` — dark gradient, geometric thin T mark in TRACE accent blue, accent dash
- `pwa/public/favicon.svg` — same family, rounder corners for mobile
- PNG icons generated (192x192, 512x512) via `scripts/gen-icons.cjs`

### Branded PDFs (in repo)
- `docs/pdf/TRACE_Overview.pdf` — branded README with TRACE dark theme, accent headers, code blocks
- `docs/pdf/TRACE_Chapter_Setup_Guide.pdf` — full setup guide in PDF
- `docs/pdf/TRACE_Dispatch_Design.pdf` — dispatch system design doc
- Generator: `python scripts/gen-pdfs.py` (uses reportlab, TRACE brand colors)

### Dependency Tracking System
- `DEPENDENCIES.md` — full dependency graph: source → dependent artifacts
- `scripts/check-deps.py` — reads git diff, maps changed files to dependent artifacts, prints alerts. Returns exit code 1 if updates needed.
- Rules: schema changes → migration + docs + PDFs. Auth changes → login screen + docs + .env.example. Voice/design changes → all UI copy + PDFs.

### Previous: UX + Docs Session

### Core Features Completed (deployed)
- **Reporter photo upload** — photos sent as base64 in sighting payload, stored in sighting_photos table with photoData + mimeType columns. Max 5 photos per sighting. EXIF scrubbed on device before upload.
- **Auto-close stale dispatches** — lazy check on GET /dispatch: if event type has autoCloseHours and dispatch exceeds that, auto-sets status to "expired". No cron needed.
- **Plate auto-suggest** — debounced search as reporter types plate (3+ chars). GET /vehicles/search-plates returns up to 5 matching plates with make/model/color. Dropdown appears below plate input with MATCH badges.
- **Dispatch outcome UI** — when reporter is on_scene, shows 4 outcome buttons: Confirmed, Not Found, Suspect Fled, False Alarm. One tap submits outcome and closes assignment. Vibrates on success.
- **Submission vibration** — `navigator.vibrate(100)` on successful sighting submit and dispatch outcome.

### Previous: Auth + Productization Session

### Dispatch System (Full Stack)
- **Design document:** DISPATCH_DESIGN.md — 5 workflows, 12 little things, 4-phase plan
- **5 new DB tables** + 2 new columns on sightings + photoUrl on vehicles/actors
- **Plate auto-lookup service** — checks plate on sighting creation, stores match
- **Dispatch API** — 15+ endpoints: event types CRUD, create dispatch, confirm-and-dispatch, dismiss-and-notify, reporter lifecycle, close, assign, feedback
- **Seed** — 5 default dispatch event types

### Operator UI
- **Triage rewrite** — MATCH/NEW PLATE badges, auto plate check, Confirm & Dispatch (opens dispatch panel), Dismiss & Notify (sends feedback), Add to Tracking, keyboard shortcuts C/D/F/N/P
- **Dispatch panel** — event type, priority, notes, reporter selection with select-all
- **Intel Map pin placement** — right-click drops pulsing diamond marker, form slides in below map, all fields optional, "Drop Pin" button as alternative
- **Dispatch pin layer** — diamond markers colored by priority, popups with details
- **Pin detail panel** — click pins to view status, add reporters, close
- **Dispatch Types admin** — full CRUD in Admin → Dispatch Types tab with icon/color/priority/auto-close config
- **Link from pin form to admin** for customizing types
- **Map popups** — clicking sighting markers shows plate, activity, time, coordinates
- **Corridor fix** — falls back to plate matching when vehicleId isn't set
- **Photos** — vehicle dossier photo upload/display, actor dossier photo upload/display, thumbnails on list cards
- **Satellite default** on all maps
- **Time slider histogram removed** (was confusing)
- **Help text audit** — tooltips on all actions, contextual descriptions, keyboard shortcut hints

### Reporter UI
- **Map tab** — Leaflet satellite map, dispatch pins by priority, pin info cards, Responding/On Scene lifecycle, Navigate to Google Maps, 30s polling
- **Plate check mode** — Report/Check Plate toggle, instant database lookup, escalate to full report
- **Live sighting status** — after submit shows Submitted → Plate check → Confirmed/Dismissed with polling
- **30-second auto-reset** — status card clears, returns to plate input
- **4-tab nav** — Report, Map, History, Settings (hidden until auth+briefed)
- **Mode toggle descriptions** — contextual help text per mode
- **Direction label** — "Which way was the vehicle heading?"

### UX Polish
- **Both onboardings rewritten** — tool tour not security briefing, approachable language
- **Skip button** on both tutorials
- **Feedback form restyled** with design system classes
- **Auth hardening** — no auto-create operators, role verification on login
- **Responsive nav** — hidden until authenticated and briefed

## REMAINING WORK — NEXT SESSION

### Phase 1: Push notifications (highest remaining impact)
- Web Push subscription endpoint
- Store push subscriptions on reporter records
- Send notifications when dispatch is created/assigned
- Service worker push handler in PWA

### Phase 2: Dispatch management page
- New operator page showing all dispatches (active/closed/expired)
- Response times, outcomes, table view with filters
- Add to operator nav

### Phase 3: Polish
- Night mode auto-switch (time-based theme toggle)
- Operator photo viewer (show sighting photos in triage)
- Docker/docker-compose for one-command local setup
- CONTRIBUTING.md

## FILE MAP (key files to know)

```
src/db/schema/vault-a.ts     All operational tables including dispatch
src/api/dispatch/index.ts    Full dispatch API
src/services/plate-lookup.ts  Auto plate matching
src/api/sightings/index.ts   Enhanced with plate lookup + feedback
src/api/auth/index.ts        Dev-login + invite-code auth
src/db/seed.ts               Seeds including dispatch event types
api/index.ts                 Vercel serverless entry (mirrors src/index.ts routes)

operator/src/pages/triage.tsx      Dispatch-aware triage with MATCH/NEW badges
operator/src/pages/intelligence.tsx Pin placement + dispatch form
operator/src/pages/vehicles.tsx     Vehicle dossier with photos
operator/src/pages/actors.tsx       Actor dossier with photos
operator/src/pages/admin.tsx        Includes Dispatch Types tab
operator/src/components/map-view.tsx IntelMap with dispatch pin layer + right-click
operator/src/lib/api.ts             All dispatch methods

pwa/src/pages/submit.tsx      Report + Check Plate modes, live status
pwa/src/pages/reporter-map.tsx Dispatch map with pin interaction
pwa/src/app.tsx               4-tab nav, auth gates
pwa/src/components/onboarding.tsx Rewritten tutorial with skip

DISPATCH_DESIGN.md            Full workflow analysis document
```

## VOICE GUIDE REMINDER

All UI text follows VOICE_GUIDE.md — factual, no editorializing, present tense, state what the system does. Bold for layman summary, muted for technical detail. Labels as questions in forms ("What type of event?" not "Event Type").
