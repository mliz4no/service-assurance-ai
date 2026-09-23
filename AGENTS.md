# AGENTS.md — service-assurance-ai

Network monitoring, ticketing, and escalation SaaS: synthetic + Nagios
monitoring, multi-vendor controller integrations (Meraki/Fortinet/Palo
Alto/SD-WAN), incident correlation, SLA/escalation matrix with multi-channel
notifications, public outage map, CRM (Salesforce) and tax (Avalara)
integrations, and an InvoxAI ingestion webhook.

## Tech Stack
- Backend: Node/Express 5 + TypeScript, esbuild, pnpm workspaces, Pino logging,
  Helmet/CORS/rate-limiting, Vitest + Supertest
- Frontend: React 19 + Vite, Wouter routing, TanStack React Query, React Hook
  Form + Zod, Radix UI + shadcn/ui, Tailwind + CVA, Recharts, Leaflet (+cluster),
  Framer Motion, Sonner toasts
- DB: PostgreSQL + Drizzle ORM (29 tables), Drizzle Kit migrations
- API contract: Orval-generated OpenAPI types + `lib/api-client-react` React
  Query hooks; `lib/api-zod` for shared Zod schemas
- Deployment: Docker (Render), Vercel (frontend SPA)

## Structure
```
artifacts/api-server/       Express + TS backend
artifacts/service-assurance/ React + Vite frontend SPA
artifacts/mockup-sandbox/    UI component sandbox
artifacts/engineering-deck/  Presentation/demo app
lib/api-spec/ api-zod/ api-client-react/   Shared API contract layer
lib/db/                      Drizzle schemas + migrations
scripts/                     Seed data, CLI tools
```
Key backend modules: `middlewares/auth.ts` (sessions/API keys),
`lib/monitoring-*.ts` (scheduler/checks/incidents), `connectors/*` (vendor
integrations), `lib/escalation-matrix.ts` + `notification-delivery.ts` +
`pagerduty-delivery.ts`, `routes/salesforce.ts`, `routes/avalara.ts`,
`routes/public-network-map.ts`.

## Build / Run / Test
```bash
pnpm install
cp .env.example .env
pnpm db:up && pnpm db:push && pnpm db:seed
pnpm --filter @workspace/api-server run dev     # http://localhost:8080
pnpm --filter service-assurance run dev         # http://localhost:5173
pnpm --filter @workspace/api-server run test    # Vitest + Supertest
pnpm build
pnpm api:codegen        # regenerate API client from OpenAPI spec (Orval)
pnpm typecheck
```
Key env vars: `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS`,
`TRUST_PROXY`, `LOGIN_RATE_LIMIT_*`, `PROBE_RATE_LIMIT_*`,
`MONITORING_SCHEDULER_ENABLED`, `MONITORING_INTERVAL_MS`, `MONITORING_MODE`.

## Conventions
- New tables go in `lib/db/`, regenerate types, and expose via OpenAPI spec so
  `lib/api-client-react` hooks stay in sync — don't hand-roll fetch calls in
  frontend components.
- After changing `lib/db/src/schema/*.ts`, run
  `cd lib/db && pnpm drizzle-kit generate --config ./drizzle.config.ts` and
  commit the resulting migration + `meta/` snapshot. Local dev commonly uses
  `pnpm db:push` (syncs schema directly), but CI/prod run
  `pnpm db:migrate` (applies committed `.sql` files only) — schema changes
  applied only via `db:push` will pass locally and fail in CI with
  `column "..." does not exist`.
- CI (`ci.yml`) sets `NODE_ENV: test` at job level for the DB/test steps; the
  `pnpm run build` step overrides it to `NODE_ENV: production` so Vite ships
  production React builds instead of inflating the bundle-size budget.
- New vendor controller integrations must implement the `connectors/base.ts`
  interface for a normalized device/link abstraction.
- Notification channels (email/webhook/PagerDuty) go through
  `notification-delivery.ts` for consistent retry/circuit-breaking behavior.
- Public (anonymous) routes are explicitly separated (`/api/public/*`) —
  never leak tenant data on these paths.
- Multi-tenant data (customers/sites/services) must be scoped consistently;
  follow existing patterns in `routes/customers.ts`/`routes/sites.ts`.
- ARIN RDAP has no `/registry/search?name=` route; use `/registry/entities?fn=NAME*`
  for org metadata and `/registry/autnums?name=NAME*` for ASN discovery
  (`autnumSearchResults[].handle`). See `lib/arin-isp-crawler.ts`.

## Cross-repo component inventory
See [../COMPONENT_INVENTORY.md](../COMPONENT_INVENTORY.md). This repo is the
workspace reference for: OpenAPI-first codegen (paired with GAS-MANAGER),
multi-vendor connector abstraction, escalation/notification delivery, and
Radix/shadcn UI components (severity/status badges, app layout shell).

---

## Helper Subagents

Available agents

- **Explore** — Fast read-only codebase exploration and Q&A subagent.
  - Purpose: Quickly search the codebase, locate files, and answer questions about structure or symbols.
  - Invocation: call the `runSubagent` tool with `agentName: "Explore"` and include a prompt describing what to look for and desired thoroughness (quick/medium/thorough).
  - Example: ask the agent to "Find all usages of `createUser` across the repo (thorough)".

How to request an agent

- Tell me what you want the agent to do (e.g., "Run Explore to find TODOs in `service-assurance`"), and I will invoke it and return a concise summary of results.

Extending agents

- To add more agents, update this file with a short name, purpose, and example invocation, then register the agent in the orchestration layer that calls `runSubagent`.
