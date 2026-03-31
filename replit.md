# Service Assurance AI

A full-stack enterprise telecom service assurance and ticket orchestration platform for MSPs, telecom aggregators, and technology advisors.

## Architecture

**Monorepo (pnpm workspaces)**

- `artifacts/api-server` — Express 5 REST API server (port 8080, proxied at `/api`)
- `artifacts/service-assurance` — React + Vite frontend (port auto-assigned, at `/`)
- `lib/db` — Drizzle ORM schema + PostgreSQL migrations
- `lib/api-spec` — OpenAPI 3.1 spec (`openapi.yaml`)
- `lib/api-client-react` — Generated React Query hooks + Zod schemas (from OpenAPI codegen)
- `scripts` — Seed script and utilities

## Features

- **Customer / Site / Service / Circuit management** — full CRUD
- **Multi-vendor ticket management** — with SLA tracking, escalation flags, vendor ticket IDs
- **AI-powered capabilities** (OpenAI gpt-4o-mini):
  - Ticket summarization, status normalization, customer update generation
  - Controller event analysis (`summarizeControllerEvent`, `inferProbableImpact`)
- **Role-based auth**: admin / ops / customer (Bearer token, in-memory session store)
- **Dashboard**: KPI stat cards, recent tickets, escalation queue
- **Admin panel**: SLA policy CRUD, user management, config health, AI test panel

### Controller Integrations (new)
- **Controllers** (`/controllers`) — Cisco Meraki and Fortinet controller CRUD, test connection, sync now
- **Managed Devices** (`/devices`) — Devices registered from controllers; status online/offline/degraded, HA state, customer/site mapping
- **Network Links** (`/network-links`) — WAN uplinks, VPN tunnels, LTE backup, SD-WAN transports; real-time metrics (latency, jitter, packet loss)
- **Event Monitor** (`/events`) — Controller-sourced events with severity badges; click-through AI analysis panel; incident correlation to tickets
- **Incident Correlator** — Auto-correlates controller events to existing tickets; writes `incidentCorrelations` rows and flags tickets as controller-sourced with failover state

### New DB Tables (controller module)
`controllers`, `managed_devices`, `network_links`, `device_events`, `controller_sync_logs`, `incident_correlations`

### New API Routes
- `GET/POST /api/controllers`, `GET/PUT/DELETE /api/controllers/:id`, `POST /api/controllers/:id/test`, `POST /api/controllers/:id/sync`
- `GET /api/devices`, `GET/PUT /api/devices/:id`
- `GET /api/network-links`
- `GET /api/device-events`, `GET /api/device-events/:id`, `POST /api/device-events/:id/ai-analyze`

### Custom Frontend Hooks
`artifacts/service-assurance/src/lib/controller-hooks.ts` — hand-written React Query hooks for controller module endpoints (not in OpenAPI spec/generated client)

## Auth

- Bearer token authentication (no cookies/JWTs)
- Token stored in `localStorage` under key `sa_auth_token`
- API client reads token via `setAuthTokenGetter` from `@workspace/api-client-react`
- `ProtectedRoute` component in `auth.tsx` redirects unauthenticated users to `/`

## Seed Credentials

| Role     | Email                          | Password  |
|----------|-------------------------------|-----------|
| Admin    | admin@serviceassurance.ai     | Admin123! |
| Ops      | ops@serviceassurance.ai       | Ops123!   |
| Customer | portal@acme.com               | Acme123!  |

## Key Files

- `artifacts/api-server/src/routes/` — All API route handlers
- `artifacts/api-server/src/lib/ai.ts` — OpenAI integration
- `artifacts/api-server/src/lib/session-store.ts` — In-memory session store
- `lib/db/src/schema/index.ts` — Database schema (Drizzle)
- `scripts/src/seed.ts` — Database seeder
- `artifacts/service-assurance/src/App.tsx` — Router with `ProtectedRoute` guards
- `artifacts/service-assurance/src/lib/auth.tsx` — Auth context + `ProtectedRoute`
- `artifacts/service-assurance/src/main.tsx` — `setAuthTokenGetter` setup, `saveToken`/`clearToken` helpers

## Database

PostgreSQL via `DATABASE_URL` environment variable. Schema pushed with `pnpm --filter @workspace/db run push`. Seed with `pnpm --filter @workspace/scripts run seed`.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — Session signing secret
- `OPENAI_API_KEY` — Required for AI features (ticket summarization, status normalization, customer updates)

## Running

All three workflows run automatically:
1. `artifacts/api-server: API Server` — builds and starts the API
2. `artifacts/service-assurance: web` — Vite dev server for the frontend
3. `artifacts/mockup-sandbox: Component Preview Server` — Canvas mockup server (unused in production)
