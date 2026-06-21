# Service Assurance AI

Service Assurance AI is a monorepo for a telecom service assurance platform.

## Repository layout

The repository contains:

- `artifacts/api-server` — the Node.js API server and backend app
- `artifacts/service-assurance` — the main service assurance frontend app
- `artifacts/mockup-sandbox` — a sandbox/demo frontend for prototyping UI components
- `artifacts/engineering-deck` — a demo presentation app
- `lib/` — shared libraries for API clients, database access, and schema definitions
- `scripts/` — utility scripts, database seeders, and development helpers

## Architecture

- API server: Express + TypeScript in `artifacts/api-server`
- Database: PostgreSQL + Drizzle ORM in `lib/db`
- Shared schema and API types: `lib/api-spec`, `lib/api-zod`, and `lib/api-client-react`
- Front-end apps: Vite + React apps in `artifacts/service-assurance`, `artifacts/mockup-sandbox`, and `artifacts/engineering-deck`
- Local DB orchestration: `docker-compose.yml` provisions PostgreSQL for development

## Prerequisites

- Node.js 20+ (Node 24 works in this repository)
- pnpm 10+
- Docker Desktop (or Docker Engine with Compose)

## Getting started

1. Install dependencies

```bash
pnpm install
```

2. Create local environment file

Linux/macOS/Git Bash:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Start local PostgreSQL

```bash
pnpm db:up
```

4. Apply schema and seed demo data

```bash
pnpm db:push
pnpm db:seed
```

5. Start the API server

```bash
pnpm --filter @workspace/api-server run dev
```

6. Start the main frontend app (separate terminal)

```bash
pnpm --filter service-assurance run dev
```

## Environment variables

Key values in `.env`:

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: API server port (default: `8080`)
- `SESSION_SECRET`: session/auth secret
- `OPENAI_API_KEY`: optional, only needed for AI-related features
- `NODE_ENV`: development/production mode

Default local DB URL:

```text
postgresql://service_assurance:service_assurance@localhost:5432/service_assurance
```

## Run options

### VS Code launch (recommended)

Use `Dev: All (API + Frontend)` to run API + UI together.

### Manual commands

API only:

```bash
pnpm --filter @workspace/api-server run dev
```

Main frontend only:

```bash
pnpm --filter service-assurance run dev
```

## Database

- Start DB:

```bash
pnpm db:up
```

- Stop DB:

```bash
pnpm db:down
```

- Push schema:

```bash
pnpm db:push
```

- Seed sample data:

```bash
pnpm db:seed
```

## Troubleshooting

- `DATABASE_URL, ensure the database is provisioned`
	- Confirm `.env` exists at repo root.
	- Confirm PostgreSQL is running: `pnpm db:up`.
	- Reapply schema: `pnpm db:push`.

- Windows error: `"export" no se reconoce...`
	- This repo already uses cross-platform scripts.
	- If you still see this, run `pnpm install` and retry.

- Seed errors during API startup
	- Run seed explicitly first: `pnpm db:seed`.
	- Then start API: `pnpm --filter @workspace/api-server run dev`.

## Notes

- `.env` is ignored by Git; use `.env.example` as template.
- `pnpm` is required; npm/yarn are blocked by `preinstall` safeguards.

## InvoxAI Integration

The API supports machine-to-machine sync from InvoxAI without user session login.

Required environment variables:

- `INVOXAI_API_KEY` or `INVOXAI_API_KEYS` (comma-separated)
- `INVOXAI_API_SCOPES` (default: `integrations:create,integrations:read`)

Authentication:

- Use header `x-api-key: <invoxai-key>`
- Session auth for UI users continues to work unchanged

Idempotency:

- For integration calls to create endpoints, send `Idempotency-Key`
- Supported endpoints:
	- `POST /api/customers`
	- `POST /api/sites`
	- `POST /api/services`
	- `POST /api/tickets`
- Same key + same payload returns the original success response
- Same key + different payload returns `409 CONFLICT`

External identity tracking:

- Customer, site, service, and ticket records now support:
	- `externalSource`
	- `externalId`
	- `externalSyncedAt`
	- `externalSyncStatus`

Upsert endpoints (InvoxAI):

- `POST /api/integrations/invoxai/customers/upsert`
- `POST /api/integrations/invoxai/sites/upsert`
- `POST /api/integrations/invoxai/services/upsert`
- `POST /api/integrations/invoxai/tickets/upsert`

Lookup by external identity:

- `GET /api/customers?externalSource=invoxai&externalId=...`
- `GET /api/sites?externalSource=invoxai&externalId=...`
- `GET /api/services?externalSource=invoxai&externalId=...`
- `GET /api/tickets?externalSource=invoxai&externalId=...`
- Add `compact=true` for a compact integration-friendly payload
