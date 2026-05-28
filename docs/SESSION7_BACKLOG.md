# TRACE Session 7 Backlog
## Generated from client feedback + session work

---

## BUGS / POLISH (from this session)

### B1: Legend overlaps playbar on Activity Map
- **Status:** Open
- **Priority:** High
- **Details:** The floating legend panel covers the time playbar at the bottom of the map. Needs CSS positioning fix - legend should sit above the playbar with clear spacing.

### B2: Map detail drawer cards default to collapsed
- **Status:** Open
- **Priority:** High
- **Details:** When clicking a sighting marker, the detail cards in the drawer open collapsed. They should default to expanded so operators see the info immediately without extra clicks.

### B3: Onboarding changes not deploying
- **Status:** Open
- **Priority:** Medium
- **Details:** Changes to operator-onboarding.tsx (mentioning Node Settings) committed but may not be rendering. Verify the "Try it out" step references Node Settings (key 0). May be a caching issue on client side.

### B4: Node Settings page needs layman language
- **Status:** Open
- **Priority:** High
- **Details:** Current copy uses technical language. Needs a plain-language pass across all 7 tabs. Frame everything by consequence ("if someone takes this device, can they read it?") not technology ("enable LUKS full-disk encryption").

---

## CLIENT FEATURE REQUESTS

### F1: Vehicle multi-photo support
- **Status:** Backlog
- **Priority:** High
- **Source:** Client feedback
- **Details:** Vehicles currently have a single banner photo. Need square thumbnails with ability to upload multiple photos, same pattern as actors page. Use case: plates change, vehicles get dings/damage that helps identification, different angles needed for field reporters.
- **Implementation:** Mirror the actors photo gallery pattern. Each photo gets a timestamp and optional note ("new plate as of March", "dent on rear driver side", "tinted windows added").

### F2: Vehicle co-occurrence rolling report
- **Status:** Backlog
- **Priority:** High
- **Source:** Client feedback
- **Details:** "Is there a way to pull data on what vehicles are spotted together and how often? Like a rolling report of how many times the same vehicles are seen in an area within 2 weeks."
- **Implementation:** Query sighting data for vehicle pairs appearing within X meters and Y minutes of each other within a rolling window. Surface as a table or panel: "Vehicle A and Vehicle B seen together 4 times in last 14 days at these locations." Could live as a tab on vehicle records ("Frequently seen with") and/or as a report in Activity Map.
- **Convergence map:** This is the LANTERN autonomous pattern discovery + co-occurrence zone engine applied as a report.

### F3: Vehicle behavior / pattern report
- **Status:** Backlog
- **Priority:** High
- **Source:** Client feedback
- **Details:** Client described exact format: "Vehicle 1,3,4 has been seen on Wilbur Rd. 4 times in 2 weeks on 1/2/24, 1/4/24, 1/6/24, 1/8/24 - 3 times between 7am-8am and 1 time between 5-6am."
- **Implementation:** Group sightings by vehicle + area within a date range, surface time-of-day patterns. Output as a structured report. Lives as a tab on vehicle record ("Activity patterns") or as a standalone report page operators can run against any road/intersection/drawn area.
- **Convergence map:** This is the Pattern Learner engine - vehicle behavioral fingerprinting that persists across plate changes.

### F4: Reopen closed/expired dispatches
- **Status:** Backlog
- **Priority:** Medium
- **Source:** Client feedback
- **Details:** Currently closed and expired dispatches are terminal states. Need a "Reopen" button that flips status back to active.
- **Implementation:** Add reopen button to PinDetailPanel for closed/expired pins. API endpoint: PATCH /dispatches/:id/reopen. ~20 minute fix.

### F5: Watchpoints / hotspot bookmarks
- **Status:** Backlog
- **Priority:** High
- **Source:** Client feedback
- **Details:** Chapters have known hotspots (specific apartment complexes) where vehicles regularly appear. Need saved locations ("watchpoints") that operators can click to instantly see all vehicles sighted nearby and one-click dispatch without retyping addresses.
- **Implementation:**
  - New table: watchpoints (id, name, lat, lng, radius, chapterId, createdAt)
  - Persistent markers on Activity Map as a distinct layer
  - Click a watchpoint: panel shows all vehicles sighted in zone ranked by frequency, rolling activity summary, one-click "dispatch here" with auto-filled address
  - Dashboard integration: "Oak Ridge: 12 sightings this week (up from 4)" as quick status
  - Operators create by right-clicking map and selecting "Save as watchpoint" or drawing a zone

---

## SESSION 7 ARCHITECTURE WORK (completed)

### A1: Sovereign mesh architecture design
- **Status:** Complete (design)
- **Details:** Every chapter is a sovereign node. One binary, same software everywhere. Sharing via encrypted .trace files over any transport. No central database, no hub. File-based sync is the protocol.
- **Artifacts:** TRACE_NODE_CONFIG_MENU.md, docs/NODE_CONFIGURATION.md

### A2: Node Settings page
- **Status:** Deployed
- **Details:** 7-tab settings page in operator console. Status, Reporters, Security, Intelligence, Peers, Backup, Setup Guide. Handoff banner for admin transitions.
- **Files:** operator/src/pages/node-settings.tsx, added to app.tsx nav

### A3: Setup wizard prototype
- **Status:** Complete (design)
- **Details:** Three-path onboarding: "Get me running" (2 min), "Guide me through it" (10-15 min), "Show me everything" (full config). Interactive prototype created in session.

### A4: Security surface map
- **Status:** Complete (design)
- **Details:** Full threat model + attack surfaces by tier. 23 options across 6 categories with full transparency on pros/cons/cost/labor.

### A5: Local AI options spec
- **Status:** Complete (design)
- **Details:** Ollama integration path. 4 model tiers (8B/14B/24B/70B) with hardware requirements. Hybrid mode (local + cloud fallback). No-AI baseline.

### A6: Guide.html updated
- **Status:** Deployed
- **Details:** "What's Next" section added with Node Settings overview and sovereign deployment preview. Scroll nav dot added. YUMA updated to 85 checks.

### A7: Operator onboarding + quick tour updated
- **Status:** Deployed
- **Details:** "Try it out" step mentions Node Settings. Quick tour overlay includes Node Settings section.

### A8: New icons added
- **Status:** Deployed
- **Details:** cpu, hard-drive, monitor, cloud, wifi, file, git-merge added to shared/design/icons.ts.

---

## SESSION 7 HANDOFF PRIORITIES NOT YET STARTED

### P2: ConfirmedVehicles importer
- **Status:** Not started
- **Details:** Build import pipeline using ConfirmedVehicles_1.xlsx (139 vehicles, cleanest file). Implements Greg Gate row classification, Tribunal-lite validation, TESSRYX provenance, preview table UI.
- **File:** D:\Downloads\ConfirmedVehicles_1.xlsx

### P3: UI polish
- **Status:** Partial (some items addressed)
- **Details:** Activity Zone view expansion, admin pages design polish, reporter harassment evidence files metadata (server-side file handling).

---

## MAP LAYER DEFINITIONS (for docs/UI)

These descriptions should be used in tooltips, help text, and any user-facing documentation:

- **Sighting:** One reporter saw one vehicle at one location. A single data point from the field.
- **Activity cluster:** Multiple sightings near the same spot. Reveals staging areas and repeat locations that individual dots miss.
- **Heatmap density:** Color gradient showing where activity concentrates across the whole map. Hot = busy, cold = quiet. The 10-second glance that tells you which neighborhoods are active.
- **Dispatch pin:** Operator-placed "go here" marker. Tells field reporters where to respond.
- **Corridor:** A vehicle's path drawn as a line connecting its sightings in order. Shows route patterns and predictable movements.
- **Co-occurrence:** Dashed circle marking where two different vehicles showed up near each other within a short time window. Reveals which vehicles operate together.
- **Highlighted:** Emphasis layer. When you select a specific vehicle, its sightings pop visually against everything else. A spotlight, not a data type.
