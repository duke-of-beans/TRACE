# TRACE — Dispatch & Patrol Design Document
## Version 1.0 — Deep Workflow Analysis

---

## The Three Users

### The Patroller (Reporter in the field)
Driving around an assigned area. Phone mounted on the dash or in a cupholder.
One hand free, sometimes none. Daylight and nighttime. They are watching
traffic, not their phone. When something catches their eye, they need to
act in seconds, not minutes.

### The Dispatch Operator
Sitting at a desk with a laptop. Managing multiple patrollers simultaneously.
Fielding phone calls from community members. Making quick decisions: is this
vehicle in our system? Do I send someone? Who is closest? They are the air
traffic controller.

### The Community Caller (outside the app)
A resident who sees something and calls in. They describe a vehicle and a
location. They do not use TRACE. The operator translates their call into
a dispatch event.

---

## Workflow 1: Patroller Spots a Vehicle

### What happens now (group chat)
Patroller texts: "Silver Honda Civic, plate ABC-1234, heading east on Oak St."
Dispatch checks the plate. Texts back: "That's in our system, confirmed."
Dispatch texts the group: "Confirmed vehicle at Oak and 3rd, who can respond?"
Another patroller texts: "On my way."

### What TRACE should do

**Step 1: Submit (3 seconds)**
The Report screen opens with the plate field focused and the keyboard up.
GPS is captured automatically. The patroller types the plate, taps a
direction arrow, and hits Submit. Photo is optional, one tap to capture.
They do not describe the location in words. The GPS does it.

If the patroller starts typing a plate already in the database, the app
suggests it: "Match: ABC-1234 (Silver Honda Civic)." One tap to select.
Fewer typos, faster submission, automatic vehicle linking.

**Step 2: Receipt with live status**
After submit, the screen does not just say "Submitted." It shows a status
card that updates in real time:

```
✓ Submitted                    10:42:03 AM
⏳ Awaiting dispatch review
```

Then, as the operator acts:

```
✓ Submitted                    10:42:03 AM
✓ Plate checked                10:42:15 AM
✓ Confirmed — patrollers dispatched
```

Or:

```
✓ Submitted                    10:42:03 AM
✓ Plate checked                10:42:15 AM
— Not in our database. No action needed.
```

This is the group chat workflow, structured. The patroller knows their
report was received, processed, and what happened next. No ambiguity.
No "did anyone see my message?"

**Step 3: Back to patrol**
The status card stays visible for 30 seconds, then the screen returns
to the plate input. The patroller is already looking for the next vehicle.
Previous submissions are in the History tab if they want to check later.

---

## Workflow 2: Operator Receives a Sighting

### The triage card (enhanced)
When a sighting arrives, the triage card shows everything the operator
needs to decide in one glance:

```
┌─────────────────────────────────────────────┐
│  ABC-1234                    ● MATCH         │
│  Silver Honda Civic — Confirmed (rank 4)     │
│  ─────────────────────────────────────────── │
│  Heading E on Oak St         2 min ago       │
│  Reporter: FALCON-7                          │
│  ─────────────────────────────────────────── │
│  [Confirm & Dispatch]  [Dismiss & Notify]    │
│  [Add Note]            [View Record]        │
└─────────────────────────────────────────────┘
```

Or for an unknown plate:

```
┌─────────────────────────────────────────────┐
│  XYZ-9876                    ○ NEW PLATE     │
│  No matching vehicle in database             │
│  ─────────────────────────────────────────── │
│  Heading W on Main St        1 min ago       │
│  Reporter: HAWK-3                            │
│  ─────────────────────────────────────────── │
│  [Add to Tracking]     [Dismiss & Notify]    │
│  [Add Note]                                  │
└─────────────────────────────────────────────┘
```

The MATCH/NEW PLATE badge is automatic. The operator never searches
manually. The plate lookup happens on sighting creation, server-side.

### "Confirm & Dispatch" (one action)
Tapping this:
1. Marks the sighting as confirmed
2. Opens the dispatch panel (slide-in, not a new page)
3. Shows a map centered on the sighting location
4. Lists available reporters with their last-known distance (if sharing location)
5. Operator selects who to dispatch (one, several, or all)
6. Adds optional notes ("Silver Civic, two occupants, parked at gas station")
7. Taps "Send Dispatch"

The original reporter gets: "Confirmed. Patrollers dispatched."
The dispatched patrollers get: push notification with location and details.
The dispatch event appears on both operator and reporter maps.

### "Dismiss & Notify"
Tapping this:
1. Marks the sighting as reviewed
2. Sends the original reporter: "Not in our database. No action needed."
3. The sighting is filed, not deleted. New plates that appear multiple times
   across different days will surface organically in future reviews.

### "Add to Tracking"
For new plates the operator wants to watch:
1. Creates a vehicle entry with the plate, description, and initial concern level
2. Optionally dispatches (same flow as Confirm & Dispatch)
3. Future sightings of this plate will auto-match

---

## Workflow 3: Community Member Calls In

The operator receives a phone call: "There's a white van idling on Elm St,
been there for an hour, two men sitting inside."

There is no sighting in TRACE. The operator creates a dispatch from scratch.

### Dispatch from the Intel Map
1. Operator clicks a location on the map
2. A form appears:

```
Event Type: [Suspicious Vehicle ▾]
Priority:   [● Urgent  ○ Routine  ○ Info]
Notes:      White van, idling 1hr, two occupants
Source:     Community call
            ───────────────────────────
            [Dispatch to: FALCON-7, HAWK-3 ▾]
            [Send Dispatch]
```

3. The pin appears on the operator map immediately
4. Selected reporters get the push notification
5. The pin appears on their maps

### Dispatch without a sighting is a separate entry point
This is not a triage action. It is a map action. The operator is translating
a phone call into a geospatial event. The UI should make this feel natural:
click the map, describe what you know, send people.

---

## Workflow 4: Patroller Receives a Dispatch

### The notification
The phone vibrates with a distinct pattern (not the default notification
buzz). The lock screen shows:

```
TRACE — Dispatch
Confirmed vehicle at Oak St & 3rd Ave
Silver Honda Civic (ABC-1234) — Priority
Tap to view on map
```

### Opening the dispatch
The app opens to the Map tab, centered on the dispatch pin. The pin is
visually distinct from the patroller's own sightings:

- Dispatch pins: larger, colored by priority (red=urgent, amber=routine,
  blue=info), with the event type icon inside
- Own sightings: small muted dots

The pin's info card shows:
```
┌───────────────────────────────┐
│ ⚠ Confirmed Vehicle           │
│ ABC-1234 — Silver Honda Civic  │
│ Oak St & 3rd Ave               │
│ 3 minutes ago                  │
│ "Two occupants, parked at      │
│  gas station on NE corner"     │
│                                │
│ [Responding]  [Open in Maps]   │
└───────────────────────────────┘
```

### "Responding"
One tap. The operator's dispatch panel updates: "FALCON-7 responding (1 min ago)."
The patroller drives to the location.

### "Open in Maps"
Opens the native maps app (Google Maps, Apple Maps, Waze) with the
dispatch coordinates as the destination. The patroller gets turn-by-turn
directions without TRACE trying to be a navigation app.

### On arrival
When the patroller reaches the vicinity (within ~200m of the dispatch
location), the app could suggest: "Are you on scene?" If they tap yes:
- The operator sees "FALCON-7 on scene"
- The Report screen pre-fills with the dispatch location and linked vehicle
- The patroller adds what they see and submits
- The sighting auto-links to the dispatch event

If they don't find anything:
- "Nothing found" button
- The dispatch closes with a "no contact" outcome
- The operator sees the result

---

## Workflow 5: Quick Plate Check (Patrol Mode)

Sometimes a patroller just wants to know: is this plate in our system?
They do not want to submit a full sighting. They want a quick answer.

### Plate check mode
A toggle or separate mode on the Report screen:

```
┌─────────────────────────────┐
│  [Report]    [Check Plate]  │
│                             │
│  ┌───────────────────────┐  │
│  │  Enter plate...       │  │
│  └───────────────────────┘  │
│                             │
│  ● MATCH                    │
│  ABC-1234                   │
│  Silver Honda Civic         │
│  Concern: Confirmed       │
│  Last seen: 2 days ago      │
│                             │
│  [Submit Full Report →]     │
│                             │
└─────────────────────────────┘
```

If the plate matches, the patroller can escalate to a full sighting
report with one tap (pre-fills the plate and vehicle info). If no match,
they move on.

This replaces texting dispatch "can you run this plate?"

---

## The Reporter Map

### What it shows
- Active dispatch pins (colored by priority, event type icons)
- The patroller's own sightings from the current shift (small, muted)
- The patroller's current location (blue dot)
- Satellite view by default (matches the real world they are looking at)

### What it does NOT show
- Heatmaps, corridors, co-occurrence zones (operator-level intelligence)
- Other reporters' sightings (reporter-to-reporter invisibility)
- Vehicle concern levels or full records
- Actor profiles

If a reporter's device is taken, the adversary sees dispatch pins
(which are time-limited and auto-expire) and the reporter's own sightings.
They do not see the operational intelligence picture.

### Dispatch pin lifecycle on the map
- NEW: pin pulses briefly, colored border
- ACTIVE: solid pin, event type icon, priority color
- RESPONDING: pin shows who is responding ("FALCON-7 en route")
- CLOSED: pin fades and disappears after a short delay

### Stale dispatch auto-close
Dispatches older than a configurable threshold (default: 4 hours) auto-close.
The map stays clean. Closed dispatches are in the operator's history.

---

## The Little Things

### 1. Plate input auto-suggest
When the reporter types a plate, if it matches a vehicle in the database,
show the match inline. "ABC-1 → ABC-1234 (Silver Honda Civic)." Tap to
auto-fill. Reduces errors, speeds entry, auto-links to the right vehicle.

### 2. Submission vibration
A short, distinct vibration on successful submit. Not a sound (conspicuous).
The patroller feels the confirmation without looking at the screen.

### 3. Dispatch vibration pattern
Different from the submission vibration. Two quick pulses = dispatch alert.
The patroller learns the pattern and knows what it means without reading
the screen.

### 4. Time-since on everything
Every timestamp shows relative time: "2 min ago", "1h ago." Absolute times
are secondary. In field operations, "3 minutes ago" matters more than
"10:42:03 AM."

### 5. Night mode auto-switch
Between sunset and sunrise (based on GPS location), auto-switch to dark mode.
A bright screen in a dark car is visible from outside and ruins night vision.

### 6. Report screen returns to ready state
After submitting, the status card shows for 30 seconds, then the screen
resets to the plate input, focused and ready. The patroller should never
have to navigate back to the report screen manually.

### 7. Closest-reporter indicator
When the operator is dispatching, show which reporters are nearest to the
location. This is opt-in (reporters must consent to location sharing).
If enabled, the dispatch panel shows: "FALCON-7 (0.8 mi), HAWK-3 (2.1 mi)."

### 8. Dispatch outcome tracking
Every dispatch records: response time (how long until first responder
acknowledged), arrival time (how long until on scene), outcome
(sighting confirmed / nothing found / suspect fled). This is operational
analytics the chapter can review weekly.

### 9. Shift concept
Patrollers work shifts. A "start shift / end shift" toggle that:
- Begins tracking their sightings for the current session
- Shows only current-shift sightings on the reporter map
- Enables location sharing (for proximity dispatch)
- Disables the dead man's switch timer during active shift
This keeps the map clean and the analytics per-shift.

### 10. Audio cue option
For patrollers who want it, a brief audio tone on dispatch. Different
tones for different priorities. Configurable in settings, off by default.

### 11. Dispatch templates
Common dispatch types the operator sends repeatedly: "Confirmed vehicle,
respond," "Community call, check area," "Plate swap suspected, investigate."
One-tap templates that pre-fill the dispatch form.

### 12. The "nothing happened" report
When a patroller checks out a dispatch and finds nothing, that is still
intelligence. The "Nothing found" report should be easy to submit (one tap)
and should record the time and location. Over time, patterns of false
positives at certain locations are useful data.

---

## Event Types (Admin-configurable)

The chapter admin defines event types. Defaults:

| Type | Icon | Default Priority | Description |
|------|------|-----------------|-------------|
| Confirmed Vehicle | car | Urgent | Known vehicle from the database |
| Community Report | radio | Routine | Called in by a community member |
| Area Check | compass | Routine | General area to patrol |
| Plate Swap Alert | alert-triangle | Urgent | Vehicle suspected of changing plates |
| Suspicious Activity | eye | Routine | Non-vehicle activity to investigate |

Each type has:
- Label (editable)
- Icon (from curated set: ~15 options)
- Color (for map pin)
- Default priority (overridable per dispatch)
- Auto-close timer (hours, 0 = manual close only)

---

## Database Schema (New Tables)

### dispatch_event_types
Chapter-configurable. Same pattern as vehicle_types.
`id, chapter_id, label, icon, color, default_priority, auto_close_hours, sort_order, created_at`

### dispatch_events
The core dispatch record.
`id, chapter_id, sighting_id (nullable), event_type_id, lat, lng, location_description, notes, source (sighting|community_call|operator), priority (urgent|routine|info), status (open|responding|on_scene|closed|expired), created_by, created_at, closed_at, close_reason`

### dispatch_assignments
Who was dispatched.
`id, dispatch_event_id, reporter_id, status (assigned|responding|on_scene|completed|declined), assigned_at, responded_at, arrived_at, completed_at, notes`

### dispatch_outcomes
What happened.
`id, dispatch_event_id, reporter_id, sighting_id (nullable), outcome (confirmed|not_found|suspect_fled|false_alarm|other), notes, created_at`

### sighting_feedback
Feedback pushed to the original reporter.
`id, sighting_id, message, feedback_type (confirmed|dismissed|info), sent_at, read_at`

---

## Implementation Priority

### Phase 1: Auto plate lookup + reporter feedback
Highest value, least code. Enhance triage cards with automatic plate
matching. Add "Confirm & Dispatch" and "Dismiss & Notify" actions that
push feedback to the reporter. Reporter sees live status on submissions.

### Phase 2: Dispatch events + reporter map
Build the dispatch table, operator dispatch panel (from triage and from
map), reporter map tab with active pins. Push notifications for dispatch.

### Phase 3: Quick plate check + dispatch responses
Plate check mode on reporter. "Responding" / "On scene" / "Nothing found"
lifecycle. Dispatch outcome tracking. Operational analytics.

### Phase 4: Polish
Plate auto-suggest, proximity dispatch, night mode auto-switch, shift
concept, dispatch templates, vibration patterns, audio cues.
