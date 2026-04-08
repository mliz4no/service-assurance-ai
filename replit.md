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
- **Role-based auth**: admin / ops / customer / telecom_services_partner (Bearer token, in-memory session store)
- **Dashboard**: KPI stat cards, recent tickets, escalation queue
- **Admin panel**: SLA policy CRUD, user management, partner management, config health, AI test panel

### Network Map (new)
- **Map page** (`/map`) — Interactive Leaflet map with all sites as colored teardrop pin markers
  - Color-coded by device status: green=online, amber=degraded, red=offline, gray=unknown
  - Clustering via `react-leaflet-cluster` for dense areas
  - Left filter sidebar: customer filter, status filter, layer toggles (Sites/Devices), status count summary
  - Clicking a marker shows a detail overlay card with site info, device status breakdown, open ticket count, and a "View Site" link
  - Legend panel (bottom-right) with status color key
  - All 14 seeded US sites have real WGS-84 coordinates
- **DB schema**: `latitude`, `longitude`, `geoSource` added to `sites` and `managed_devices` tables
- **API**: `GET /api/sites` now returns lat/lng; `POST/PUT /api/sites` accept lat/lng

### Controller Integrations (new)
- **Controllers** (`/controllers`) — Cisco Meraki and Fortinet controller CRUD, test connection, sync now
- **Managed Devices** (`/devices`) — Devices registered from controllers; status online/offline/degraded, HA state, customer/site mapping
- **Network Links** (`/network-links`) — WAN uplinks, VPN tunnels, LTE backup, SD-WAN transports; real-time metrics (latency, jitter, packet loss)
- **Event Monitor** (`/events`) — Controller-sourced events with severity badges; click-through AI analysis panel; incident correlation to tickets
- **Incident Correlator** — Auto-correlates controller events to existing tickets; writes `incidentCorrelations` rows and flags tickets as controller-sourced with failover state

### Telecom Services Partner RBAC (new)
- **New role**: `telecom_services_partner` — scoped multi-customer portal access for resellers/aggregators
- **`telecom_services_partners` table**: id, name, companyName, email, phone, status, notes
- **Customer scoping**: `customers.telecomServicesPartnerId` links customers to a partner; `users.telecomServicesPartnerId` links user accounts to a partner org
- **Auth middleware**: on login, injects `req.partnerCustomerIds[]` (all customer IDs for that partner's org)
- **Server-side filtering**: `GET /customers`, `/sites`, `/services`, `/tickets`, `/devices` all filter by `inArray(table.customerId, partnerCustomerIds)` for partner users
- **Write blocks**: POST/PUT/DELETE on customers, services, tickets returns 403 for partner users
- **Partner-blocked endpoints** (403): `/controllers`, `/network-links`, `/device-events`, `/partners`
- **Notes suppression**: `customers.notes` (internal field) is omitted from partner-user responses
- **Frontend nav**: Partner users see a "Partner Portal" sidebar with My Customers / My Sites / My Services / My Incidents / My Devices / Map only
- **Route guard**: `InternalOnlyRoute` blocks partners from `/dashboard`, `/admin`, `/controllers`, `/events`, `/network-links` with redirect to `/customers`
- **Admin UI**: Partners card in `/admin` with full CRUD (admin only); `UserDialog` now supports `telecom_services_partner` role with partner organisation selector
- **Demo credentials**: `partneradmin@nexatek.com` / `Acme123!` (linked to Nexatek Solutions Ltd., sees 2 customers)

### New DB Tables (controller module)
`controllers`, `managed_devices`, `network_links`, `device_events`, `controller_sync_logs`, `incident_correlations`

### New API Routes
- `GET/POST /api/controllers`, `GET/PUT/DELETE /api/controllers/:id`, `POST /api/controllers/:id/test`, `POST /api/controllers/:id/sync`
- `GET /api/devices`, `GET/PUT /api/devices/:id`
- `GET /api/network-links`
- `GET /api/device-events`, `GET /api/device-events/:id`, `POST /api/device-events/:id/ai-analyze`

### Custom Frontend Hooks
`artifacts/service-assurance/src/lib/controller-hooks.ts` — hand-written React Query hooks for controller module endpoints (not in OpenAPI spec/generated client)

### ITIL Escalation & Notification System (new)
- **ITIL severity matrix** on tickets: `impactLevel` × `urgencyLevel` → auto-derived `severity` (high+high=critical, etc.)
- **Customer escalation contacts** (`customer_contacts` table): per-customer contacts with role (noc/manager/director/executive), `notifyOnSeverity` threshold, and optional `notifyOnDurationMinutes`
- **Notification engine** (`artifacts/api-server/src/lib/notificationEngine.ts`): evaluates contacts on ticket POST (fire-and-forget) and on `POST /api/tickets/:id/evaluate-escalation`; deduplicates by contact+reason per ticket; logs simulated emails to `escalation_notifications` table and writes system_event to ticket timeline
- **Escalation Notifications panel** in ticket detail (left column below Vendor & SLA): shows who was notified, when, why; expandable simulated email preview; "Evaluate" button for manual re-evaluation
- **Contacts tab** on customer detail: full inline CRUD for escalation contacts (add/edit/delete, role/severity/duration fields)
- **Ticket new form**: Impact + Urgency selectors in Classification section; Severity auto-derives and locks when both are set

#### New DB tables
`customer_contacts`, `escalation_notifications`

#### New API routes
- `GET/POST /api/customers/:id/contacts`
- `GET/PUT/DELETE /api/customers/:id/contacts/:contactId`
- `GET /api/tickets/:id/notifications`
- `POST /api/tickets/:id/evaluate-escalation`

#### Custom hooks
`lib/api-client-react/src/escalation-hooks.ts` — 6 hooks: `useGetCustomerContacts`, `useCreateCustomerContact`, `useUpdateCustomerContact`, `useDeleteCustomerContact`, `useGetTicketNotifications`, `useEvaluateEscalation`; all exported from `lib/api-client-react/src/index.ts`

#### Seeded contacts
10 contacts seeded across Nexatek and Broadfields customers (see `scripts/src/seed.ts`)

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
| Customer | portal@nexatek.com            | Acme123!  |
| Customer | portal@broadfields.com        | Acme123!  |

### Escalation Matrix Overrides (new)
- **Configurable ITIL severity matrix** — the Impact × Urgency → Severity mapping is now editable and overridable per scope
- **Scope hierarchy**: Global baseline → Customer override → Location (site) override → Circuit (service) override. Most specific scope wins per-cell.
- **DB**: `escalation_matrix_overrides` table stores non-default cells only (`scopeType`, `scopeId`, `impactLevel`, `urgencyLevel`, `derivedSeverity`)
- **DB**: `escalation_notifications.ruleDescription` — records which matrix scope determined the severity for each notification
- **API**: `GET /api/escalation-matrix?scopeType=X[&scopeId=Y]` → returns all 9 cells with `isOverride` flag
- **API**: `PUT /api/escalation-matrix` — batch upsert; cells matching defaults are auto-deleted (no junk stored)
- **API**: `DELETE /api/escalation-matrix/override/:id` — remove single override cell
- **Ticket creation**: severity is now derived using the resolved matrix (service → site → customer → global → default), not the hardcoded constant
- **Notification engine**: `ruleDescription` is recorded on each notification showing which scope's matrix was used (e.g. "Customer override · Impact: high, Urgency: medium → high")
- **UI — `EscalationMatrixEditor` component**: reusable 3×3 grid editor with color-coded severity dropdowns; overridden cells shown with ring highlight + "default: X" indicator; Save/Reset buttons; collapsible
- **UI integration**:
  - Admin page (`/admin`) — Global Matrix (expanded by default)
  - Customer detail Contacts tab — Customer Matrix Override (collapsed)
  - Site detail (`/sites/:id`) — Location Matrix Override (collapsed)
  - Service detail (`/services/:id`) — Circuit Matrix Override (collapsed)
  - EscalationPanel in ticket detail — shows `ruleDescription` per notification (which matrix rule fired)
- **Vendor Escalation untouched** — SLA policies, `nextEscalationAt`, and escalation queue are unchanged

## Key Files

- `artifacts/api-server/src/routes/` — All API route handlers
- `artifacts/api-server/src/lib/ai.ts` — OpenAI integration
- `artifacts/api-server/src/lib/session-store.ts` — In-memory session store
- `lib/db/src/schema/index.ts` — Database schema (Drizzle)
- `scripts/src/seed.ts` — Database seeder
- `artifacts/service-assurance/src/App.tsx` — Router with `ProtectedRoute` guards
- `artifacts/service-assurance/src/lib/auth.tsx` — Auth context + `ProtectedRoute`
- `artifacts/service-assurance/src/main.tsx` — `setAuthTokenGetter` setup, `saveToken`/`clearToken` helpers

## Type System Notes

- `artifacts/service-assurance/src/types/index.ts` — local type augmentations for fields that exist in the API/DB but are absent from the generated OpenAPI spec:
  - `TicketAiFields` — `aiSummarizedAt`, `aiNormalizedAt`, `aiCustomerUpdateAt`, `aiConfidence` (per-action AI timestamps + confidence score)
  - `TicketWithAI = TicketWithRelations & TicketAiFields` — used in ticket detail page instead of plain `TicketWithRelations`
- Generated `TicketDetail` (from `@workspace/api-client-react`) is a _different_ type that adds `updates?: TicketUpdate[]` — not to be confused with `TicketWithAI`

## Ticket Detail Component Structure

`artifacts/service-assurance/src/pages/tickets/detail.tsx` is the orchestration layer only (~300 lines). Sub-components:
- `TicketHeader.tsx` — escalation banners + header card + status stepper + assignee/status controls
- `AIPanels.tsx` — AI Insights card (executive summary, normalized status, customer update draft)
- `UpdateTimeline.tsx` — description card + activity timeline + post-update form
- `ticket-utils.ts` — shared utilities: `timeAgo`, `formatDuration`, `STATUS_STEPS`, `STATUS_ORDER`, `UPDATE_TYPE_CONFIG`

## Database

PostgreSQL via `DATABASE_URL` environment variable. Schema pushed with `pnpm --filter @workspace/db run push`. Seed with `pnpm --filter @workspace/scripts run seed`.

### Drizzle Migrations

Schema baseline snapshot is at `lib/db/drizzle/0000_simple_rafael_vega.sql` (generated by `drizzle-kit generate`). All 13 tables are captured. Future schema changes should go through `drizzle-kit generate` + `drizzle-kit migrate` rather than raw SQL.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — Session signing secret
- `OPENAI_API_KEY` — Required for AI features (ticket summarization, status normalization, customer updates)

## Running

All three workflows run automatically:
1. `artifacts/api-server: API Server` — builds and starts the API
2. `artifacts/service-assurance: web` — Vite dev server for the frontend
3. `artifacts/mockup-sandbox: Component Preview Server` — Canvas mockup server (unused in production)
