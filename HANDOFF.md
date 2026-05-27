# TRACE — Session Handoff
# Updated: 2026-05-26
# Status: DESIGN APPROVED, READY TO BUILD

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

### Guide.html
- YUMA audit: fixed pooled connection string instruction, GitHub copy button location,
  placeholder URL clarity, bootstrap recovery FAQ, update instructions FAQ
- Added theme toggle (moon/sun, top-right, persists to localStorage)
- WCAG fix: --text-muted bumped to #7C8BA4 (4.7:1 contrast)
- Exo 2 font imported for all TRACE wordmarks (hero, footer, mockups)

### Reporter App (PWA)
- Fixed false wipe on fresh install: isWiped() now checks for prior setup evidence
- panic() sets trace_wiped flag that survives localStorage.clear()
- Background lock grace period increased from 30s to 5 minutes
- Onboarding redesigned: visual-first cards, icon circles, punchy 2-sentence copy,
  expandable "Technical details", pill-shaped progress dots, pinned Continue button
- Added "Something Not Working?" onboarding slide with GitHub Issues link

### Operator Console
- Guide modal z-index fixed to 9999 (was z-50, Leaflet uses 1000+)
- Onboarding redesigned: same visual system as reporter, 8 slides
- Added "Reporting Issues" to onboarding + operator guide
- Intel Map: detail panels now render as overlays ON the map (not below it)
- Intel Map: Drop Pin button floats on the map (top-left, near zoom controls)
- Intel Map: dispatch pins use tooltip (hover) instead of popup (click)
- Intel Map: sighting markers increased to 9px radius, color fixed to indigo
- Intel Map: map height increased to calc(100vh - 220px)
- Intel Map: tile toggle fixed from cyan to indigo
- IntelMap component accepts children prop for overlay content

### Data & Coordinates
- Default map center moved to McLean, VA (38.9310, -77.1770)
- All demo sightings moved to McLean residential streets
- Old Simi Valley sightings cleared from Neon via _clear_demo.ts
- Reseeded with Langley-area coordinates

### Repo Cleanup
- PDFs deleted (TRACE_Chapter_Setup_Guide.pdf, TRACE_Dispatch_Design.pdf, TRACE_Overview.pdf)
- .env.neon and utility scripts (_check.py, _clear_demo.ts, etc.) removed from git, gitignored
- GitHub repo confirmed PUBLIC (required for deploy button flow)

---

## WHAT REMAINS TO BUILD

All remaining work is documented in: **D:\Projects\TRACE\docs\FEATURE_DESIGN.md** (813 lines)

### Phase 1: Schema + API Foundations
- New tables: harassment_reports, integration_config, tag_definitions, vehicle_enrichments
- Add operator_tag, operator_response, operator_responded_at columns to sightings
- Update setup.sql with all new tables
- Seed default tag definitions per chapter

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
  docs/FEATURE_DESIGN.md         ← MASTER DESIGN DOC (813 lines, approved)
  docs/CHAPTER_SETUP.md          Detailed setup guide
  DESIGN_SYSTEM.md               Brand colors, typography, patterns
  VOICE_GUIDE.md                 Copy voice rules, forbidden patterns
  DEPENDENCIES.md                Blast radius graph
  CONTRIBUTING.md                Dev setup guide
  setup.sql                      Combined idempotent DB setup
  README.md                      Primary docs with deploy button
  .env.neon                      Neon connection strings (gitignored)
  pwa/public/guide.html          Visual setup guide (Exo 2, theme toggle)
  pwa/src/components/onboarding.tsx  Reporter onboarding (redesigned)
  pwa/src/lib/panic.ts           Wipe logic (fixed false wipe)
  pwa/src/lib/app-lock.ts        Auto-lock (5min grace period)
  operator/src/components/operator-onboarding.tsx  Operator onboarding (redesigned)
  operator/src/components/map-view.tsx  IntelMap (children prop, indigo markers)
  operator/src/pages/intelligence.tsx   Intel Map page (overlay panels, floating pin)
  operator/src/app.tsx            Guide modal (z-index 9999)
  operator/src/lib/auth-gate.tsx  Login (Exo 2 wordmark)
  src/db/seed.ts                  Demo data (McLean, VA coordinates)
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
