# TRACE Session 8 → Session 9 Handoff

## SESSION 8 SUMMARY
Watchpoints UI (full stack), vehicle groups in dispatch form, vehicle multi-photo system (full stack), YUMA updated to 90 checks.

## WHAT SHIPPED

### P1: Watchpoints UI on Activity Map — COMPLETE
Full watchpoint system on the Activity Map:
- **Map layer**: Purple circle markers (⭐) with dashed radius rings, in Leaflet layer control
- **Right-click context menu**: Replaced single "drop pin" with two-choice menu → "Drop dispatch pin" or "Save as watchpoint"
- **Watchpoint creation form**: Name, address, city group, radius slider (50-1000m), coordinate display
- **Watchpoint activity panel**: Click a watchpoint → right-side panel loads vehicle activity via GET /watchpoints/:id/activity, shows ranked vehicle list (plate, color/make, sighting count, last seen date), "Dispatch here" and "Delete" buttons
- **Legend updated**: Watchpoint entry with purple circle icon and tooltip
- **Hint text updated**: "Right-click map for pin or watchpoint"
- **Dispatch form city-grouped picker**: Watchpoint quick-fill buttons organized by city group in dispatch creation form
- Files: operator/src/components/map-view.tsx (Watchpoint type, layer, context menu, rendering), operator/src/pages/intelligence.tsx (state, loading, panels, forms, legend)

### P2: Vehicle Groups in Dispatch Form — COMPLETE
- **Vehicle picker dropdown**: Individual vehicle picker alongside group picker in dispatch creation form
- **Group picker**: Select a group → fills plate field with first member plate, fills notes with "Group: [name] ([plates])"
- **Shows member count** in dropdown options
- Files: operator/src/pages/intelligence.tsx (PinCreationForm updated)

### P3: Vehicle Multi-Photo — COMPLETE (pending migration apply)
Full stack mirroring actorPhotos pattern:
- **Schema**: `vehiclePhotos` table in vault-a.ts (id, vehicleId, photoUrl, description, isPrimary, createdAt)
- **Migration**: 0009_vehicle-photos.sql (CREATE TABLE + index, NOT YET APPLIED TO PRODUCTION)
- **API**: Full CRUD at /vehicle-photos/:vehicleId
  - GET /:vehicleId — list all photos
  - POST /:vehicleId — add photo (auto-sets primary if first, syncs vehicle banner)
  - PATCH /:vehicleId/:photoId — update description, set primary (syncs banner)
  - DELETE /:vehicleId/:photoId — delete (promotes next photo or clears banner if was primary)
- **Entry points**: Both src/index.ts and api/index.ts updated in sync
- **API client**: getVehiclePhotos, addVehiclePhoto, updateVehiclePhoto, deleteVehiclePhoto
- **UI**: Square thumbnail grid replaced single banner photo on vehicle record
  - Grid with auto-fill columns (min 80px)
  - PRIMARY badge on primary photo (accent border)
  - Description overlay on each photo
  - Hover actions: ★ set as primary, ✕ delete (with confirmation)
  - "+ Add Photo" button, empty state with camera icon
- Files: src/db/schema/vault-a.ts, src/api/vehicle-photos/index.ts (new), operator/src/pages/vehicles.tsx

### YUMA Updated
- Added vehicle-groups, watchpoints, vehicle-photos, reports to structure checks
- Test count: 87 → 91 checks
- File: tests/yuma.py

### P5: Vehicle Behavior Report — COMPLETE
Client format: "Vehicle ABC seen on Wilbur Rd 4 times in 2 weeks, 3 times 7-8am"
- **Service**: `getBehaviorReport()` in geospatial.ts — groups sightings by vehicle + location cluster, surfaces time-of-day patterns
- **API**: GET /geo/behavior-report?start=&end=&vehicleId=
- **Reports page**: New operator page with tabbed UI (Behavior | Co-occurrence)
- **UI**: Date range selector, vehicle filter, vehicle cards with location clusters, time-of-day badges
- Files: src/services/geospatial.ts, src/api/geo/index.ts, operator/src/pages/reports.tsx (new)

### P6: Co-occurrence Rolling Report — COMPLETE
"Which vehicles are seen together within 2 weeks?"
- **Service**: `getCoOccurrenceReport()` in geospatial.ts — finds vehicle pairs within distance/time windows
- **API**: GET /geo/co-occurrence-report?start=&end=&distance=&timeWindow=
- **UI**: Vehicle pair cards with encounter counts, date ranges, location counts, high-encounter highlighting (4+)
- Files: src/services/geospatial.ts, src/api/geo/index.ts, operator/src/pages/reports.tsx

### P4: Burst Capture Review/Tagging — COMPLETE
- **API**: PATCH /sightings/:id — general metadata update endpoint for burst tagging
- **PWA**: Burst tab added to History page with tagged/untagged counters
- **BurstReviewCard**: Tap to tag with plate + description, save via PATCH
- Files: src/api/sightings/index.ts, pwa/src/pages/history.tsx

### Reports Page — NEW
- New page in operator nav: "Reports" with file-text icon
- Two tabs: Vehicle Behavior (P5) and Co-occurrence (P6)
- Lazy-loaded, added to app routing and nav
- Files: operator/src/pages/reports.tsx (new), operator/src/app.tsx

### Support TRACE (Donate Button)
- **Icon**: heart icon added to icon set (52nd icon)
- **Sidebar**: "Support TRACE" link between Report Bug and Sign Out
- **guide.html**: Full #support section with indie story copy, BTC donation card with click-to-copy, scroll nav dot
- **BTC address**: Stubbed as `bc1q_setup_pending` — replace when wallet is set up
- Files: shared/design/icons.ts, operator/src/app.tsx, pwa/public/guide.html

### Database Changes
- **Migration 0009** (NOT YET APPLIED): ops.vehicle_photos table
- Migration 0008 was applied in session 7 (vehicle_groups, vehicle_group_members, watchpoints)

## BEFORE DEPLOYING
1. Apply migration 0009: `psql $DATABASE_URL -f migrations/0009_vehicle-photos.sql`
2. Run YUMA: `python tests/yuma.py` (target: 91/91)
3. Build operator: `cd operator && npm run build`
4. Deploy: `deploy.bat`

## SESSION 9 PRIORITIES

### P1: ConfirmedVehicles Importer
File: D:\Downloads\ConfirmedVehicles_1.xlsx (139 vehicles)
Build import pipeline with Greg Gate row classification, Tribunal-lite validation, preview table UI.

### P2: Vehicle Photos in Map Drawer
When clicking a sighting marker → vehicle card shows, add photo gallery from vehicle-photos API.

### P3: Burst Capture Photo Display
Burst captures have photos but the review cards don't show them yet. Wire sighting photos into the BurstReviewCard.

### P4: Onboarding Deploy Fix (B3 from Session 7)
Changes to operator-onboarding.tsx (Node Settings reference) may not be rendering. Verify.

### P5: Dashboard Watchpoint Widget
"Oak Ridge: 12 sightings this week (up from 4)" — surface watchpoint activity on the dashboard.

### P6: Reports — Export to Text
Client wants copy-pasteable report text. Add "Copy as text" button to behavior report that formats as the exact client format.

### P7: Node Settings Layman Language Pass
Minor copy refinements. The current copy is already consequence-framed — some technical details could be softened further.

## CRITICAL RULES (carry forward)
1. Two entry points MUST stay in sync: src/index.ts and api/index.ts
2. Toast API: toast("msg", "type") not toast.success()
3. YUMA runs before every deploy: python tests/yuma.py (must be 91/91)
4. ALWAYS read_file before write_file on ANY existing path
5. DO NOT overwrite guide.html or favicon.svg
6. guide.html source of truth is pwa/public/guide.html (NOT public/guide.html - build copies it)
7. No Simi Valley coordinates (use McLean VA: ~38.93-38.95, ~-77.17 to -77.20)
8. Schema column: sightings.triaged (boolean), NOT triageStatus
9. Schema column: actorIdentifiers.identifierTypeId, NOT typeId
10. PowerShell uses ; not && for command chaining
11. vehicleConcernHistory has changedByRole (required), no changedAt field
12. Pexels API key EXPIRED (403). Unsplash key WORKS: 4X1wlNJKXv9gno0vjIzjoD6FfVAI0x85dKXexlhfDE8
13. Windows cmd splits commit messages at spaces - use hyphenated messages
14. Tooltip component uses position:fixed with getBoundingClientRect (not absolute)

## KEY FILE PATHS (updated)
| File | Purpose |
|------|---------|
| operator/src/pages/node-settings.tsx | Node Settings page |
| operator/src/pages/vehicles.tsx | Vehicles page with Groups tab + photo gallery |
| operator/src/pages/intelligence.tsx | Activity Map + watchpoints + legend + drawer |
| operator/src/pages/dashboard.tsx | Dashboard with nav stat cards |
| operator/src/pages/harassment.tsx | Harassment reporting |
| operator/src/components/map-view.tsx | Leaflet map component (now with watchpoints layer + context menu) |
| operator/src/components/ux/tooltip.tsx | Fixed-position tooltip |
| operator/src/components/operator-onboarding.tsx | First-time walkthrough |
| operator/src/app.tsx | Main app, nav, routing, trace-navigate listener |
| operator/src/lib/api.ts | Operator API client (groups + watchpoints + vehicle-photos) |
| pwa/src/pages/burst.tsx | Burst capture mode |
| pwa/src/app.tsx | Reporter PWA app with burst button |
| pwa/public/guide.html | Setup guide (source of truth) |
| shared/design/icons.ts | SVG icon library (51+ icons) |
| src/db/schema/vault-a.ts | Operational schema (820+ lines, includes vehiclePhotos) |
| src/api/vehicle-groups/index.ts | Vehicle Groups API |
| src/api/watchpoints/index.ts | Watchpoints API |
| src/api/vehicle-photos/index.ts | Vehicle Photos API (NEW) |
| src/api/vehicles/index.ts | Vehicle API |
| src/index.ts | Server entry point |
| api/index.ts | Vercel serverless entry point |
| migrations/0008_vehicle-groups-watchpoints.sql | Session 7 migration (applied) |
| migrations/0009_vehicle-photos.sql | Session 8 migration (NOT YET APPLIED) |
| docs/SESSION7_BACKLOG.md | Full backlog with client feedback |
| docs/PORTFOLIO_CONVERGENCE.md | 38-engine convergence map |
| tests/yuma.py | YUMA gate (90 checks) |

## CREDENTIALS
- Vercel: projectId prj_qvFAyYUjX246zdNX0wGtuOCz6gmZ, orgId team_3Bg0XHuxlkLx71xnTGn2G6PA
- Vercel token: see deploy.bat
- Operator login: callsign OPERATOR, accessCode trace2025
- Live: https://trace-jet.vercel.app
- GitHub: https://github.com/duke-of-beans/TRACE
