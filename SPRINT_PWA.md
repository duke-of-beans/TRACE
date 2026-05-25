# TRACE Sprint: Reporter PWA

## Context
Read `D:\Projects\TRACE\HANDOFF.md` for full project context.
Read `D:\Projects\TRACE\docs\REQUIREMENTS_SYNTHESIS.md` for requirements.
Read `D:\Projects\TRACE\docs\SECURITY_ARCHITECTURE.md` for security constraints.
Read `D:\Projects\TRACE\src\db\schema\vault-a.ts` for the data model.
Read `D:\Projects\TRACE\src\api\sightings\index.ts` for the API contract.

## Objective
Build the reporter-facing Progressive Web App in `D:\Projects\TRACE\pwa\`.
This is the field tool that replaces group chat. It MUST be faster than texting.

## Stack
- Preact + TypeScript (minimal bundle for mobile)
- Vite for build
- Service worker for offline-first + push notifications
- Leaflet.js for map (location picker on sighting submission)

## Requirements

### Submission Flow (THREE TAPS MAX)
1. Open camera / select photo(s)
2. Auto-populate: GPS from EXIF, timestamp from EXIF, reverse-geocode location name
3. Reporter adds: plate (optional), vehicle description, activity, direction, notes
4. Submit -> queued if offline, sent when connected

### Vehicle Search
- Lightweight plate/description search against `GET /api/v1/vehicles/search?q=`
- Reporter checks "has this been seen before?" before submitting
- Read-only - no dossier editing from reporter PWA

### Offline-First
- IndexedDB for queued submissions
- Service worker caches app shell + recent vehicle data
- Background sync when connectivity returns
- Visual indicator: queued count badge

### Push Notifications
- Web Push via service worker
- Subscribe to admin-assigned channels
- Notifications are signals not content (no intelligence in the push payload)

### Security (from Security Architecture)
- No cached identities of other reporters
- No operator credentials
- No chapter intelligence beyond own submission history
- EXIF: preserve GPS + timestamp, strip device info
- Submission timing jitter ±30sec applied client-side before send

## File Structure
```
pwa/
  index.html
  src/
    app.tsx           # Root component
    main.tsx          # Entry point + SW registration
    sw.ts             # Service worker
    pages/
      submit.tsx      # Camera -> submit flow
      search.tsx      # Vehicle lookup
      history.tsx     # Own submission history
    components/
      camera.tsx      # Camera capture / photo picker
      location.tsx    # Map location picker (Leaflet)
      plate-input.tsx # Plate number input with format hints
      queue-badge.tsx # Offline queue indicator
    lib/
      api.ts          # API client with offline queue
      exif.ts         # EXIF extraction (GPS, timestamp, strip device)
      storage.ts      # IndexedDB for offline queue
      jitter.ts       # ±30s timing jitter
      push.ts         # Push notification subscription
  vite.config.ts
  tsconfig.json
  package.json
```

## Deliverable
Working PWA scaffold that can be served, installed on mobile, and submit a sighting
(even if the backend isn't running yet - queue offline). Camera capture working.
Offline queue with sync. Push notification subscription stub.

## Commit
Commit to `D:\Projects\TRACE` repo when complete.
Message: `feat(pwa): reporter PWA scaffold with offline-first submission`
