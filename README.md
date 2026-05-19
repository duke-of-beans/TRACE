# DCS — Decentralized Crime Stoppers

**Vehicle Tracking & Pattern Analysis System**

> Confidential — Do not distribute

## Overview

DCS is a federated system for volunteer crime-watch organizations that track suspicious vehicles swapping license plates across neighborhoods. It replaces manual workflows with automated ingestion, pattern detection, and case reporting — built for nationwide scale from day one.

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
    └──────┬──────┘   └──────┬──────┘   └──┬──────────┘
           │                  │              │
       Reporters          Reporters      Reporters
```

**Cell** — Each chapter runs a self-contained processing node with its own database, local AI (Llama via Ollama), and pattern engine. Fully operational offline.

**Mesh** — Cells share anonymized vehicle profiles and pattern metadata. Raw media and reporter identities never leave the cell.

## Core Components

| Component | Purpose |
|-----------|---------|
| **Reporter PWA** | Mobile upload app — camera-first, offline-capable, per-chapter branding |
| **Processing Cell** | Local ingestion, EXIF extraction, vehicle feature analysis, pattern detection |
| **Vehicle Identity** | Persistent dossiers built on visual features, not plates |
| **Pattern Engine** | Plate swaps, spatiotemporal clustering, co-occurrence, anomaly detection |
| **Operator Interface** | Triage queue, live map, dossier management, keyboard-driven workflows |
| **Case Package Builder** | Integrity-verified reports for attorneys and partner organizations |
| **National Mesh** | Cross-region matching, corridor analysis, federated intelligence |

## Roles

- **Reporter** — Field volunteer. Submit-only access + personal history.
- **Operator** — Daily workflow. Triage, review, map, patterns, case packages.
- **Admin** — Chapter management. Reporters, config, identity vault, audit logs.

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

## Design Philosophy

Government-utilitarian. Typography creates hierarchy. Color is functional only. Tables over cards. Side panels over navigation. Keyboard shortcuts. Prints cleanly. Works on slow connections.

## Status

**Phase: Pre-engagement** — System designed, client questionnaire issued, awaiting answers before spec finalization.

## License

Proprietary. All rights reserved.
