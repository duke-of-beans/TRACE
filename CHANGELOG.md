# Changelog

## v1.0.0 (2026-05-27)

First production release. Full community vehicle tracking platform.

### Reporter PWA
- Sighting submission with GPS, photos, plate lookup
- Harassment phone number reporting
- Active dispatch map with response workflow
- Panic button and PIN lock
- Dead man's switch (72h auto-wipe)
- Progressive Web App (installable from browser)

### Operator Console
- **Dashboard** with 5 stat cards (triage, vehicles, actors, dispatches, incidents)
- **Triage** queue with keyboard shortcuts (C/D/F/N/P)
- **Activity Map** with heatmap, time playback, corridor overlays, dispatch pins
- **Vehicles** with concern levels, sighting history, photos, type assignments
- **Actors** with physical identifiers, linked vehicles, aliases
- **Incidents** with evidence tracking, M2M actor/vehicle linking, public witness forms
- **Harassment** reports with cross-reporter correlation
- **Dispatches** with priority levels, reporter assignment, auto-close timers
- **Admin** with 11 configurable sections
- **Security** with remote suspend, kill, and nuke capabilities
- Code-split bundle (440KB main + 6 lazy chunks)
- Help text on every page and admin section
- Bug reports filed directly to GitHub Issues

### API
- Three-vault database architecture (ops, ident, evidence)
- CORS lockdown (env-var based, production-only)
- Auth: invite codes for reporters, callsign + access code for operators
- Magic link auth intentionally excluded (would require email, violates pseudonymous architecture)
- Printable observation record (HTML endpoint for print-to-PDF)
- Public incident form (token-gated, rate-limited, 48h expiry)
- Rapid capture endpoint with auto-GPS
- Evidence encryption at rest (AES-256-GCM, requires EVIDENCE_ENCRYPTION_KEY env var)
- Enriched vehicle detail (type assignments, concern history, recent sightings, linked actors)
- Enriched actor detail (linked vehicles, photos, physical identifiers)
- Vehicle concern promotion with audit trail (from/to level, reason, timestamp)
- Corridor analysis, heatmap, temporal playback, co-occurrence endpoints
- Offline sighting queue with sync-on-reconnect

### Quality
- YUMA gate: 17 tests, 84 checks, 0 warnings, 0 TODOs
- 6 test tiers: static analysis, behavioral, terminology, visual, dependency, evidence chain
- Full terminology compliance (concern levels, records, observed persons)
- Visual regression baseline (10 authenticated screenshots via Puppeteer)
- Field-level tooltips on 8 complex form fields
- Empty states with contextual guidance on every page
