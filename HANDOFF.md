# TRACE — Session Handoff
# Updated: 2026-05-26
# Status: PHASE 1 COMPLETE, PHASE 2 READY

---

## PROJECT OVERVIEW

TRACE (Tracking, Reporting, Analysis & Community Evidence) — community vehicle
tracking platform. Reporter PWA (Preact) + Operator Dashboard (React).
Three-vault PostgreSQL (Neon). Hono API on Vercel Serverless. Leaflet maps.

**Repo:** https://github.com/duke-of-beans/TRACE (PUBLIC)
**Local:** D:\Projects\TRACE
**Live:** https://trace-jet.vercel.app (reporter) / https://trace-jet.vercel.app/operator/ (operator)
**Guide:** https://trace-jet.vercel.app/guide.html

---

## INFRASTRUCTURE

**Neon DB:**
- Org: org-dawn-forest-40118329
- Connection: See .env.neon (gitignored)
- Neon API Key: See D:\Meta\Neon API.md

**Vercel:**
- Project: prj_qvFAyYUjX246zdNX0wGtuOCz6gmZ
- Deploy: `npx vercel --prod --yes` from project root

**GitHub:**
- PAT: stored locally, not in repo
- Git config: DK / 213939863+duke-of-beans@users.noreply.github.com
- MUST stay as "DK" with noreply email — Vercel blocks non-owner author commits

**VAPID (Push Notifications):**
- See Vercel environment variables

---

## DESIGN RULES (ENFORCED)

**Voice:** VOICE_GUIDE.md — no em dashes, no "designed to", no celebration language,
no corporate name-dropping, architecture descriptions over security claims.

**Design:** DESIGN_SYSTEM.md — Slate + Indigo palette. Cyan (#4fc3f7) is BANNED.
Accent: #818CF8 dark / #4F46E5 light. System fonts for body. Exo 2 (weight 100)
for TRACE wordmark only. No custom fonts otherwise.

**Attribution:** Arms-length. "Hosting it, not authoring it." All docs scrubbed of
personal info. Git config uses DK/noreply. No personal name anywhere in code or docs.

**Map:** Default center McLean, VA (38.9310, -77.1770). Demo sightings placed around
McLean residential streets (Old Dominion Dr, Chain Bridge Rd, Lewinsville Park,
Elm St, Kirby Rd). NOT on or near CIA campus.

---

## WHAT WAS COMPLETED THIS SESSION

### Phase 1: Schema + API Foundations (COMPLETE)

**Database Schema (Drizzle + raw SQL):**
- 5 new tables in vault-a.ts: tagDefinitions, knownNumbers, harassmentReports,
  integrationConfig, vehicleEnrichments
- 3 new columns on sightings: operatorTag, operatorResponse, operatorRespondedAt
- setup.sql updated with all new DDL (idempotent CREATE IF NOT EXISTS + ALTER ADD COLUMN)
- Migration: migrations/0005_phase1-integrations-harassment.sql
- Seed: 18 default tag definitions (6 sighting + 6 vehicle + 6 harassment)

**API Endpoints:**
- GET/POST/DELETE /api/v1/tag-definitions (chapter-scoped tag management)
- GET/PUT/DELETE /api/v1/integrations/:service (encrypted API key CRUD)
- POST /api/v1/integrations/:service/test (service-specific connection tests)
- PATCH /api/v1/sightings/:id/respond (operator adds tag + response)
- GET /api/v1/sightings/mine (reporter's sightings with tag/response data)
- GET /api/v1/import/status (check for demo data)
- POST /api/v1/import/clear-demo (remove seed data before first real import)
- POST /api/v1/import/preview (upload file, get mapping preview)
- POST /api/v1/import/run (execute import from previewed file)
- Helper exports: isIntegrationEnabled(), getApiKey(), incrementLookupCount()

**Route Mounting:**
- /api/v1/tag-definitions (authenticated)
- /api/v1/integrations (operator-only)
- /api/v1/import (operator-only)

### Brand Consistency: Unified Wordmark

All three portals now use the same brand lockup pattern:
1. "TRACE" in Exo 2 Thin (100), accent color, 0.22em letter-spacing
2. Hairline rule below (accent, 50% opacity)
3. "Tracking · Reporting · Analysis · Community Evidence" in small uppercase
4. Context label below (Field Reporter / Operator Console / Chapter Setup Guide)

**Files changed:**
- shared/design/wordmark.ts: unified spec, size presets (lg/md/sm)
- pwa/src/styles.css: .wordmark classes updated, .wordmark-expansion added
- pwa/src/components/pin-lock.tsx: accent color, expansion text added
- operator/src/lib/auth-gate.tsx: Logo() sized to lg preset, consistent spacing
- pwa/public/guide.html: hero updated to match (40px, rule, 10px expansion)
- guide.html footer: consistent wordmark treatment

### Guide.html Navigation Redesign

- Step numbers redesigned: large Exo 2 Thin (36px) in left margin, 25% opacity
- Steps have padding-left to create typographic gutter
- Fixed scroll progress indicator on right side with labeled dots
- Dots show section labels on hover, highlight active section on scroll
- Progress fill tracks scroll position
- Section IDs added for deep linking (#step-1 through #step-6, #complete)
- Smooth scroll on dot click
- Mobile responsive: scroll nav hidden below 900px, step numbers shrink

### Data Import System

- src/services/import/clear-demo.ts: detects and removes all DEMO/FAKE/TEST data
  (vehicles, sightings, actors, dispatches, linked records) while preserving
  chapter config (reporters, tags, suspicion levels, dispatch types)
- src/api/import/index.ts: upload, preview, and import API endpoints
- Pipeline: upload -> auto-map columns -> preview report -> confirm -> import
- Supports .xlsx, .xls, .csv, .tsv
- Auto-mapping handles: plate, make, model, color, year, date, time, location, notes
- Demo data detection: hasDemoData() check before first import

### Documentation Updates

- README.md: added Integrations, Import, Harassment Reporting, Tags sections.
  Fixed "ensures" voice violation.
- CHAPTER_SETUP.md: added "Optional: Configure Integrations" and "Import Data"
- DESIGN_SYSTEM.md: added Tag Colors section (18 tags with hex colors and use cases),
  Unified Wordmark specification (sizes, rules, mid-dot expansion)

### YUMA Audit

- All new user-facing copy passes YUMA (no forbidden phrases, no em dashes,
  no celebration language, no security theater)
- Fixed pre-existing "ensures" violation in README.md project description

---

## WHAT REMAINS TO BUILD

All remaining work is documented in: **D:\Projects\TRACE\docs\FEATURE_DESIGN.md** (927 lines)

### Phase 1: Schema + API Foundations — COMPLETE
- All tables, columns, migration, seed, and API endpoints shipped.

### Phase 2: Reporter Plate Lookup (HIGHEST VALUE)
- Two-tier lookup: Tier 1 = TRACE database, Tier 2 = CarAPI (if configured)
- Reporter enters plate → immediate response:
  - TRACKED: amber card with photo + make/model + operator tag
  - FOUND (CarAPI): neutral card with make/model/year/color
  - NOT FOUND: muted "no record" message
- Auto-check fires during sighting submission (passive)
- Standalone "Quick Lookup" button on Report page (active)
- Reporter sees truncated response; operator gets full API data
- Plate mismatch detection (reporter sees Honda, plate says Toyota = intelligence)
- CarAPI integration: ~$0.30/lookup, REST API, plate+state → VIN → vehicle details
- GET /api/v1/plates/lookup?plate=X&state=Y endpoint

### Phase 3: Reporter Harassment Reporting
- New "Alert" tab in reporter bottom nav (5th tab, icon: alert-triangle)
- Form: phone number, type (call/text/voicemail/in-person/other), description, evidence
- Evidence upload: screenshots, audio recordings (10MB max, 5 files max)
- History page enhanced with sub-tabs: "Sightings" | "Alerts"
- Tags and operator responses visible on both sightings and harassment reports
- POST /api/v1/harassment-reports endpoint

### Phase 4: Operator Harassment Review
- New "Harassment" sidebar section (between Dispatches and Vehicles)
- List/detail layout with evidence viewer (inline audio player, image viewer)
- If Spokeo configured: "Identify Caller" button → phone search → results inline
- Tag/response workflow that pushes back to reporter
- Quick lookup tool in section header (if Spokeo configured)
- Spokeo API: 300M+ US adults, phone/name/email/address/username search

### Phase 5: Integrations Framework
- Admin → Integrations tab
- Card layout: CarAPI, Spokeo (future: Bumper, others)
- API key field (encrypted at rest), Test Connection, toggle, usage counter
- Server-side proxy (keys never reach client)
- When disabled: lookup buttons don't appear, no errors, no nags

### Phase 6: Spokeo Connector
- Phone number lookup in harassment detail panel
- Results: name, age, address, carrier, line type, spam risk, social profiles
- Cached in database (no re-query on revisit)
- Spokeo API docs: https://docs.spokeo.com/
- Contact apisupport@spokeo.com for test key and pricing

### Phase 7: Intel Map Redesign (MAJOR)
- Full-bleed map (100% of content area, no scroll)
- Floating compact filter bar (top-left, semi-transparent)
- Floating action buttons (left side: Drop Pin, Add Corridor, Toggle Heatmap)
- Right-side sliding detail panel (340px, replaces bottom overlay)
- Bottom time scrubber (slim 40px bar, play/pause, draggable slider)
- Restyled layer control (dark bg, indigo checkmarks)
- Sighting density clusters at low zoom levels
- Dispatch radius circles on pin selection
- Stats badges (bottom-right)
- Keyboard shortcuts: P (pin), F (filter), Esc (close), Space (play/pause),
  ←→ (step time), 1/2/3 (tiles), L (layers)
- Design reference: Palantir Gotham, Kepler.gl, Felt.com

### Phase 8: Documentation Sweep
- README.md: add Integrations section
- CHAPTER_SETUP.md: add "Optional: Configure Integrations"
- guide.html: add FAQ entries for integrations
- Reporter onboarding: add "Report Harassment" slide
- Operator onboarding: add "Harassment Reports" and "Integrations" slides
- Operator guide modal: add Harassment and Integrations sections
- CONTRIBUTING.md: add integration architecture overview
- setup.sql: merge all new tables
- DEPENDENCIES.md: update blast radius graph
- DESIGN_SYSTEM.md: add tag color definitions

---

## CONFIRMED DESIGN DECISIONS

1. Harassment reports visible to ALL operators (not admin-only)
2. Reporters do NOT see which operator responded
3. Tags editable after initial response
4. "Alert" tab shows badge count for unread responses
5. Reporter plate lookup is TWO-TIER (TRACE DB first, then CarAPI)
6. Reporter sees truncated response; operator gets full API data
7. Max evidence: 10MB per file, 5 files per report
8. Intel Map detail panel overlays the map edge, not the sidebar
9. Everything works without API keys (zero-API mode is default)
10. Reporters don't interpret raw API reports; operators do

---

## KEY FILE MAP

```
D:\Projects\TRACE\
  docs/FEATURE_DESIGN.md         ← MASTER DESIGN DOC (927 lines, approved)
  docs/CHAPTER_SETUP.md          Detailed setup guide (updated: integrations, import)
  DESIGN_SYSTEM.md               Brand colors, typography, patterns (updated: tags, wordmark)
  VOICE_GUIDE.md                 Copy voice rules, forbidden patterns
  DEPENDENCIES.md                Blast radius graph
  CONTRIBUTING.md                Dev setup guide
  setup.sql                      Combined idempotent DB setup (updated: Phase 1 tables)
  README.md                      Primary docs with deploy button (updated: integrations, import)
  .env.neon                      Neon connection strings (gitignored)
  migrations/0005_phase1-*.sql   Phase 1 migration (new tables + columns)
  src/api/tags/index.ts          Tag definitions API (new)
  src/api/integrations/index.ts  Integrations API + helpers (new)
  src/api/import/index.ts        Data import API (new)
  src/services/import/clear-demo.ts  Demo data detection and removal (new)
  shared/design/wordmark.ts      Unified wordmark spec (updated)
  pwa/src/styles.css             Reporter CSS (updated: wordmark classes)
  pwa/src/components/pin-lock.tsx Reporter lock screen (updated: brand lockup)
  pwa/public/guide.html          Setup guide (updated: brand, scroll nav, step numbers)
  operator/src/lib/auth-gate.tsx  Operator login (updated: brand lockup)
  src/db/schema/vault-a.ts       Drizzle schema (updated: 5 new tables, 3 columns)
  src/db/seed.ts                 Demo data (updated: tag definitions)
  src/index.ts                   Server entry (updated: new route mounting)
```

---

## BUILD COMMANDS

```bash
# Local build
cd pwa && npx vite build && cd ..
cd operator && npx vite build && cd ..

# Deploy
git add -A && git commit -m "message" && git push
npx vercel --prod --yes

# Reseed Neon
npx tsx --env-file=.env.neon _clear_demo.ts
npx tsx --env-file=.env.neon src/db/seed.ts
```

---

## NOTES FOR NEXT SESSION

- Read FEATURE_DESIGN.md first. It's the blueprint. Build from it, don't redesign.
- The design doc has confirmed decisions in §10 and the revised plate lookup in §11.
- Build order is in §12. Start with Phase 1 (schema), then Phase 2 (plate lookup).
- The Intel Map redesign (Phase 7) is independent and can be done in any order.
- All API integrations are OPTIONAL. Test everything in zero-API mode first.
- Git config MUST stay as DK with noreply email or Vercel blocks deploys.
- Run voice/design checks before deploying (no em dashes, no cyan, no "designed to").
- The .env file points to local PostgreSQL. Use .env.neon for Neon operations.
- Spokeo test key: email apisupport@spokeo.com or call (888) 585-2370.
- CarAPI: sign up at carapi.app, free for development.


## BACKLOG — PRIORITIZED

### P0: Unified Incident System (CRITICAL — client-driven, real incident tonight)
Replaces the current flat sighting model with a full incident lifecycle.
Driven by real scenario: volunteers assaulted, 3 people kidnapped, multiple
actors and vehicles involved, evidence needed for court.

**Schema: `incident_types` table (chapter-configurable)**
Same pattern as vehicleTypes/dispatchEventTypes:
- Label, icon, color, sortOrder
- `defaultPriority`: routine | elevated | urgent | critical
- `autoDispatch`: boolean (triggers dispatch creation automatically)
- `requiresFields`: JSON array of required fields beyond base
- `notificationRule`: who gets alerted and how fast
- `lawEnforcementFlag`: boolean (auto-flags for LE notification)
- `evidenceRequired`: boolean (forces at least one attachment)
Default set per chapter: Surveillance, Following, Assault, Kidnapping/Abduction,
Property Crime, Harassment, Drug Activity, Trespassing. All customizable.

**Schema: `incidents` table (the core record)**
- `incidentTypeId` FK to chapter's incident types
- Location, timing, description (like sightings)
- `status`: open | documenting | under_review | closed | escalated_to_le
- `severity`: auto-set from type, operator-overridable
- Multi-actor links (M2M: `incident_actors`)
- Multi-vehicle links (M2M: `incident_vehicles`)
- Reporter who filed + optional "filed on behalf of" field

**Schema: `incident_evidence` table (timeline of attachments)**
- FK to incident
- `evidenceType`: photo | video | audio | document | text_note | medical_record
- `capturedAt`: when media was taken (EXIF or manual)
- `addedAt`: when it was uploaded to TRACE
- `caption`: description of what this evidence shows
- `phase`: during_incident | post_scene | follow_up | court_prep
- Storage: base64 initially, object storage later
- This is the TIMELINE — an incident grows over days/weeks

**Workflow: Live Capture (in-app)**
Reporter opens incident, camera rolls, media auto-tagged to that incident.
"Film directly from TRACE within a categorized incident."
Post-scene: reporter adds more details, follow-up photos, hospital records.
Incident stays open and accumulates evidence until operator closes it.

**Workflow: Public Incident Form (standalone URL)**
Shareable link that doesn't require TRACE login or app install.
Operator texts link to a witness or volunteer who isn't a TRACE user.
Form: type selector (checkbox/dropdown), what happened, when, where,
evidence upload, contact info (optional). Submits to chapter's TRACE.
"One link for all reporting" — no multiple URLs to memorize.
Designed for non-technical users ("old people who can barely use Signal").

**Workflow: Operator Manual Filing**
When someone calls in, operator fills the same form inside the console.
"Filed on behalf of" field records who reported verbally.
Same data, different entry point. Operator can also add evidence.

**Workflow: Cross-Pollination**
- Reporter portal: bottom nav "Report" opens incident form
- Operator console: "File Incident" button in sidebar + in harassment review
- Public URL: standalone, no auth required
- All three write to the same `incidents` table

**Migration path: sightings → incidents**
Sightings remain as-is for vehicle tracking (the core loop).
Incidents are a PARALLEL system for documenting harm.
A sighting can be LINKED to an incident ("this sighting is part of incident X").
Over time, the incident type taxonomy absorbs what sightings currently do.

### P1: Reporter Portal Design Refresh
- Settings page: grouped sections with visual hierarchy
- Submit page: modern card-based layout, micro-interactions
- Alert page: integrate with incident system, media upload
- All pages: elevated design matching operator console quality
- Bottom nav: subtle animations, incident reporting prominent

### P2: Donate Button
- Crypto wallet addresses (separate per project)
- Buried in reporter Settings + guide.html footer

### P3: Self-Hosting Path
- Dockerfile + docker-compose.yml
- Self-host guide appendix for chapters with own servers

### P4: Public Repo History Squash
- Periodic squash to clean public commit log
