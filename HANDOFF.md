# TRACE Session 7 → Session 8 Handoff

## SESSION 7 SUMMARY
Architecture + build marathon. Sovereign mesh design, Node Settings page, burst capture mode, vehicle groups, watchpoints, 11 production deploys, YUMA at 87 checks.

## WHAT SHIPPED (deployed to https://trace-jet.vercel.app)

### New Features
- **Node Settings page** (operator/src/pages/node-settings.tsx) - 7-tab config: Status, Reporters, Security, Intelligence, Peers, Backup, Setup Guide. Keyboard shortcut: 0
- **Burst Capture mode** (pwa/src/pages/burst.tsx) - Rapid-fire photo collection for field events. Red floating button on reporter PWA. Tap=photo, immediate encrypted upload, auto-purge on sync, continuous GPS, EXIF scrub, phone-seizure resilient
- **Vehicle Groups** - Full stack: schema + migration + API + UI. Operators create named groups, add/remove vehicles, view members. Toggle between All Vehicles and Groups on Vehicles page
- **Watchpoints API** - Schema + migration + API for saved hotspot locations with city grouping and activity queries. UI build is next session
- **Reopen Dispatch** button on closed/expired dispatch pins
- **Dashboard nav buttons** - All 5 stat cards clickable, navigate to respective pages
- **Cross-page navigation** - trace-navigate custom event listener added to App (was dispatched but never listened to)
- **7 new SVG icons**: cpu, hard-drive, monitor, cloud, wifi, file, git-merge

### Bug Fixes
- **Tooltip clipping** - Switched from position:absolute to position:fixed with getBoundingClientRect. z-index 99999. No sidebar overflow/scrollbar issues
- **Legend overlaps playbar** - Bottom offset 64->80, z-index 1000->999
- **Legend tooltips** - Plain-language descriptions on hover for each map layer
- **Layer control** - Leaflet control defaults to expanded (was collapsed)
- **"Reported to LE"** changed to **"Reported"** everywhere in harassment page

### Documentation
- **guide.html** - "What's Next" section (sovereign deployment + Node Settings overview). Source: pwa/public/guide.html
- **docs/NODE_CONFIGURATION.md** - All 23 deployment options reference
- **docs/SESSION7_BACKLOG.md** - Full backlog with client feedback and implementation specs
- **Operator onboarding** - "Try it out" step references Node Settings
- **Quick tour overlay** - Node Settings section added
- **YUMA** expanded to 87 checks

### Database Changes (migration 0008, applied to production)
- `ops.vehicle_groups` (id, chapter_id, name, description, created_at)
- `ops.vehicle_group_members` (id, group_id, vehicle_id, added_at)
- `ops.watchpoints` (id, chapter_id, name, address, city_group, lat, lng, radius_meters, created_at)

### Architecture (designed, documented, not yet built)
- Sovereign mesh: one binary (Tauri), SQLite/SQLCipher, .trace encrypted files for sharing
- Technology stack: Tauri 2.x + SQLCipher + libsodium + Noise XK + Automerge 3
- Setup wizard: 3 personas (organizer, privacy-motivated, tech person)
- Security surface map: full threat model, 23 options across 6 categories
- Local AI: Ollama integration, 4 model tiers (8B/14B/24B/70B), hybrid mode
- Config menu: TRACE_NODE_CONFIG_MENU.md (delivered as downloadable file)

## SESSION 8 PRIORITIES

### P1: Watchpoints UI on Activity Map
API is live. Needs:
- Map layer with persistent watchpoint markers
- Right-click map -> "Save as watchpoint" with name/city/address form
- Click watchpoint -> panel showing vehicles sighted nearby (GET /watchpoints/:id/activity)
- City-grouped picker in dispatch creation form

### P2: Vehicle Groups in Dispatch Form
Groups exist. Wire them into the dispatch creation panel on Activity Map:
- Group picker dropdown alongside individual vehicle picker
- Select a group -> all member vehicles attach to dispatch
- Shows member count and plates in picker

### P3: Vehicle Multi-Photo
Client requested. Mirror actorPhotos pattern (line 278, vault-a.ts):
- Schema: vehicle_photos table
- API: CRUD endpoints
- UI: Square thumbnail grid on vehicle record (replace banner photo)
- Map drawer: show photo grid

### P4: Burst Capture Review/Tagging
Complete the burst feature:
- "Review burst" screen in PWA History page
- Grid of burst captures with upload status
- Tap to add: plate, description, vehicle association
- PATCH endpoint to update sighting metadata post-submission

### P5: Vehicle Behavior Report
Client format: "Vehicle 1,3,4 seen on Wilbur Rd 4 times in 2 weeks, 3 times 7-8am"

### P6: Co-occurrence Rolling Report
"Which vehicles are seen together within 2 weeks?"

### P7: Node Settings Layman Language Pass

### P8: ConfirmedVehicles Importer
File: D:\Downloads\ConfirmedVehicles_1.xlsx (139 vehicles)

## CRITICAL RULES (carry forward)
1. Two entry points MUST stay in sync: src/index.ts and api/index.ts
2. Toast API: toast("msg", "type") not toast.success()
3. YUMA runs before every deploy: python tests/yuma.py (must be 87/87)
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

## KEY FILE PATHS
| File | Purpose |
|------|---------|
| operator/src/pages/node-settings.tsx | Node Settings page |
| operator/src/pages/vehicles.tsx | Vehicles page with Groups tab |
| operator/src/pages/intelligence.tsx | Activity Map + legend + drawer |
| operator/src/pages/dashboard.tsx | Dashboard with nav stat cards |
| operator/src/pages/harassment.tsx | Harassment reporting |
| operator/src/components/map-view.tsx | Leaflet map component |
| operator/src/components/ux/tooltip.tsx | Fixed-position tooltip |
| operator/src/components/operator-onboarding.tsx | First-time walkthrough |
| operator/src/app.tsx | Main app, nav, routing, trace-navigate listener |
| operator/src/lib/api.ts | Operator API client (includes groups + watchpoints) |
| pwa/src/pages/burst.tsx | Burst capture mode |
| pwa/src/app.tsx | Reporter PWA app with burst button |
| pwa/public/guide.html | Setup guide (source of truth) |
| shared/design/icons.ts | SVG icon library (51+ icons) |
| src/db/schema/vault-a.ts | Operational schema (808 lines) |
| src/api/vehicle-groups/index.ts | Vehicle Groups API |
| src/api/watchpoints/index.ts | Watchpoints API |
| src/api/vehicles/index.ts | Vehicle API |
| src/index.ts | Server entry point |
| api/index.ts | Vercel serverless entry point |
| migrations/0008_vehicle-groups-watchpoints.sql | Latest migration (applied) |
| docs/SESSION7_BACKLOG.md | Full backlog with client feedback |
| docs/NODE_CONFIGURATION.md | Deployment options reference |
| docs/PORTFOLIO_CONVERGENCE.md | 38-engine convergence map |
| tests/yuma.py | YUMA gate (87 checks) |

## MAP LAYER DEFINITIONS (for UI tooltips/docs)
- **Sighting:** One reporter saw one vehicle at one location
- **Activity cluster:** Multiple sightings near the same spot - reveals staging areas
- **Heatmap density:** Color gradient showing activity concentration
- **Dispatch pin:** Operator-placed "go here" marker for field reporters
- **Corridor:** Vehicle path connecting sightings in order - route patterns
- **Co-occurrence:** Where two vehicles appeared near each other within a short time
- **Highlighted:** Spotlight layer when filtering to a specific vehicle

## CREDENTIALS
- Vercel: projectId prj_qvFAyYUjX246zdNX0wGtuOCz6gmZ, orgId team_3Bg0XHuxlkLx71xnTGn2G6PA
- Vercel token: see deploy.bat
- Operator login: callsign OPERATOR, accessCode trace2025
- Live: https://trace-jet.vercel.app
- GitHub: https://github.com/duke-of-beans/TRACE
