# TRACE Session 8 → Session 9 Handoff

## SESSION 8 COMPLETE
Massive build session. 40+ deliverables across full stack. 8 production deploys. YUMA 87 → 93.

## PRODUCTION STATE
- **URL:** https://trace-jet.vercel.app
- **Git:** github.com/duke-of-beans/TRACE (0cb2c43)
- **YUMA:** 93/93
- **Migration 0009:** Applied to production
- **BTC wallet:** Live (bc1q4aj0udelsh57z860phkm8urqs2rjpfkhkpnmhn)

## WHAT SHIPPED (Session 8)

### Full Stack Features
- **Watchpoints** — Map layer, context menu, creation form, activity panel, dashboard widget, map stats badge
- **Vehicle Multi-Photo** — Schema, migration 0009, API CRUD, gallery UI with primary/delete
- **Burst Capture Review** — PATCH endpoint, PWA History burst tab, photo thumbnails, dashboard alert
- **Vehicle Behavior Report** — Clustering service, API, Reports page UI, copy as text
- **Co-occurrence Report** — Pair detection service, API, Reports page UI, copy as text
- **Reports Page** — New operator page, two tabs, date range + vehicle filters, lazy-loaded

### UI Enrichment
- Vehicle record: Activity Patterns + Frequently Seen With sections
- Dashboard: Watchpoint activity widget + burst untagged alert banner
- Activity Map: Collapsible filter panel (time, vehicle, concern level, dispatches, actors)
- Activity Map: Watchpoint count badge on stats bar
- Quick tour updated with all new features

### Import Pipeline
- Sheet picker for multi-sheet Excel files
- Smart sheet dimming (metadata sheets faded)
- Column mapping display + sample row preview
- Global best-match mapper algorithm
- "Most recent" plate preference for ConfirmedVehicles format

### Design Language: Line + Dot
Applied to every TRACE wordmark (12 surfaces):
- guide.html hero + footer + step dividers
- docs.html hero + step dividers
- Operator sidebar, login, setup screens
- PWA PIN setup + lock screens
- Reporter + operator onboarding tutorials
- TraceLoader animation (Suspense fallback)
- Map corridor endpoints (faded origin → trace dot terminus)
- Scroll nav synced (docs.html matched to guide.html)

### Copy & Onboarding Polish
- Node Settings: 12 jargon fixes (layman language pass)
- Operator onboarding: Restructured 10 steps (added Activity Map, Reports, vehicle enrichment)
- Reporter onboarding: Added burst capture step, cleaned technical jargon

### Infrastructure
- BTC wallet live (DCS1 for TRACE, DCS2 for Tranche held)
- Migration 0009 applied via Node.js script
- Support TRACE section with donate copy + BTC click-to-copy
- Heart + filter icons added (54 total)

## SESSION 9 PRIORITIES

### P1: Security — Disable Screenshot/Copy/Highlight
Prevent text selection, copying, and screenshots within TRACE on both PWA and operator console. CSS user-select:none, context menu prevention, and platform-specific screenshot blocking where possible. Critical for protecting reporter data and sighting content from casual exfiltration.

### P2: Operator Guide — Complete Usage Documentation
Enhance the existing docs.html (operator guide) into a comprehensive usage manual covering all features: triage workflow, Activity Map (filters, watchpoints, corridors, time slider), vehicle/actor management, reports, dispatch system, import pipeline, harassment review, admin configuration. Written for non-technical operators.

### P3: Reporter Guide — Create Field Manual
New HTML page (or section in guide.html) covering reporter daily workflow: submitting sightings, burst capture mode, photo best practices, tagging from history, harassment reporting, offline mode, emergency wipe, check-in system. Written for field reporters who may have minimal tech experience.

### P4: ConfirmedVehicles Import
Pipeline ready. Upload through Admin → Import → Select "ICE Raid Vehicles" sheet → Preview → Import.

## CRITICAL RULES (carry forward)
1. Two entry points MUST stay in sync: src/index.ts and api/index.ts
2. Toast API: toast("msg", "type") not toast.success()
3. YUMA: python tests/yuma.py must be 93/93
4. ALWAYS read_file before write_file on ANY existing path
5. DO NOT overwrite guide.html or favicon.svg
6. guide.html source of truth is pwa/public/guide.html (NOT public/guide.html)
7. docs.html source of truth is pwa/public/docs.html (NOT public/docs.html)
8. public/ is gitignored — edit pwa/public/ for static HTML files
9. No Simi Valley coordinates (use McLean VA)
10. PowerShell uses ; not && for command chaining
11. Windows cmd splits commit messages at spaces — use hyphenated
12. Tooltip uses position:fixed with getBoundingClientRect
13. Unsplash key: 4X1wlNJKXv9gno0vjIzjoD6FfVAI0x85dKXexlhfDE8

## WALLET ADDRESSES
- TRACE (DCS1): bc1q4aj0udelsh57z860phkm8urqs2rjpfkhkpnmhn
- Tranche (DCS2): bc1qq0a7wlnepq34lnzkw7qtzat8ge6s6c3m7l9625

## CREDENTIALS
- Operator login: callsign OPERATOR, accessCode trace2025
- Live: https://trace-jet.vercel.app
- GitHub: https://github.com/duke-of-beans/TRACE
