# TRACE — Tracking, Reporting, Analysis & Community Evidence

**Community-Driven Vehicle Pattern Analysis System**

> Confidential — Do not distribute

## Overview

TRACE is a federated system for volunteer community-watch organizations that track suspicious vehicles swapping license plates across neighborhoods. It replaces manual workflows with automated ingestion, pattern detection, and case reporting — built for nationwide scale from day one.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NATIONAL MESH                      │
│  Cross-cell matching · Corridor analysis · Digests   │
└──────────┬──────────────────┬──────────────┬────────┘
           │                  │              │
    ┌──────┴──────┐   ┌──────┴──────┐   ┌──┴──────────┐
    │   CELL A    │   │   CELL B    │   │   CELL C     │
    │  Chapter X  │   │  Chapter Y  │   │  Chapter Z   │
    │             │   │             │   │              │
    │ Local DB    │   │ Local DB    │   │ Local DB     │
    │ Local LLM   │   │ Local LLM   │   │ Local LLM    │
    │ Processing  │   │ Processing  │   │ Processing   │
    │ [VIGIL]*    │   │             │   │ [VIGIL]*     │
    └──────┬──────┘   └──────┬──────┘   └──┬──────────┘
           │                  │              │
       Reporters          Reporters      Reporters

* VIGIL module — toggled per cell
```

**Cell** — Each chapter runs a self-contained processing node with its own database, local AI (Llama via Ollama), and pattern engine. Fully operational offline.

**Mesh** — Cells share anonymized vehicle profiles and pattern metadata. Raw media and reporter identities never leave the cell.

## Core Components

| Component | Purpose |
|-----------|---------|
| **Reporter PWA** | Mobile upload app — camera-first, offline-capable, per-chapter branding |
| **Processing Cell** | Local ingestion, EXIF extraction, vehicle feature analysis, pattern detection |
| **Vehicle Identity** | Persistent dossiers built on visual features, not plates |
| **Suspicion Engine** | Graduated, criteria-based vehicle escalation with admin-defined levels |
| **Actor Database** | Driver/criminal profiles with risk classification, linked to vehicles |
| **Pattern Engine** | Plate swaps, spatiotemporal clustering, co-occurrence, anomaly detection |
| **Geospatial Intelligence** | Area heatmaps, corridor visualization, temporal layers, co-occurrence zones |
| **Operator Interface** | Triage queue, live map, dossier management, keyboard-driven workflows |
| **Case Package Builder** | Legal-grade, integrity-verified reports for attorneys and partner organizations |
| **National Mesh** | Cross-region matching, corridor analysis, federated intelligence |

## Toggleable Modules

The cell architecture supports optional processing modules. These are disabled by default and carry zero overhead when off. Chapter admins enable them in cell config when their workflow requires it.

### VIGIL — Video Intelligence Gathering & Indexing Layer

**Status:** Planned module
**Toggle:** Cell-level, admin-controlled
**Hardware:** Requires GPU-capable cell hardware (dedicated or upgraded)

Adapted from an existing internal tool. VIGIL adds a video processing pipeline to the cell for chapters that receive dashcam footage, surveillance clips, or other video evidence.

**Pipeline:**
1. Video ingestion (reporter uploads or batch folder drop)
2. Scene change detection via ffmpeg
3. Keyframe extraction at vehicle-present moments
4. Frame analysis via local vision model (Llama Vision / LLaVA on Ollama — no cloud APIs)
5. Vehicle feature extraction from each keyframe (color, make, model, body type, plate if visible)
6. Candidate sighting generation — each extracted frame becomes a pre-populated sighting record
7. Candidate sightings appear in the operator's triage queue tagged `video-extracted` with source footage link and timestamp

**Batch mode:** Reporter drops a folder of dashcam files, VIGIL processes overnight, operator has a queue of extracted sightings the next morning.

**Visual-heavy mode:** Auto-detects silent or music-only video and shifts to frame-first analysis (skips transcription).

**Future modules** will follow this same plugin pattern — disabled by default, zero overhead when off, admin-toggled, hardware requirements documented.

## Roles

- **Reporter** — Field volunteer. Submit-only access + personal history.
- **Operator** — Daily workflow. Triage, review, map, patterns, case packages.
- **Admin** — Chapter management. Reporters, config, identity vault, audit logs, module toggles.

## Security

- All data encrypted at rest (AES-256) and in transit (TLS + WireGuard)
- Reporter pseudonymity — real identities in separate encrypted vault
- All AI processing local (no cloud APIs)
- Immutable audit logging on all data access
- Cryptographic integrity hashing from point of capture
- Evidence chain-of-custody for case packages

## Tech Stack (Planned)

- **Reporter App**: PWA (works offline, no app store)
- **Cell**: Docker · PostgreSQL + PostGIS · Ollama (local LLM) · Node.js
- **National Mesh**: PostgreSQL + TimescaleDB · Redis pub/sub · WireGuard VPN
- **Frontend**: React — utilitarian/government design language
- **VIGIL Module**: ffmpeg · Whisper (local) · Llama Vision via Ollama
- **Maps**: OpenStreetMap + Leaflet.js (self-hosted tiles, no usage cost)

## Design Philosophy

Government-utilitarian. Typography creates hierarchy. Color is functional only. Tables over cards. Side panels over navigation. Keyboard shortcuts. Prints cleanly. Works on slow connections.

## Status

**Phase: Spec finalization** — Requirements synthesis complete, all client questions resolved, security architecture pending.

## License

Open source with controlled distribution. Architecture documentation shared with trusted associates only.
