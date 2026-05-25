# TRACE Sprint: Operator Dashboard

## Context
Read `D:\Projects\TRACE\HANDOFF.md` for full project context.
Read `D:\Projects\TRACE\docs\REQUIREMENTS_SYNTHESIS.md` for requirements.
Read `D:\Projects\TRACE\src\db\schema\vault-a.ts` for the data model.
Read `D:\Projects\TRACE\src\api\` for all API contracts.

## Objective
Build the operator power-user dashboard in `D:\Projects\TRACE\operator\`.
Single operator manages all incoming data, pattern review, and case building.
This is a keyboard-driven, single-pane-of-glass interface.

## Stack
- React + TypeScript
- Vite for build
- Tailwind CSS for rapid layout
- Leaflet.js for map views (area heatmaps, corridor visualization)
- WebSocket client for real-time triage queue updates

## Requirements

### Triage Queue (PRIMARY VIEW)
- New sightings since last session, reverse-chronological
- Each sighting card: photo thumbnail(s), plate, location, time, reporter callsign
- Hotkeys: A=approve, F=flag, D=dismiss, E=escalate, N=next
- One-click link sighting to existing vehicle or create new vehicle dossier
- WebSocket/SSE: new sightings appear without refresh (< 5s latency target)

### Vehicle Dossier View
- Full vehicle profile: plate history, type tags, suspicion level, sighting timeline
- Linked actors with risk level badges
- Map: all sighting locations for this vehicle (corridor visualization)
- Suspicion level promote/demote with required justification
- Photo gallery from all linked sightings

### Actor Dossier View
- Actor profile: alias, physical description, risk level, notes
- All linked vehicles
- Photo gallery
- Activity timeline

### Dashboard Home
- Active vehicle count by suspicion level (donut chart or bars)
- New sightings since last session
- Pattern alerts (placeholder - pattern engine comes later)
- Notification queue

### Admin Panel (sub-section)
- Reporter management: invite (callsign + email), deactivate, reactivate
- Vehicle type taxonomy CRUD
- Suspicion ladder CRUD
- Actor risk level CRUD
- Notification channel + rule configuration

## File Structure
```
operator/
  index.html
  src/
    app.tsx
    main.tsx
    pages/
      dashboard.tsx     # Home overview
      triage.tsx        # Sighting triage queue
      vehicles.tsx      # Vehicle list + dossier
      actors.tsx        # Actor list + dossier
      admin.tsx         # Admin configuration panel
    components/
      sighting-card.tsx # Triage queue item
      vehicle-card.tsx  # Vehicle summary
      actor-card.tsx    # Actor summary
      map-view.tsx      # Leaflet map wrapper
      suspicion-badge.tsx
      hotkey-handler.tsx
    lib/
      api.ts            # API client
      ws.ts             # WebSocket client for real-time
      hotkeys.ts        # Keyboard shortcut manager
  vite.config.ts
  tsconfig.json
  package.json
```

## Deliverable
Working dashboard scaffold with triage queue, vehicle list, and admin panel.
All views connected to API endpoints. Hotkey system wired. Map rendering.
Styling doesn't need to be final but layout must be functional.

## Commit
Commit to `D:\Projects\TRACE` repo when complete.
Message: `feat(operator): operator dashboard scaffold with triage queue`
