# TRACE — Feature Design: Integrations, Harassment Reporting, and Intel Map Redesign
# Status: DESIGN REVIEW — Do not build until approved
# Author: System design session, 2026-05-26

---

## 1. DESIGN PRINCIPLES

- The map is the workspace. Everything else serves it.
- No gross motor movements. Actions live where attention already is.
- Zero-API mode is the default. Every feature works without external services.
- Reporters see outcomes, not process. Tags and responses, not dashboards.
- Operators investigate, not administrate. Reduce clicks to insight.
- Information flows in both directions. Reporter → Operator → Reporter.

---

## 2. USER WORKFLOWS

### 2.1 Reporter: Submit a Sighting (enhanced)

CURRENT: Enter plate → location → description → photo → submit → done.

ENHANCED (no change to reporter experience):
- Reporter flow is identical. They submit a plate.
- Behind the scenes, if CarAPI is configured, the system auto-enriches:
  plate → VIN → year/make/model/color.
- Vehicle dossier auto-populates or updates.
- Operator triages with enriched data already visible.
- Operator adds a TAG (from a configurable set) and optional RESPONSE.
- Reporter opens their History → sees their sighting with the operator's tag and response.

WITHOUT API: Identical to today. No enrichment. Operator enters vehicle details manually.
Tags and responses still work (they are TRACE-native, not API-dependent).

EDGE CASES:
- Plate not found in CarAPI → enrichment field shows "No match." Operator enters manually.
- CarAPI rate limit hit → queued for retry. Operator sees "Enrichment pending."
- Plate already enriched from a prior sighting → no duplicate API call, reuse cached data.
- Reporter submits a plate with typos → operator corrects in triage, re-runs enrichment.


### 2.2 Reporter: Report Harassment (NEW — mirrors plate lookup workflow)

WHY: Reporters get harassing calls, texts, and voicemails from people who don't want
to be watched. Currently there is no way to log this evidence or get operator support.
Multiple reporters often get calls from the SAME numbers. Patterns and consistency
across reporters is intelligence. The system must track numbers as ENTITIES
(like vehicles), not just individual reports.

FLOW — TWO-TIER LOOKUP (mirrors plate workflow):
1. Reporter taps "Alert" tab → enters a phone number.
2. System checks TWO tiers, in order:

TIER 1 — TRACE DATABASE (always, zero API cost):
- Query ops.known_numbers for a matching phone number.
- IF MATCH (number already reported by someone in the chapter):
  → "⚠️ KNOWN NUMBER"
  → Operator's tag (e.g., "Known Threat", "Under Investigation")
  → How many reporters have reported this number ("Reported by 4 others")
  → Last report date
  → Operator's response/notes (if any)
  → Reporter immediately knows: they're not alone, others are getting these calls too.
  → If Spokeo was previously run: show cached identification (name only, truncated)

- IF NO MATCH → proceed to Tier 2.

TIER 2 — SPOKEO (if configured):
- Query Spokeo Phone Search: phone → name, carrier, line type, spam risk.
- IF FOUND:
  → "Caller info: John Smith, Mobile, AT&T, Low spam risk" (TRUNCATED for reporter)
  → Reporter sees: name + carrier + line type. NOT address. NOT social profiles.
  → Full Spokeo result cached in ops.known_numbers for operator.

- IF NOT FOUND:
  → "No caller information found for this number."

- IF SPOKEO NOT CONFIGURED:
  → Tier 2 doesn't fire. Reporter only sees Tier 1 results.
  → If Tier 1 is also no match: "Number not in chapter database."

3. After lookup, reporter can FILE A REPORT with additional detail:
   - Type selector: Call | Text | Voicemail | In-Person | Other
   - When it happened (date/time picker, defaults to now)
   - What happened (free text, 500 char max)
   - Attach evidence (camera for screenshot, mic for audio, file picker)
   - "Submit Report" → linked to the phone number entity

WHAT THE REPORTER SEES (truncated, liability-safe):
- Tier 1 match: operator tag + report count + operator response + cached name (if available)
- Tier 2 match: name + carrier + line type (one line, no address, no social, no raw JSON)
- No match: "Not in chapter database" / "No caller info found"

WHAT THE OPERATOR SEES (full data):
- Everything the reporter sees, PLUS:
- Full Spokeo response (address, age, social profiles, work history, spam risk detail)
- ALL reports from ALL reporters for this number (cross-reporter timeline)
- Lookup history (who looked it up, when)
- Pattern analysis: frequency, time-of-day clustering, which reporters targeted

### Phone Number as Entity (parallel to Vehicle dossier)

Phone numbers become first-class entities in TRACE, like vehicles:

ops.known_numbers table:
- phone_number (unique per chapter, the entity key)
- operator_tag (from tag_definitions where context='harassment')
- operator_notes (free text, operator's analysis)
- spokeo_result (full cached JSON, nullable)
- spokeo_lookup_at (when last queried)
- report_count (denormalized count of linked harassment_reports)
- first_reported_at, last_reported_at
- reporters_affected (count of distinct reporters who reported this number)
- status: active | resolved | escalated | reported_to_le

ops.harassment_reports links to known_numbers:
- Each report references a known_number_id
- Multiple reports can reference the same number
- Cross-reporter: "555-0123 reported by SCOUT-1, SCOUT-3, SCOUT-7"

OPERATOR WORKFLOW:
1. Operator opens Harassment section → sees numbers ranked by report count / recency
2. Clicks a number → sees the NUMBER DOSSIER:
   - Phone number (large, mono)
   - Tag + status
   - Spokeo identification (if available): full name, address, social profiles
   - "Identify" button (if Spokeo configured and not yet looked up)
   - Timeline: ALL reports from ALL reporters, chronological
   - Each report: reporter callsign, type, date, description, evidence
   - Pattern summary: "7 reports from 4 reporters over 2 weeks, mostly evenings"
3. Operator tags the NUMBER (not individual reports):
   - Tag applies to the number entity, visible to ALL reporters who look it up
4. Operator can write a response visible to reporters:
   - "This number has been identified and reported to authorities."

CROSS-REPORTER INTELLIGENCE:
- When Reporter A looks up a number that Reporter B already reported:
  → "Reported by 1 other" (count only, not callsigns — protects reporter identity)
- When the same number targets 5+ reporters:
  → Operator sees automatic escalation flag: "⚠️ COORDINATED HARASSMENT"
- Operator can see which reporters are targeted but reporters CANNOT see each other

GRACEFUL DEGRADATION:
| Scenario                        | Tier 1 (TRACE DB) | Tier 2 (Spokeo) | Reporter sees              |
|---------------------------------|-------------------|-----------------|----------------------------|
| No API, number unknown          | No match          | Skipped         | "Not in chapter database"  |
| No API, number known            | Match             | Skipped         | Tag + count + response     |
| API key, number unknown+found   | No match          | Match           | Name + carrier + type      |
| API key, number unknown+miss    | No match          | No match        | "No caller info found"     |
| API key, number known           | Match             | Cached/refresh  | Tag + count + name         |

EDGE CASES:
- Reporter enters invalid phone number → inline validation, submit blocked.
- Reporter uploads a 50MB voicemail → max 10MB, compress or reject with message.
- Reporter submits same number 5 times → 5 reports, all linked to same number entity.
  Operator sees the pattern. Report count increments.
- Reporter has no harassment to report → tab exists but is inert. No pressure.
- Audio recording: same camera-stream approach as photos (no file saved to device).
- Number reported by Reporter A, then Reporter B looks it up →
  B sees "Known Number" + tag + "Reported by 1 other." B can add their own report.


### 2.3 Reporter: View Feedback on Submissions (NEW)

WHY: Reporters submit sightings and harassment reports into a void. They never know
what happened. This breaks trust and reduces reporting motivation.

FLOW:
1. Reporter opens History (existing page).
2. Two sub-tabs at the top: "Sightings" (default) | "Harassment"
3. Sightings tab: existing list, enhanced with:
   - Tag badge (if operator tagged it): colored pill with label
   - Response text (if operator wrote one): small text below the sighting
   - No tag/response = no badge. Clean. Not "Pending" clutter.
4. Harassment tab: list of submitted reports with:
   - Phone number (partially masked: ***-***-1234)
   - Type icon (phone/text/mic)
   - Date
   - Tag badge (if operator tagged)
   - Response text (if operator responded)

EDGE CASES:
- Operator tags a sighting but writes no response → just show the tag badge.
- Operator writes a response but no tag → show the response text, no badge.
- Reporter has zero history → empty state: "No sightings yet. Submit your first report."
- Reporter has 500+ sightings → paginate or virtual scroll. Load 20 at a time.
- Tag is updated by operator after initial response → reporter sees the latest tag.


### 2.4 Operator: Triage Sightings (enhanced)

CURRENT: Operator sees sighting → approve/dismiss/flag/escalate.

ENHANCED:
- If CarAPI is configured, the sighting card shows auto-enriched vehicle data:
  "2019 Honda Civic, Black, VIN: 1HGBH41..." next to the plate.
- "Re-check" link if enrichment failed or seems wrong.
- NEW: Tag dropdown at the bottom of the triage card.
  Tags are configurable in Admin (default set provided):
  - Confirmed Suspicious, Cleared - Resident, Known Delivery Vehicle,
    Under Active Tracking, Duplicate Report, Requires Follow-Up
- NEW: Response text field (optional). Free text, 280 char max.
  "Thanks for the report. We've seen this vehicle before, it's under tracking."
- When operator completes triage action, tag and response are saved.
- Reporter sees them in their History.

WITHOUT API: No enrichment data shown. No "Re-check" link. Tag/response still work.
The triage card just doesn't have the auto-populated vehicle details.

EDGE CASES:
- Enrichment returns a vehicle that doesn't match the reporter's description →
  operator overrides. Enrichment is advisory, not authoritative.
- Operator wants to tag without triaging → allowed. Tag is independent of triage action.
- Operator wants to change a tag later → editable from the sighting detail view.
- Bulk triage: operator processes 20 sightings. Tags should be selectable per-sighting,
  not global. Each sighting gets its own tag/response.


### 2.5 Operator: Investigate Harassment Reports (NEW — number dossier model)

FLOW:
1. Operator opens "Harassment" in the sidebar.
   Icon: alert-triangle. Badge shows count of numbers with unreviewed reports.
2. LIST VIEW: shows NUMBERS (entities), not individual reports.
   Each row: phone number, tag, report count, reporters affected, last report date.
   Sorted by: most recent report (default), or report count, or reporters affected.
   Filterable by status (All | Active | Resolved | Escalated | Reported to LE).
3. Operator clicks a number → NUMBER DOSSIER (right panel or full page):
   - Phone number (large, mono font)
   - Status badge + operator tag
   - If Spokeo configured and not yet looked up: "Identify Caller" button
   - If Spokeo previously run: full results displayed (name, address, social, carrier)
   - Operator notes field (free text, internal)
   - Operator response field (280 chars, visible to reporters)
   - TIMELINE: all reports from all reporters, chronological, newest first.
     Each report: reporter callsign, type icon, date, description, evidence.
   - PATTERN SUMMARY (auto-generated):
     "7 reports from 4 reporters over 2 weeks. Peak: evenings (6-9pm)."
   - If 5+ reporters affected: "⚠️ COORDINATED HARASSMENT" auto-flag.
4. Operator tags the NUMBER entity (not individual reports).
   Tag is visible to all reporters who look up this number.
5. Operator writes response visible to reporters.
6. Operator sets status: active → resolved / escalated / reported_to_le.

WITHOUT API: No "Identify Caller" button. Operator sees reports, tags manually,
responds to reporters. Full functionality minus the Spokeo lookup.

QUICK LOOKUP: Header has a phone number input field (if Spokeo configured).
Operator can look up any number without a report existing.
Creates a known_numbers entity even without a linked report.

EDGE CASES:
- Spokeo returns zero results → "No records found." Operator tags manually.
- Spokeo returns multiple people → show all. Operator picks the relevant one.
- API key invalid → "Lookup failed. Check your Spokeo key in Admin → Integrations."
- Operator wants to merge two number entries (same caller, different numbers) →
  V1: not supported. V2: merge tool.
- Number has 50+ reports → paginate timeline. Show summary stats at top.


### 2.6 Operator: Vehicle Enrichment and Tagging (enhanced)

FLOW:
1. Operator opens a vehicle dossier (Vehicles page → click a vehicle).
2. If CarAPI configured and plate exists:
   - Auto-enriched data shown: VIN, year, make, model, trim, color, body type.
   - Source label: "CarAPI" or "Manual" next to each field.
   - "Refresh" button to re-query.
3. Operator can override any auto-populated field (manual always wins).
4. NEW: Vehicle tag system (separate from sighting tags):
   - Active Threat, Monitoring, Cleared, Flagged for LE, Known Resident, Rental/Fleet
5. Tag is visible on the vehicle card in list view (colored badge).
6. When a new sighting comes in matching this plate, the existing vehicle tag
   is shown to the operator during triage: "This plate is tagged: Active Threat."

WITHOUT API: No auto-enrichment. Operator fills in make/model/year manually (as today).
Tags still work. Everything manual is preserved.

EDGE CASES:
- Plate resolves to a different vehicle than expected (plate transferred/stolen) →
  operator sees mismatch, overrides, notes it.
- Enrichment cached for 30 days. After that, re-query on next access.
- Vehicle has no plate (description only) → no enrichment possible. Manual only.


### 2.7 Admin: Configure Integrations (NEW)

FLOW:
1. Admin → Integrations (new tab in Admin section).
2. Available connectors displayed as cards:

   ┌─────────────────────────────────────────────┐
   │ CarAPI — Vehicle Identification              │
   │ Resolve plates to VIN, make, model, year.    │
   │ [API Key: ••••••••••••] [Test] [Toggle: ON]  │
   │ Status: Connected. Last test: 2 hours ago.   │
   │ Usage: 47 lookups this month.                 │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │ Spokeo — People Intelligence                 │
   │ Identify callers by phone, name, email.      │
   │ [API Key: ••••••••••••] [Test] [Toggle: OFF] │
   │ Status: Not configured.                      │
   └─────────────────────────────────────────────┘

3. Each card has:
   - Service name and one-line description
   - API key field (password-masked, paste-friendly)
   - "Test Connection" button → fires a test query, shows result
   - Toggle (enabled/disabled)
   - Status line (connected/error/not configured)
   - Usage counter (lookups this month)
4. When toggled ON, lookup buttons appear throughout the app.
5. When toggled OFF or not configured, app runs without them.
   No error states. No "configure integrations" nags. Just absence of the button.

STORAGE: API keys stored in ops.integration_config, encrypted at rest (same encryption
as reporter identities). Keys never leave the server. Client never sees raw keys.

EDGE CASES:
- Admin pastes wrong key → "Test Connection" fails: "Authentication failed. Check your key."
- Admin toggles off while operator is mid-lookup → lookup completes (in-flight), no new ones.
- Two admins configure different keys → last write wins. Single key per service per chapter.
- Chapter has no admin → integrations page not accessible. App runs in zero-API mode.
- API service is down → lookups fail gracefully. "Service unavailable. Try again later."

---

## 3. DATABASE SCHEMA ADDITIONS

### 3.1 ops.known_numbers (phone number entities — parallel to vehicles)

```sql
CREATE TABLE IF NOT EXISTS ops.known_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  phone_number VARCHAR(20) NOT NULL,
  operator_tag VARCHAR(60),
  operator_notes TEXT,
  operator_response VARCHAR(280),       -- visible to reporters
  spokeo_result JSONB,                  -- full cached API response
  spokeo_lookup_at TIMESTAMPTZ,
  report_count INTEGER NOT NULL DEFAULT 0,
  reporters_affected INTEGER NOT NULL DEFAULT 0,
  first_reported_at TIMESTAMPTZ,
  last_reported_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','resolved','escalated','reported_to_le')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_known_numbers_chapter ON ops.known_numbers(chapter_id);
CREATE INDEX IF NOT EXISTS idx_known_numbers_phone ON ops.known_numbers(phone_number);
```

### 3.2 ops.harassment_reports (individual incidents — linked to known_numbers)

```sql
CREATE TABLE IF NOT EXISTS ops.harassment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  known_number_id UUID REFERENCES ops.known_numbers(id),  -- links to number entity
  reporter_id UUID NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  incident_type VARCHAR(20) NOT NULL CHECK (incident_type IN ('call','text','voicemail','in_person','other')),
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_refs JSONB DEFAULT '[]',  -- [{type: "audio"|"image", key: "...", size: ...}]
  operator_tag VARCHAR(60),
  operator_response VARCHAR(280),
  operator_responded_at TIMESTAMPTZ,
  lookup_result JSONB,              -- cached Spokeo response, nullable
  lookup_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','escalated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harassment_chapter ON ops.harassment_reports(chapter_id);
CREATE INDEX IF NOT EXISTS idx_harassment_reporter ON ops.harassment_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_harassment_phone ON ops.harassment_reports(phone_number);
CREATE INDEX IF NOT EXISTS idx_harassment_status ON ops.harassment_reports(status);
```

### 3.2 Sighting tag/response (add columns to existing sightings table)

```sql
ALTER TABLE ops.sightings ADD COLUMN IF NOT EXISTS operator_tag VARCHAR(60);
ALTER TABLE ops.sightings ADD COLUMN IF NOT EXISTS operator_response VARCHAR(280);
ALTER TABLE ops.sightings ADD COLUMN IF NOT EXISTS operator_responded_at TIMESTAMPTZ;
```

### 3.3 ops.integration_config

```sql
CREATE TABLE IF NOT EXISTS ops.integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  service_name VARCHAR(40) NOT NULL,  -- 'carapi', 'spokeo', 'bumper', etc.
  api_key_encrypted TEXT NOT NULL,    -- encrypted with chapter's server-side key
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  last_test_result VARCHAR(20),       -- 'success', 'auth_failed', 'error'
  lookups_this_month INTEGER NOT NULL DEFAULT 0,
  month_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, service_name)
);
```

### 3.4 ops.vehicle_enrichments

```sql
CREATE TABLE IF NOT EXISTS ops.vehicle_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  source VARCHAR(20) NOT NULL,       -- 'carapi', 'bumper', 'manual'
  vin VARCHAR(17),
  year INTEGER,
  make VARCHAR(60),
  model VARCHAR(60),
  trim VARCHAR(60),
  color VARCHAR(30),
  body_type VARCHAR(30),
  raw_response JSONB,
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_enrichment_vehicle ON ops.vehicle_enrichments(vehicle_id);
```

### 3.5 Vehicle and sighting tag configuration

```sql
CREATE TABLE IF NOT EXISTS ops.tag_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  context VARCHAR(20) NOT NULL CHECK (context IN ('sighting','vehicle','harassment')),
  label VARCHAR(60) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#818CF8',  -- hex color
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, context, label)
);

-- Default tags seeded per chapter on setup
-- Sighting: Confirmed Suspicious, Cleared, Known Delivery, Under Tracking, Duplicate, Follow-Up
-- Vehicle: Active Threat, Monitoring, Cleared, Flagged for LE, Known Resident, Rental/Fleet
-- Harassment: Known Threat, Spam, Under Investigation, Cleared, Reported to Authorities, Unknown
```

---

## 4. API ENDPOINTS

### 4.1 Reporter endpoints

```
POST   /api/v1/harassment-reports          -- submit a report
GET    /api/v1/harassment-reports/mine      -- my reports with tags/responses
GET    /api/v1/sightings/mine              -- my sightings with tags/responses (enhanced)
POST   /api/v1/harassment-reports/:id/evidence  -- upload evidence file
GET    /api/v1/plates/lookup?plate=X&state=Y    -- two-tier plate lookup (Tier 1 + Tier 2)
```

### 4.2 Operator endpoints

```
GET    /api/v1/harassment-reports          -- all reports for the chapter
GET    /api/v1/harassment-reports/:id      -- single report with evidence
PATCH  /api/v1/harassment-reports/:id      -- add tag, response, change status
POST   /api/v1/harassment-reports/:id/lookup   -- trigger Spokeo lookup
PATCH  /api/v1/sightings/:id/respond       -- add tag/response to a sighting
POST   /api/v1/vehicles/:id/enrich         -- trigger CarAPI lookup
GET    /api/v1/tag-definitions             -- get chapter's tag definitions
POST   /api/v1/tag-definitions             -- create custom tag
DELETE /api/v1/tag-definitions/:id         -- delete custom tag
```

### 4.3 Admin endpoints

```
GET    /api/v1/integrations                -- list configured integrations
PUT    /api/v1/integrations/:service       -- configure/update an integration
POST   /api/v1/integrations/:service/test  -- test connection
DELETE /api/v1/integrations/:service       -- remove integration
```

---

## 5. UI COMPONENTS

### 5.1 Reporter App (Preact PWA)

BOTTOM NAV CHANGE:
Current: Report | Map | History | Settings (4 tabs)
New:     Report | Alert | Map | History | Settings (5 tabs)
         "Alert" is the harassment reporting page. Icon: alert-triangle.

REPORT PAGE (enhanced):
- Existing sighting submission form, PLUS:
- Plate input gains auto-lookup behavior:
  When reporter finishes entering plate + selects state, Tier 1+2 check fires.
  Result appears in a card ABOVE the form:
  - TRACKED: amber card with "⚠️ TRACKED VEHICLE" + photo + make/model + tag
  - FOUND (CarAPI): neutral card with "Vehicle on record: 2019 Honda Civic, Black"
  - NOT FOUND: muted card with "No vehicle record for this plate"
  - NO API: muted card with "Plate not in chapter database"
  Reporter continues filling out the sighting with this context visible.
- Standalone "Quick Lookup" button at top of Report page:
  Opens a minimal lookup modal: plate + state → result card.
  No sighting submission required. For "let me check before deciding."

ALERT PAGE (new):
- Clean form, vertically stacked
- Phone number input with country code prefix (+1 default)
- Type selector: 4 pill buttons (Call | Text | Voicemail | Other)
- "When" field: date/time picker, defaults to now
- "What happened" textarea (500 chars, counter visible)
- "Add evidence" button: opens action sheet (Take Photo | Record Audio | Choose File)
- "Submit Report" button (indigo, full width)
- Below: collapsible "My Reports" section showing submitted reports with tags

HISTORY PAGE (enhanced):
- Two sub-tabs at top: "Sightings" | "Alerts" (underline style, not pills)
- Sightings sub-tab: existing list + tag badge + response text
- Alerts sub-tab: harassment report list + tag badge + response text
- Tag badge: small colored pill inline with the entry
- Response text: gray italic text below the entry, max 2 lines with expand

### 5.2 Operator Console (React)

SIDEBAR CHANGE:
Current: Dashboard | Triage | Intel Map | Dispatches | Vehicles | Actors | Admin | Security
New:     Dashboard | Triage | Intel Map | Dispatches | Harassment | Vehicles | Actors | Admin | Security
         "Harassment" added between Dispatches and Vehicles. Badge shows pending count.

HARASSMENT PAGE (new):
- Left panel: scrollable list of reports, sorted newest-first
  Each row: reporter callsign, phone number (full), type icon, time ago, status dot
  Click to select → detail appears in right panel
- Right panel (detail): full report view
  - Header: phone number (large, mono), type badge, date
  - Reporter callsign, description text
  - Evidence section: audio player (inline), image thumbnails (click to enlarge)
  - Divider
  - If Spokeo configured: "Identify Caller" button (indigo)
    → Results render below in a structured card:
      Name, age, address, carrier, line type, spam risk, social links
    → Cached: button changes to "Re-check" after first lookup
  - If Spokeo NOT configured: no button. No "configure integrations" nag.
  - Divider
  - Tag dropdown (from tag_definitions where context='harassment')
  - Response textarea (280 chars)
  - "Save & Close" button
- Top bar: filter pills (All | Pending | Reviewed | Escalated) + search by phone number

TRIAGE ENHANCEMENTS:
- Sighting card gains:
  - Vehicle enrichment badge (if CarAPI data exists):
    small line below plate: "2019 Honda Civic, Black" in muted text
  - Tag dropdown (from tag_definitions where context='sighting')
  - Response field (280 chars, collapsible, default hidden)
  - "Add response" link expands the field
- Tag and response are saved with the triage action (approve/dismiss/etc.)

VEHICLE DOSSIER ENHANCEMENTS:
- If CarAPI enrichment exists:
  - Enriched data shown with "CarAPI" source badge
  - "Refresh" link to re-query
  - Operator can override any field (override badge replaces source badge)
- Vehicle tag dropdown (from tag_definitions where context='vehicle')
- Vehicle tag badge visible in the vehicle list view

ADMIN → INTEGRATIONS (new tab):
- Card layout, one per available service
- Each card: name, description, API key field, Test button, toggle, status, usage counter
- Initially two cards: CarAPI, Spokeo
- Architecture supports adding more later (Bumper, etc.)
- If no integrations configured: page shows explanation text:
  "TRACE works without external services. Integrations add automatic vehicle identification
   and caller lookup. Each requires an API key from the respective service."

---

## 6. INTEL MAP REDESIGN

(Covered in detail here as it's part of the same build cycle)

### 6.1 Layout

The current page stacks: header → filter bar → corridor controls → map → time slider.
The user scrolls past controls to reach the map. The map is squeezed.

NEW LAYOUT: The map IS the page. Everything floats on it.

```
┌──────────────────────────────────────────────────┐
│ ┌─────────────────────────┐   ┌───────────────┐  │
│ │ Filter Bar (compact)    │   │ Layer Control  │  │
│ │ [24h][7d][30d][All] [▾] │   │ ☑ Sightings   │  │
│ └─────────────────────────┘   │ ☑ Heatmap     │  │
│                               │ ☑ Dispatch     │  │
│ [+ Drop Pin]  [+ Corridor]   └───────────────┘  │
│ [⊕ Toggle Heatmap]                               │
│                                                  │
│                    M A P                          │
│                                                  │
│              (full viewport)                     │
│                                                  │
│                                    ┌──────────┐  │
│                                    │ Detail   │  │
│                                    │ Panel    │  │
│                                    │ (right   │  │
│                                    │  slide)  │  │
│                                    └──────────┘  │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ ▶ ═══════════●══════════  10:00-11:00 AM     │ │
│ │             Time Scrubber                     │ │
│ └──────────────────────────────────────────────┘ │
│ [light] [dark] [satellite]      [8 sightings]    │
└──────────────────────────────────────────────────┘
```

### 6.2 Component Breakdown

FLOATING FILTER BAR (top-left):
- Single row: date range pills + vehicle dropdown + apply
- Compact: no labels, just controls
- Background: semi-transparent surface with blur
- Collapses to icon on narrow screens

FLOATING ACTION BUTTONS (left side, below zoom):
- Drop Pin (primary, indigo)
- Add Corridor (secondary, outline)
- Toggle Heatmap (secondary, outline)
- Small icon buttons with tooltips, vertically stacked

LAYER CONTROL (top-right):
- Restyled to match TRACE design system (dark bg, indigo checkmarks)
- Compact: no Leaflet default white box

DETAIL PANEL (right side, slides in on click):
- Width: 340px, full map height
- Appears when: click a sighting marker, dispatch pin, or corridor point
- Contains: all detail info + tag/response + action buttons
- Closes: X button, click elsewhere on map, or Escape key
- Sighting detail: plate, vehicle enrichment, description, time, heading, coords,
  tag dropdown, response field, "Dispatch here" button
- Dispatch detail: priority, event type, plate, notes, time, status,
  assigned reporters, "Close" button
- Different from the bottom overlay (current): side panel preserves map visibility

TIME SCRUBBER (bottom of map):
- Slim bar (40px height)
- Play/pause button, draggable slider, time label
- Background: semi-transparent surface
- No description text (current "Sightings grouped into 1-hour windows..." removed)
- Only visible when temporal data exists

STATS BADGES (bottom-right, above tile toggle):
- Small pills: "8 sightings" "2 active dispatches"
- Semi-transparent background
- Update in real-time as filters change

TILE TOGGLE (bottom-left):
- Stays where it is, restyled to indigo (already done)

### 6.3 New Data Visualizations

SIGHTING DENSITY CLUSTERS:
- At low zoom levels, sightings cluster into numbered circles
- "7" in a circle means 7 sightings in that area
- Click to zoom in and see individual markers
- Uses Leaflet.markercluster or custom canvas rendering

DISPATCH RADIUS:
- When a dispatch pin is selected, show a translucent circle
  representing the "area of interest" (configurable radius, default 200m)
- Helps operators understand coverage

VEHICLE TRAIL (enhanced corridors):
- When viewing a vehicle dossier, one-click "Show on map"
- All sightings for that vehicle appear as connected dots with timestamps
- Directional arrows on the line showing movement direction

### 6.4 Keyboard Shortcuts (Intel Map)

- P — Drop pin at map center
- F — Focus filter bar
- Escape — Close detail panel
- Space — Play/pause time scrubber
- ← → — Step time scrubber forward/back
- 1/2/3 — Switch tile layer (light/dark/satellite)
- L — Toggle layer control

---

## 7. DOCUMENTATION UPDATES

### 7.1 Files to update when features ship

- README.md: add "Integrations" section listing available connectors
- CHAPTER_SETUP.md: add "Optional: Configure Integrations" section after basic setup
- guide.html: add FAQ entries for "What are integrations?" and "Do I need API keys?"
- Reporter onboarding: add "Report Harassment" slide (after "Emergency Wipe")
- Operator onboarding: add "Harassment Reports" slide + "Integrations" mention
- Operator guide modal: add "Harassment" and "Integrations" sections
- CONTRIBUTING.md: add integration architecture overview for developers
- setup.sql: include new tables (harassment_reports, integration_config, etc.)
- DEPENDENCIES.md: add new blast radius entries
- DESIGN_SYSTEM.md: add tag color definitions

### 7.2 Onboarding slide additions

Reporter (insert after "Emergency Wipe", before "Automatic Check-In"):
  Title: "Report harassment"
  Body: "Getting harassing calls or texts? Report the number to your operator.
         They can investigate and let you know what they find."
  Detail: "The Alert tab lets you submit phone numbers, descriptions, and evidence.
           Your operator reviews reports and may be able to identify the caller."

Operator (insert after "Device Controls", before "Reporting Issues"):
  Title: "Harassment reports"
  Body: "Reporters can submit harassing phone numbers through the app.
         You review them, investigate, and respond."
  Detail: "If your chapter has a Spokeo API key configured in Admin → Integrations,
           you can identify callers directly. Otherwise, review and tag reports manually."

---

## 8. GRACEFUL DEGRADATION MATRIX

| Feature                    | No API keys | CarAPI only | Spokeo only | Both |
|----------------------------|-------------|-------------|-------------|------|
| Submit sightings           | ✓           | ✓           | ✓           | ✓    |
| Submit harassment reports  | ✓           | ✓           | ✓           | ✓    |
| Triage sightings           | ✓           | ✓ + enriched| ✓           | ✓    |
| Tag/respond to sightings   | ✓           | ✓           | ✓           | ✓    |
| Tag/respond to harassment  | ✓           | ✓           | ✓           | ✓    |
| View tags/responses (rptr) | ✓           | ✓           | ✓           | ✓    |
| Auto-enrich vehicle data   | ✗           | ✓           | ✗           | ✓    |
| Identify caller by phone   | ✗           | ✗           | ✓           | ✓    |
| "Identify" button visible  | ✗           | ✗           | ✓           | ✓    |
| "Re-check" button visible  | ✗           | ✓           | ✗           | ✓    |
| Admin → Integrations page  | ✓ (empty)   | ✓           | ✓           | ✓    |
| Intel Map                  | ✓           | ✓           | ✓           | ✓    |
| Everything else             | ✓           | ✓           | ✓           | ✓    |

Key: ✓ = works, ✗ = not available (no button shown, no error)

---

## 9. BUILD ORDER

→ SUPERSEDED by §12 (Revised Build Order). See below.

---

## 10. DECISIONS (CONFIRMED)

1. Harassment reports visible to ALL operators. ✓
2. Reporters do NOT see which operator responded. ✓
3. Tags editable after initial response. Investigations evolve. ✓
4. "Alert" tab shows badge count for unread responses. ✓
5. Reporter plate lookup: TWO-TIER (see §2.8 below). ✓
6. Max evidence: 10MB per file, 5 files per report. ✓
7. Intel Map detail panel overlays the map edge, not the sidebar. ✓
8. Operator receives ALL available API data. ✓

---

## 11. REVISED WORKFLOW: Reporter Plate Lookup (§2.8)

### Why this changes everything

The original design had plate enrichment as operator-only, behind the triage wall.
The client workflow is different: reporters are in the field, looking at a vehicle
RIGHT NOW. They need to know what that plate resolves to IMMEDIATELY, not after
an operator reviews it hours later.

The key insight from the client: "There have been times we ran a plate that looked
suspicious and the plate was for a completely different car than the one it was on."
A reporter seeing "this plate belongs to a 2019 Honda Civic" while staring at a
Toyota Camry is REAL-TIME INTELLIGENCE. Stolen plates. Swapped plates. Cloned plates.
The reporter becomes a field sensor for plate mismatches.

### 2.8 Reporter: Plate Lookup (REVISED — reporter-side, immediate)

FLOW:
1. Reporter is on the Report page or a new "Lookup" quick-action.
2. Reporter enters a plate number + state.
3. System checks TWO tiers, in order:

TIER 1 — TRACE DATABASE (always, zero API cost):
- Query ops.vehicles for a matching plate.
- IF MATCH:
  → "⚠️ TRACKED VEHICLE"
  → Vehicle photo(s) (most recent confirmed photo from dossier, if uploaded)
  → Make/model/year/color (from dossier or prior enrichment)
  → Vehicle tag (e.g., "Active Threat", "Monitoring")
  → Suspicion level badge
  → Reporter immediately knows: this plate is known to the chapter.
  → They can compare what they see in front of them vs what the dossier says.
  → Mismatch = critical intelligence. Same = confirmation.
  → PHOTO IS KEY: reporter sees the dossier photo and compares to the car
    in front of them. Different car on the same plate = stolen/swapped plate.

- IF NO MATCH → proceed to Tier 2.

TIER 2 — CarAPI (if configured, costs ~$0.30/lookup):
- Query CarAPI: plate + state → VIN → year/make/model/color/body_type.
- IF FOUND:
  → "Vehicle on record: 2019 Honda Civic, Black, Sedan"
  → Reporter compares to what they're looking at.
  → If the car in front of them matches → normal vehicle, file sighting if suspicious.
  → If the car DOESN'T match → plate mismatch → high-priority sighting.
  → The lookup result is cached in ops.vehicle_enrichments for the operator.

- IF NOT FOUND:
  → "No vehicle record found for this plate."
  → Could be a temporary plate, out-of-state, or data gap.

- IF CarAPI NOT CONFIGURED:
  → Tier 2 doesn't fire. Reporter only sees Tier 1 results.
  → If Tier 1 is also no match: "Plate not in chapter database."

WHAT THE REPORTER SEES (truncated, no raw API data):
- Tier 1 match: vehicle photo(s) + make/model + tag + suspicion level
  Photos: most recent confirmed photo(s) from the vehicle dossier, displayed as
  thumbnails. Reporter can tap to enlarge. If no photos uploaded, show make/model text only.
- Tier 2 match: make/model/year/color (one line, no VIN, no raw JSON)
- No match: "Not in database" / "No vehicle record found"

WHAT THE OPERATOR SEES (full data):
- Everything the reporter sees, PLUS:
- Full CarAPI response (VIN, trim, engine, body type, MSRP, all fields)
- Lookup history (who looked it up, when, from where)
- Any plate mismatch flags raised by reporters

### Reporter UI for plate lookup

Option A: Integrated into the Submit flow.
  Reporter starts a sighting → enters plate → system auto-checks Tier 1 + 2 →
  result appears ABOVE the submit form → reporter decides whether to submit.

Option B: Standalone "Lookup" action on the Report page.
  Quick-check without committing to a full sighting submission.
  Useful for "let me check this plate before I decide if it's worth reporting."

RECOMMENDATION: Both. Auto-check fires during sighting submission (passive).
Standalone lookup available as a button on the Report page (active).

### Plate mismatch detection

When a reporter submits a sighting AND the plate was looked up AND they describe
a vehicle that doesn't match the CarAPI result, the operator should see a
"⚠️ PLATE MISMATCH" flag in triage.

V1 implementation: manual. Reporter sees "2019 Honda Civic" from CarAPI,
but they're looking at a truck. They note it in the description.
The operator reads it and flags it.

V2 (future): Reporter selects observed vehicle type from a picker
(sedan/SUV/truck/van/motorcycle). System compares to CarAPI body_type.
Automatic mismatch flag if they don't match.

### Graceful degradation for plate lookup

| Scenario                     | Tier 1 (TRACE DB) | Tier 2 (CarAPI) | Reporter sees           |
|------------------------------|-------------------|-----------------|-------------------------|
| No API key, plate unknown    | No match          | Skipped         | "Not in chapter database"|
| No API key, plate tracked    | Match             | Skipped         | Photo + details + tag    |
| API key, plate unknown+found | No match          | Match           | Make/model/year/color    |
| API key, plate unknown+miss  | No match          | No match        | "No vehicle record"      |
| API key, plate tracked       | Match             | Optional refresh| Photo + details + tag    |

---

## 12. REVISED BUILD ORDER

Phase 1: Schema + API foundations
  - New database tables
  - Update setup.sql
  - Tag definitions seed data
  - Sighting tag/response columns

Phase 2: Reporter plate lookup (HIGHEST VALUE — field intelligence)
  - Tier 1: TRACE database check
  - Tier 2: CarAPI integration (if configured)
  - Reporter UI: standalone lookup + auto-check in submit flow
  - Truncated response for reporter, full data cached for operator

Phase 3: Reporter harassment reporting
  - "Alert" tab in reporter bottom nav
  - Harassment report form + evidence upload
  - History page with tags/responses

Phase 4: Operator harassment review
  - "Harassment" sidebar section
  - Report list + detail panel
  - Tag/response workflow + evidence viewer

Phase 5: Integrations framework
  - Admin → Integrations page
  - API key storage (encrypted)
  - Test connection + usage tracking

Phase 6: Spokeo connector
  - Phone number lookup in harassment detail
  - Results display and caching

Phase 7: Intel Map redesign
  - Full-bleed map with floating controls
  - Right-side detail panel
  - Bottom time scrubber
  - Sighting clusters + keyboard shortcuts

Phase 8: Documentation sweep
  - All guides, onboarding, README, setup.sql updated
