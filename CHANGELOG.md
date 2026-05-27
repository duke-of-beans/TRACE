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
- CORS lockdown (env-var based)
- Auth: invite codes for reporters, callsign + access code for operators
- Printable observation record (HTML endpoint for print-to-PDF)
- Public incident form (token-gated, rate-limited, 48h expiry)
- Rapid capture endpoint with auto-GPS

### Quality
- YUMA gate: 17 tests, 76+ checks, 0 warnings
- 6 test tiers: static analysis, behavioral, terminology, visual, dependency, evidence chain
- Full terminology compliance (concern levels, records, observed persons)
- Visual regression baseline (10 authenticated screenshots via Puppeteer)
