# Contributing to TRACE

**T**racking, **R**eporting, **A**nalysis & **C**ommunity **E**vidence

## Development Setup

### Prerequisites
- Node.js 22+
- PostgreSQL 15+ (local, Docker, or Neon)

### Quick Start

```bash
git clone <your-fork-url>
cd TRACE
npm install
cd pwa && npm install && cd ..
cd operator && npm install && cd ..
cp .env.example .env
# Edit .env with your database credentials
```

### With Docker (recommended)

```bash
docker compose up -d   # starts PostgreSQL + app
# or just the database:
docker compose up db -d
npm run dev             # run the app locally against Docker Postgres
```

### Database

```bash
npx drizzle-kit generate --name your-migration   # generate migration
npx drizzle-kit migrate                           # apply migrations
npx tsx src/db/seed.ts                            # seed demo data
```

### Run locally

```bash
npm run dev              # API on :3100
cd pwa && npm run dev    # Reporter PWA on :5173
cd operator && npm run dev  # Operator console on :5174
```

Demo login: operator callsign `OPERATOR` (no access code in dev mode), reporter code `TEST-CODE`.

## Project Structure

```
src/api/         API routes (Hono)
src/db/schema/   Drizzle ORM schemas (three vaults)
src/services/    Business logic (plate lookup, notifications, etc.)
pwa/             Reporter PWA (Preact)
operator/        Operator console (React)
shared/design/   Design tokens shared between apps
migrations/      SQL migration files
scripts/         Build tools, PDF generator, dependency checker
```

## Architecture Rules

### Three-Vault Separation
- `ops` schema: operational data (vehicles, sightings, actors, dispatches)
- `ident` schema: reporter identities, auth tokens, sessions
- `evidence` schema: write-once evidence records with hash chain

Never join across vaults in application code. The only cross-vault link is `reporter_id` (UUID).

### Security
- No real identities in the `ops` schema. Ever.
- Push notification payloads are SIGNALS, not content. No plate numbers, no locations, no descriptions in push payloads.
- Photos are EXIF-scrubbed on the reporter's device before upload.
- All timestamps have ±30s jitter applied for reporter protection.

### Dependencies
Check `DEPENDENCIES.md` before committing. Run `python scripts/check-deps.py` to see which docs/artifacts need updating when you change source files.

After changing any markdown docs, regenerate PDFs:
```bash
python scripts/gen-pdfs.py
```

## Code Style

- TypeScript throughout
- Functional components (React/Preact hooks)
- No classes except where Leaflet requires them
- Tailwind utility classes in operator app
- CSS custom properties in PWA (lighter weight)

## Commit Messages

Format: `type: description`

Types: `feat`, `fix`, `docs`, `auth`, `ux`, `refactor`, `chore`
