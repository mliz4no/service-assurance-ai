# Service Assurance AI

Service Assurance AI is a monorepo for a telecom service assurance platform. The repository contains:

- `artifacts/api-server` — the Node.js API server and backend app
- `artifacts/service-assurance` — the main service assurance frontend app
- `artifacts/mockup-sandbox` — a sandbox/demo frontend for prototyping UI components
- `artifacts/engineering-deck` — a demo presentation app
- `lib/` — shared libraries for API clients, database access, and schema definitions
- `scripts/` — utility scripts, database seeders, and development helpers

## Architecture

- API server: built with Express and TypeScript in `artifacts/api-server`
- Database: uses PostgreSQL, managed by Drizzle ORM in `lib/db`
- Shared schema and API types: defined in `lib/api-spec`, `lib/api-zod`, and `lib/api-client-react`
- Front-end apps: Vite-based React apps in `artifacts/service-assurance`, `artifacts/mockup-sandbox`, and `artifacts/engineering-deck`
- Local DB orchestration: supported via `docker-compose.yml` for a local PostgreSQL container

## Getting started

1. Install dependencies

```bash
pnpm install
```

2. Copy the example environment file

```bash
cp .env.example .env
```

3. Start the local PostgreSQL database

```bash
pnpm db:up
```

4. Set any additional values in `.env`

- `DATABASE_URL` should point to your local PostgreSQL instance
- `PORT` is used by the API server
- `SESSION_SECRET` is required for session/auth features
- `OPENAI_API_KEY` is optional for AI-related functionality

## Run the project

### API server

From the repo root:

```bash
pnpm --filter @workspace/api-server run dev
```

This starts the API server with `.env` loaded automatically.

### Frontend app

For the main service assurance app:

```bash
pnpm --filter service-assurance run dev
```

### Full development setup

In VS Code, use the launch configuration `Dev: All (API + Frontend)` to start the API server and the main frontend together.

## Database

- `docker-compose.yml` defines a local PostgreSQL service on port `5432`
- The default local connection URL is:

```text
postgresql://service_assurance:service_assurance@localhost:5432/service_assurance
```

- Run schema push or seed commands from the repo root:

```bash
pnpm db:push
pnpm db:seed
```

## Notes

- `.env` is ignored by Git, and `.env.example` provides a starting point for local configuration.
- Use `pnpm db:down` to stop the local database when finished.
