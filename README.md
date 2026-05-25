# TRACE

**Tracking, Reporting, Analysis & Community Evidence**

Community vehicle tracking platform for neighborhood safety chapters. Replaces chat-and-Excel workflows with a structured intelligence system that's faster than texting.

## Architecture

Three-vault PostgreSQL architecture with physical schema separation:

| Vault | Schema | Purpose | Constraint |
|-------|--------|---------|------------|
| **A** | `ops` | Operational data - vehicles, sightings, actors (pseudonymous) | Full CRUD |
| **B** | `ident` | Reporter real identities, auth tokens, sessions | Separate encryption key |
| **C** | `evidence` | Write-once evidence locker, SHA-256 hash chain | INSERT + SELECT only |

A full dump of Vault A reveals **zero real identities** - by architecture, not policy.

### Stack

- **Runtime:** Node.js 22 + TypeScript
- **Server:** Hono
- **Database:** PostgreSQL (self-hosted) + Drizzle ORM
- **Auth:** Magic link (no passwords), TOTP for operator/admin
- **Maps:** OpenStreetMap + Leaflet.js (self-hosted tiles)
- **Real-time:** WebSocket for operator triage queue
- **Target:** 8GB RAM, spinning disk, no GPU

## Setup

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Bootstrap database (as PostgreSQL superuser)
psql -U postgres -f migrations/000_bootstrap.sql

# Push schema to database
npm run db:push

# Seed default data (chapter, vehicle types, suspicion ladder)
npm run db:seed

# Run development server
npm run dev
```

## Project Structure

```
src/
  api/              API routes (Hono)
    sightings/      Core intake - reporter submissions
    vehicles/       Vehicle dossier CRUD + search
    actors/         Criminal profile management
    auth/           Magic link + TOTP auth (Vault B only)
    admin/          Chapter config, reporter invite, notification topology
  db/
    schema/         Drizzle schema (three vaults)
      shared.ts     Common types, schema refs, enums
      vault-a.ts    Operational (pseudonymous)
      vault-b.ts    Identity (separate encryption)
      vault-c.ts    Evidence locker (write-once)
    connection.ts   Three separate connection pools
    seed.ts         Default chapter + taxonomy data
  services/         Business logic
  middleware/       Auth, chapter scope, audit
  types/            Shared TypeScript types
docs/               Requirements, security architecture, edge cases
migrations/         SQL migration files
pwa/                Reporter PWA (planned)
operator/           Operator dashboard (planned)
```

## Documentation

- [Requirements Synthesis](docs/REQUIREMENTS_SYNTHESIS.md)
- [Security Architecture](docs/SECURITY_ARCHITECTURE.md)
- [Security Edge Cases](docs/SECURITY_EDGE_CASES.md)
- [MOIRÉ White Paper](docs/moire/MOIRE_White_Paper_v2.pdf)

## License

Source-available. Approved chapters only.
