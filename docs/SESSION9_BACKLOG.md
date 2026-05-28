# TRACE Session 9 Backlog

## P1: Security — Disable Screenshot/Copy/Highlight
- CSS `user-select: none` on all sensitive content (sighting data, plates, actor info, reports)
- Prevent right-click context menu on data surfaces
- Disable text highlighting across PWA and operator console
- Platform-specific screenshot prevention where possible (CSS, meta tags)
- Allow copy only on explicitly copyable elements (BTC address, invite codes, report export buttons)
- Test on mobile (PWA) and desktop (operator console)

## P2: Operator Guide — Complete Usage Documentation
Enhance docs.html into comprehensive operator manual:
- Dashboard overview and stat interpretation
- Triage workflow (keyboard shortcuts, bulk actions, what each action means)
- Activity Map deep dive (all filter options, watchpoints, corridors, time slider, right-click menu)
- Vehicle management (concern levels, promotion, photos, behavior patterns, co-occurrence)
- Actor management (identifiers, linking to vehicles)
- Reports page (behavior report interpretation, co-occurrence analysis, export workflow)
- Dispatch system (creating, assigning, resolving, event types)
- Import pipeline (supported formats, sheet selection, column mapping, preview workflow)
- Harassment review (number tracking, tagging, responses)
- Admin configuration (reporters, invite codes, concern levels, event types, integrations)
- Node Settings overview (what each section means for non-technical operators)

## P3: Reporter Guide — Create Field Manual
New comprehensive guide for field reporters:
- Getting started (PIN setup, what the callsign means)
- Submitting a sighting (step by step with what each field means)
- Burst capture (when to use it, how to tag later)
- Photo best practices (what to capture, angles, safety)
- History tab (reviewing submissions, burst tagging, seeing operator responses)
- Harassment reporting (when and how to report numbers)
- Offline mode (how it works, queue indicator, reconnection)
- Emergency wipe (when to use, what it destroys, how to trigger)
- Automatic check-in (what the 72-hour window means)
- Settings (deadman switch, panic options)
- Safety practices (not getting caught photographing, situational awareness)

## P4: ConfirmedVehicles Import
Pipeline ready. Admin → Import → Select "ICE Raid Vehicles" sheet → Preview → Import.
