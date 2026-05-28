# TRACE Session 7 → Session 8 Handoff

## SESSION 7 SUMMARY
Architecture session covering sovereign mesh networking, local AI, security surfaces, Node Settings page, client feedback integration, and bug fixes.

## WHAT SHIPPED (deployed to https://trace-jet.vercel.app)

### New Features
- **Node Settings page** (operator/src/pages/node-settings.tsx) - 7-tab config page: Status, Reporters, Security, Intelligence, Peers, Backup, Setup Guide. Handoff banner for admin transitions. Keyboard shortcut: 0
- **7 new SVG icons** added to shared/design/icons.ts: cpu, hard-drive, monitor, cloud, wifi, file, git-merge
- **Reopen Dispatch button** on closed/expired dispatch pin detail panels
- **Map layer control** defaults to expanded (was collapsed)

### Bug Fixes
- **"Reported to LE"** changed to **"Reported"** across all harassment page instances
- **Legend position** pushed up to clear playbar (bottom: 64→80, z-index: 1000→999)
- **Legend tooltips** added with plain-language descriptions for each map layer

### Documentation
- **guide.html** - "What's Next" section added (sovereign deployment preview + Node Settings overview). New scroll nav dot. Source file is pwa/public/guide.html (NOT public/guide.html - the build copies it)
- **docs/NODE_CONFIGURATION.md** - Summary reference for all 23 deployment options
- **docs/SESSION7_BACKLOG.md** - Full backlog with client feedback, bug status, feature specs
- **Operator onboarding** - "Try it out" step references Node Settings
- **Quick tour overlay** - Node Settings section added
- **YUMA expanded** to 85 checks (added whats-next section validation)

### Architecture (designed, not yet built)
- Sovereign mesh architecture: one binary, SQLite inside, .trace files for sharing
- Technology stack: Tauri 2.x + SQLCipher + libsodium + Noise XK
- Setup wizard prototype (3 personas: organizer, privacy-motivated, tech person)
- Security surface map + threat model
- Local AI via Ollama (4 model tiers)
- Full configuration menu (23 options, 6 categories)

## WHAT SHIPS NEXT (Session 8 priorities)

### Priority 1: Vehicle Multi-Photo
Client requested. Actors already have actorPhotos table (line 278 of vault-a.ts). Mirror the pattern:

**Schema:**
```sql
CREATE TABLE ops.vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  evidence_id UUID,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vehicle_photos_vehicle ON ops.vehicle_photos(vehicle_id);
```

**API endpoints needed:**
- GET /vehicles/:id/photos - list photos
- POST /vehicles/:id/photos - upload (base64 body)
- DELETE /vehicles/:id/photos/:photoId - remove
- PATCH /vehicles/:id/photos/:photoId - update description, set primary

**UI changes:**
- Vehicles page: replace banner photo with square thumbnail grid (mirror actors pattern)
- Map drawer: show photo grid instead of single image
- Each photo: timestamp, optional note field

### Priority 2: Watchpoints / Hotspot Bookmarks (F5)
Client requested. Chapters have known hotspots (apartment complexes) where vehicles regularly appear.

**Schema:**
```sql
CREATE TABLE ops.watchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  name VARCHAR(128) NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_meters INTEGER DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Implementation:**
- New map layer with persistent markers
- Right-click map → "Save as watchpoint"
- Click watchpoint → panel with: vehicles sighted in zone, rolling activity, one-click dispatch
- Dashboard widget: watchpoint activity summary

### Priority 3: Vehicle Behavior Report (F3)
Client described exact format: "Vehicle 1,3,4 has been seen on Wilbur Rd. 4 times in 2 weeks..."

**Query pattern:**
```sql
SELECT v.plate, s.lat, s.lng, s.observed_at,
  EXTRACT(HOUR FROM s.observed_at) as hour
FROM sightings s
JOIN vehicles v ON s.vehicle_id = v.id
WHERE ST_DWithin(...) AND s.observed_at > NOW() - INTERVAL '14 days'
GROUP BY v.plate, DATE(s.observed_at)
ORDER BY count DESC;
```

### Priority 4: Co-occurrence Rolling Report (F2)
"Which vehicles keep showing up together over a 2-week window?"

### Priority 5: Node Settings Layman Language Pass (B4)

### Priority 6: ConfirmedVehicles Importer (from Session 6)
File: D:\Downloads\ConfirmedVehicles_1.xlsx (139 vehicles)

## REMAINING BUGS
- B3: Verify onboarding changes render (may be client-side cache)
- B4: Node Settings layman language pass needed

## CRITICAL RULES (carry forward)
1. Two entry points MUST stay in sync: src/index.ts and api/index.ts
2. Toast API: toast("msg", "type") not toast.success()
3. YUMA runs before every deploy: python tests/yuma.py (must be 85/85)
4. ALWAYS read_file before write_file on ANY existing path
5. DO NOT overwrite guide.html or favicon.svg
6. guide.html source of truth is pwa/public/guide.html (NOT public/guide.html)
7. No Simi Valley coordinates (use McLean VA: ~38.93-38.95, ~-77.17 to -77.20)
8. Schema column: sightings.triaged (boolean), NOT triageStatus
9. Schema column: actorIdentifiers.identifierTypeId, NOT typeId
10. PowerShell uses ; not && for command chaining
11. vehicleConcernHistory has changedByRole (required), no changedAt field
12. Pexels API key EXPIRED (403). Unsplash key WORKS: 4X1wlNJKXv9gno0vjIzjoD6FfVAI0x85dKXexlhfDE8
13. Windows cmd splits commit messages at spaces - use single-word or hyphenated messages

## KEY FILE PATHS
| File | Purpose |
|------|---------|
| operator/src/pages/node-settings.tsx | Node Settings page (new this session) |
| operator/src/pages/intelligence.tsx | Activity Map + legend + drawer |
| operator/src/components/map-view.tsx | Leaflet map component |
| operator/src/pages/harassment.tsx | Harassment reporting |
| operator/src/components/operator-onboarding.tsx | First-time operator walkthrough |
| operator/src/app.tsx | Main app with nav and routing |
| pwa/public/guide.html | Setup guide (source of truth) |
| shared/design/icons.ts | SVG icon library (51+ icons) |
| src/db/schema/vault-a.ts | Operational schema (766 lines) |
| src/api/vehicles/index.ts | Vehicle API |
| src/api/actors/index.ts | Actor API |
| docs/SESSION7_BACKLOG.md | Full backlog with client feedback |
| docs/NODE_CONFIGURATION.md | Deployment options reference |
| docs/PORTFOLIO_CONVERGENCE.md | 38-engine convergence map |
| tests/yuma.py | YUMA gate (85 checks) |

## MAP LAYER DEFINITIONS (for UI tooltips/docs)
- **Sighting:** One reporter saw one vehicle at one location
- **Activity cluster:** Multiple sightings near the same spot - reveals staging areas
- **Heatmap density:** Color gradient showing activity concentration - hot = busy, cold = quiet
- **Dispatch pin:** Operator-placed "go here" marker for field reporters
- **Corridor:** Vehicle path connecting sightings in order - shows route patterns
- **Co-occurrence:** Where two vehicles appeared near each other within a short time
- **Highlighted:** Spotlight layer when filtering to a specific vehicle

## CREDENTIALS
- Vercel: projectId prj_qvFAyYUjX246zdNX0wGtuOCz6gmZ, orgId team_3Bg0XHuxlkLx71xnTGn2G6PA
- Vercel token: [REDACTED - see deploy.bat or ask David]
- Operator login: callsign OPERATOR, accessCode trace2025
- Live: https://trace-jet.vercel.app
- GitHub: https://github.com/duke-of-beans/TRACE
