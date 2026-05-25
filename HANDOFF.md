# TRACE Session Handoff
## Picking up from 2026-05-24 marathon session

---

## What TRACE Is

**TRACE** — Tracking, Reporting, Analysis & Community Evidence
Community vehicle tracking platform for neighborhood safety chapters.
GitHub: `duke-of-beans/TRACE` (private)
Local: `D:\Projects\TRACE`
KERNL: registered as `trace` in `client_work` group

---

## What Exists

### Requirements (COMPLETE)
All 7 client questionnaire questions resolved in TRACE_REQUIREMENTS_SYNTHESIS.md.
Key decisions:
- Vehicle type taxonomy: Runner/Scout/Stash/Decoy (admin-editable)
- Graduated suspicion levels: Noticed → Suspicious → Confirmed → Active Criminal → Retired
- Criteria-based promotion (identified driver, identified activities, identified root location)
- Driver/actor database with risk levels (Aggressive, Stalker)
- 90-day vehicle sunsetting, soft retirement, one-click reactivation
- PWA must be faster than texting — replaces chat groups entirely
- ~20 reporters now, overbuild to 50-100
- Case packages stubbed, built for legal-grade soundness from day one
- Open source for approved groups from day one
- Deployment target: 8GB RAM, spinning disk, no GPU

### Geospatial Intelligence Layer (DESIGNED)
Area heatmaps, vehicle corridor visualization, temporal layers (time slider),
co-occurrence zones, driver territory mapping.
Stack: OpenStreetMap + Leaflet.js (self-hosted tiles, zero cost).

### Security Architecture (COMPLETE)
Full spec in TRACE_SECURITY_ARCHITECTURE.md. Key elements:
- Two-vault architecture: Vault A (operational, pseudonymous), Vault B (identity, separate key in OS keychain), Vault C (evidence locker, write-once SHA-256 chain)
- Magic link auth (no passwords), TOTP for operator/admin
- Reporter-to-reporter invisibility
- Submission timing jitter ±30sec
- EXIF device info stripped (GPS/timestamp preserved)
- Panic wipe gesture
- Push notifications as signals not content

### MOIRÉ Security Construction (COMPLETE — separate from TRACE)
Ghost mode / deception layer designed as a general construction, published as a white paper.
The MOIRÉ construction is applicable to TRACE but is a standalone research contribution.
White paper live at davidkirsch.me/papers/moire-fpe-deception-middleware.pdf

### Edge Cases (COMPLETE)
Full catalog in TRACE_SECURITY_EDGE_CASES.md:
- Search inversion attack (bidirectional distortion required)
- Map tile mismatch (reverse-geocode distorted coordinates)
- Photo-data mismatch (reference image library or suppress)
- Multi-session inconsistency (credential-pinned keys)
- Ghost mode case packages must NEVER reach external parties

---

## What Does NOT Exist Yet

- No code. No repo structure beyond README.
- No database schema
- No API design
- No UI wireframes or component architecture
- No build order / sprint plan
- No data import pipeline for dirty Excel data
- No notification system design

---

## Where the Documents Live

All session outputs are in `/mnt/user-data/outputs/`:
- `TRACE_REQUIREMENTS_SYNTHESIS.md` — full requirements spec v1.1
- `TRACE_SECURITY_ARCHITECTURE.md` — security spec
- `TRACE_SECURITY_EDGE_CASES.md` — edge case catalog
- `MOIRE_FPE_Deception_Middleware_v2.pdf` — white paper (already on website)
- `MOIRE_ADVERSARIAL_META_GAME.md` — adversarial analysis
- `EDGE_CASE_DEEP_DIVE.md` — deep technical edge cases

These should be pushed to the TRACE repo under `docs/` if not already done.

---

## Build Philosophy (from client)

No MVPs. No timelines. Build it right, build it complete.
Architecture shared with trusted associates only.
Open source from day one for approved groups.

---

## Suggested Next Steps

1. **Push session documents to TRACE repo** under `docs/`
2. **Database schema design** — PostgreSQL for the two-vault architecture
3. **API design** — endpoints for sighting submission, vehicle lookup, actor management
4. **Data import pipeline** — normalize dirty Excel (hundreds of rows, 12+ columns, 1-6 photos per sighting)
5. **PWA scaffolding** — Tauri or pure PWA, needs to be faster than texting
6. **Build order** — sequence the implementation

---

## Brain.db Context

Search these entities for full context:
- `TRACE` — product details, requirements, security
- `MOIRÉ` — deception construction, white paper, adversarial analysis
- `davidkirsch.me` — website details, deployment info
- `Multiplicative Composition` — new research project (general theory)
- `HIRM` — equation now understood as instance of multiplicative composition

---

## Voice

SCRVNR research environment with casual modulation.
Hyphens only (no em-dashes). Contractions ~55-60%.
