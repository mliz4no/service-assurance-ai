# Service Assurance AI — Technical Implementation Plan

## 1. Product scope and goals

This plan covers the next major capabilities requested by the product direction:

1. Public outage map
2. Network and device status enrichment
3. Nagios-based monitoring and ticket creation
4. Controller integrations for FortiManager / Meraki / Palo Alto / SD1-style ecosystems
5. Public-facing reporting and internal dashboard views

The implementation should be delivered in phases so the team can start with a public map and monitoring surface first, then expand into richer integrations and alerting.

### 1.1 Current implementation status (updated 2026-08-15)

Status legend: **Implemented** means the end-to-end path exists; **Partial** means useful functionality exists but one or more acceptance criteria remain; **Planned** means implementation has not started.

| Phase                                | Status      | Current state                                                                                                                                                                                                                                      |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — Foundation                 | Implemented | Environment template, structured logging, correlation IDs, security headers, restricted production CORS, login throttling, request limits, persistent database sessions, liveness/readiness endpoints, and centralized error handling are present. |
| Phase 1 — Public outage map          | Implemented | Anonymous `/network-map`, public map and summary APIs, filters, summary metrics, monitored targets, and explicitly approved controller devices are supported.                                                                                      |
| Phase 2 — Monitoring targets         | Implemented | Target CRUD, internal monitoring UI, customer/site/service assignment, coordinates, HTTP/TCP checks, scheduler, persistence, and manual execution are present. ICMP remains optional future work.                                                  |
| Phase 3 — Nagios and ticketing       | Implemented | Nagios synchronization creates or updates deduplicated tickets. Ticket numbering is database-atomic and monitoring runs use a cross-instance advisory lock.                                                                                        |
| Phase 4 — Outage correlation         | Implemented | Sibling target health and external outage signals classify isolated, shared, and regional outages and write context into ticket updates.                                                                                                           |
| Phase 5 — IP/provider enrichment     | Implemented | Heuristic and IPinfo enrichment are available with an optional persistent `provider_lookups` cache and configurable TTL.                                                                                                                           |
| Phase 6 — Controller integrations    | Partial     | Meraki, Palo Alto, and generic SD-WAN have live polling paths. Fortinet connection testing is live, but device/link/event synchronization still returns demo data.                                                                                 |
| Phase 7 — Dashboard, reports, alerts | Partial     | Operational dashboards, incident views, escalation evaluation, email/webhook delivery, and ticket workflows exist. Durable delivery queues, complete historical reporting, and alert operations remain.                                            |
| Phase 8 — Performance and delivery   | Partial     | Monorepo typecheck and builds pass, CI and an API container exist. Frontend route splitting, migration-history baselining, complete OpenAPI coverage, metrics, and production deployment documentation remain.                                     |

### 1.2 Verified production-foundation work

- Bearer sessions are stored in PostgreSQL using token digests and expiry timestamps instead of process memory.
- Ticket numbers are allocated atomically through a database counter.
- Monitoring scheduler execution is protected across API replicas with PostgreSQL advisory locks.
- Managed devices require an explicit public label and visibility approval before appearing on the public map.
- API security includes Helmet, production CORS allowlisting, login throttling, request-body limits, and structured 404/500 responses.
- `/api/healthz` is a process liveness check and `/api/readyz` verifies database readiness.
- `.env.example` documents the active API, monitoring, alert, enrichment, Salesforce, InvoxAI, and Avalara settings.
- The complete monorepo typecheck passes and all application production builds complete.
- The API test suite currently passes 84 of 86 tests. The two remaining failures are test-isolation failures caused by the login rate limiter returning `429` after repeated integration-test logins.

### 1.3 Remaining production priorities

1. Add test-aware rate-limiter isolation without weakening production throttling.
2. Baseline the historical Drizzle migration journal and validate both clean installs and upgrades from the current schema.
3. Complete Fortinet live inventory, link, and event synchronization.
4. Route-split the frontend and enforce bundle budgets in CI.
5. Bring the OpenAPI contract and generated clients up to date with monitoring, map, controller, event, and Salesforce APIs.
6. Add metrics, tracing, durable alert delivery, backup/restore exercises, and load testing.

---

## 2. Current project fit

The current repository already has most of the right building blocks:

- API layer: [artifacts/api-server/src](artifacts/api-server/src)
- Frontend app: [artifacts/service-assurance/src](artifacts/service-assurance/src)
- Database schema: [lib/db/src/schema](lib/db/src/schema)
- Controller connector framework: [artifacts/api-server/src/connectors](artifacts/api-server/src/connectors)
- Incident correlation engine: [artifacts/api-server/src/lib/incident-correlator.ts](artifacts/api-server/src/lib/incident-correlator.ts)
- Existing map UI dependencies: Leaflet + React Leaflet already present in [artifacts/service-assurance/package.json](artifacts/service-assurance/package.json)

This means we should extend the existing architecture rather than introduce a separate subsystem.

---

## 3. Proposed architecture

### 3.1 Backend services

Add new backend modules under the API server:

- [artifacts/api-server/src/routes](artifacts/api-server/src/routes)
  - public outage endpoints
  - monitoring target endpoints
  - controller integration endpoints
  - provider/IP lookup endpoints

- [artifacts/api-server/src/lib](artifacts/api-server/src/lib)
  - outage-map service
  - monitoring service
  - ip-enrichment service
  - provider-lookup service
  - nagios-sync service
  - controller-polling service

### 3.2 Frontend pages

Extend the frontend app in [artifacts/service-assurance/src](artifacts/service-assurance/src):

- public route: /network-map
- internal route: /network-map-admin or /monitoring
- dashboard widgets for outage status and recent incidents

### 3.3 Database model

Use existing tables where possible and add new tables for monitoring and public status data.

Recommended additions:

- monitored_targets
  - id
  - name
  - host/ip
  - type (ip, hostname, service, controller)
  - provider
  - location/region
  - status
  - last_checked_at
  - last_success_at
  - last_failure_at
  - created_at

- monitoring_checks
  - id
  - target_id
  - source (nagios, ping, http, meraki, fortinet, paloalto)
  - status
  - response_time_ms
  - payload json
  - checked_at

- provider_lookups
  - id
  - ip_address
  - country
  - region
  - city
  - asn
  - isp
  - provider_name
  - bgp_prefix
  - source
  - cached_at

- outage_events
  - id
  - target_id
  - severity
  - state (up/down/degraded/unknown)
  - reason
  - coordinates
  - external_reference
  - created_at

- public_outage_snapshots
  - id
  - summary
  - region
  - provider
  - status
  - started_at
  - ended_at
  - created_at

These tables can be added incrementally and do not need to block the first phase.

---

## 4. Phase-by-phase implementation plan

## Phase 0 — Foundation and scaffolding

### Goal

Prepare the app for monitoring and public status features without changing the current user experience.

**Status: Implemented.** Remaining operational follow-up is tracked in Phase 8.

### Tasks

- Add environment configuration for:
  - NAGIOS_BASE_URL
  - NAGIOS_USERNAME
  - NAGIOS_PASSWORD
  - NAGIOS_API_TOKEN
  - POWER_OUTAGE_API_BASE_URL (optional)
  - IP_GEO_PROVIDER_API_KEY (optional)
  - IP_GEO_PROVIDER_BASE_URL (optional)
- Add logging and structured error handling for external integrations.
- Add a small internal admin page route to register monitoring targets.
- Add a public-facing API endpoint skeleton for map data.

### Deliverables

- Configurable integration layer
- Standardized error handling
- Initial public API contract for outage map data

### Acceptance criteria

- The API can start with new monitoring config loaded from environment variables.
- The app can expose a stub public network map payload.

---

## Phase 1 — Public outage map MVP

### Goal

Ship a public-facing outage map without login, using a basic status source.

**Status: Implemented.** Controller devices are included only after explicit public visibility approval.

### Scope

- Add route /network-map
- Make it accessible without authentication
- Show a map with device/site markers and outage state
- Support limited filtering for:
  - region
  - provider
  - status
  - device type

### Frontend implementation

- Create a new public page under [artifacts/service-assurance/src/pages](artifacts/service-assurance/src/pages)
- Reuse Leaflet + React Leaflet already in the package
- Add a simple marker/cluster layer with color-coded status
- Provide a lightweight summary bar for:
  - total monitored assets
  - active outages
  - degraded services
  - last updated

### Backend implementation

- Create a public endpoint such as:
  - GET /api/public/network-map
  - GET /api/public/network-map/summary
- Return a normalized payload for frontend consumption:
  - id
  - name
  - status
  - latitude
  - longitude
  - provider
  - region
  - lastSeenAt
  - source

### Deliverables

- Public page accessible at /network-map
- Public API returning aggregate map data
- Internal admin view to manage visibility and status source

### Acceptance criteria

- Anonymous users can open /network-map and view the map.
- The map can display live status from known targets.
- Limited filters work without login.

---

## Phase 2 — Monitoring target model and IP-based discovery

### Goal

Allow the platform to register monitored IPs/hosts and evaluate their state.

**Status: Implemented for HTTP and TCP checks.** ICMP is not currently implemented.

### Scope

- Add monitored targets management
- Support public IPs and hostnames
- Track reachability, last checks, and last outage time

### Backend implementation

- Add routes:
  - POST /api/monitoring/targets
  - GET /api/monitoring/targets
  - GET /api/monitoring/targets/:id
  - PUT /api/monitoring/targets/:id
  - DELETE /api/monitoring/targets/:id
- Store initial metadata and status in the database.
- Create a monitoring worker or scheduled service for target checks.

### Recommended check types

- ICMP ping
- TCP connect
- HTTP GET
- Nagios status fetch

### Deliverables

- A target registry for all monitored assets
- Basic polling lifecycle and persistence of results

### Acceptance criteria

- The system can register a target by IP or hostname.
- A check result updates the target status and timestamps.

---

## Phase 3 — Nagios integration and ticket creation

### Goal

Integrate with Nagios so that failing devices can surface as incidents automatically.

**Status: Implemented.** Monitoring-target identity provides ticket deduplication, and ticket numbering is allocated atomically.

### Scope

- Poll Nagios host/service status
- Map failing results to internal target state
- Create tickets when a target is down and the criteria match
- Avoid duplicate tickets for the same ongoing incident

### Backend implementation

- Add a Nagios service under [artifacts/api-server/src/lib](artifacts/api-server/src/lib)
- Implement calls to Nagios endpoints such as:
  - host status list
  - service status list
  - detailed host/service info
- Normalize Nagios outputs into a common incident structure.
- Reuse the existing incident correlation flow from [artifacts/api-server/src/lib/incident-correlator.ts](artifacts/api-server/src/lib/incident-correlator.ts)

### Ticket creation rule

A ticket should be created when:

- the target is reported down or unreachable
- the target is tied to a customer/site/service context
- there is no currently open ticket for the same issue

### Suggested logic

1. Poll Nagios status.
2. Detect failed target.
3. Check whether the same device or address already has an open incident.
4. Create a new ticket if none exists.
5. Update the ticket if an incident is already active.

### Deliverables

- Nagios connector
- Ticket creation from monitoring failures
- Incident deduplication

### Acceptance criteria

- A monitored device marked down in Nagios creates a ticket.
- Repeated checks do not generate duplicate tickets for the same incident.

---

## Phase 4 — Outage correlation and same-location validation

### Goal

Improve incident quality by correlating local failures with sibling devices and external outage signals.

**Status: Implemented for monitored targets.** Classification results are added to ticket context.

### Scope

- Group devices by address/location
- Check if other devices at the same location are still healthy
- Evaluate whether the incident is an isolated device issue or a shared outage
- Compare against external outage data such as PowerOutage.us

### Backend implementation

- Add a correlation service that:
  - groups targets by address or geographic location
  - checks sibling target status
  - marks the incident as:
    - isolated device issue
    - shared infrastructure issue
    - regional/public outage
- Add a lightweight external outage provider adapter.

### Decision logic

When a target fails:

1. Check its siblings at the same address/location.
2. If siblings are healthy, treat it as a likely isolated event.
3. If siblings are also failing, treat it as a shared outage.
4. If the region/provider is showing a broader incident externally, add that as a correlation signal.

### Deliverables

- Outage correlation logic
- Candidate incident classification
- External signal enrichment for tickets

### Acceptance criteria

- The system can label a failure as isolated vs shared outage.
- The ticket payload can include correlation context.

---

## Phase 5 — IP and provider enrichment

### Goal

Enrich monitored targets and outages with provider/ASN/geographic metadata.

**Status: Implemented.** IPinfo is the current live provider and database caching is configurable.

### Scope

- Resolve public IPs to geo location
- Resolve ASN and ISP/provider name
- Resolve provider ownership and BGP-related data when possible
- Display the enrichment data in the public map and internal incident view

### Backend implementation

- Create an IP enrichment service that uses one or more providers such as:
  - MaxMind
  - ipinfo
  - IP2Location
  - Team Cymru / BGP tools / RIR data sources
- Cache results in the database for reuse.
- Expose a lookup endpoint such as:
  - GET /api/network/lookup?ip=...

### Data enrichment fields

- country
- region
- city
- latitude / longitude
- asn
- isp
- provider_name
- bgp_prefix
- source

### Deliverables

- Lookup service
- Cached enrichment results
- Map display with enriched provider/region details

### Acceptance criteria

- Entering a public IP returns provider and geo metadata.
- The public map can display provider and region context.

---

## Phase 6 — Controller integrations: Meraki, FortiManager, Palo Alto, SD1-style systems

### Goal

Bring in controller-level status and outage signals from major vendors and platforms.

**Status: Partial.** Meraki, Palo Alto, and generic SD-WAN expose live polling paths. Fortinet live synchronization remains incomplete.

### Scope

- Extend the connector framework in [artifacts/api-server/src/connectors](artifacts/api-server/src/connectors)
- Add support for:
  - Meraki
  - FortiManager/Fortinet
  - Palo Alto / Panorama style systems
  - SD1-style controller APIs

### Current repo alignment

The repository has a connector abstraction in [artifacts/api-server/src/connectors/base.ts](artifacts/api-server/src/connectors/base.ts) and implementations for Meraki, Fortinet, Palo Alto, and SD-WAN controller APIs. External connector and alert-provider requests share bounded timeout, rate-limit, and transient-failure retry behavior. Alert retries use a stable idempotency key per delivery call.

### Implementation approach

- Use the existing connector interface.
- Add new connector modules under [artifacts/api-server/src/connectors](artifacts/api-server/src/connectors).
- Normalize all results into:
  - devices
  - links
  - events
  - status snapshots
- Store data in existing tables such as managed_devices and device_events, or introduce a vendor-specific metadata table if needed.

### Polling strategy

- Poll connectors in parallel where appropriate.
- Keep polling separate from ticket creation.
- Treat controller sync as a data ingestion step; ticketing and incidents are a later step.

### Deliverables

- [x] Connector modules for each platform
- [x] Polling and sync orchestration
- [x] Normalized status data used by the outage map and incident engine
- [x] Shared timeout, `Retry-After`, and bounded backoff handling
- [ ] Replace Fortinet demo snapshots with live device, link, and event synchronization

### Acceptance criteria

- The system can ingest controller device status from multiple vendors.
- Controller data is visible in the internal dashboard and available to the public map.

---

## Phase 7 — Dashboard, reports, alerts, and ticket integration

### Goal

Turn the ingestion and correlation data into useful reporting and operational workflows.

**Status: Partial.** Current dashboards and alert hooks are operational; historical reporting and durable delivery remain.

### Scope

- Add internal dashboards for summary and recent outages
- Add report views for outages by region/provider/device
- Add alerting hooks for high-severity incidents
- Optionally push incidents into existing ticketing flows

### Frontend implementation

- Add dashboard cards under [artifacts/service-assurance/src/pages](artifacts/service-assurance/src/pages)
- Reuse existing ticket UI patterns and status badges

### Backend implementation

- Add summary endpoints for:
  - active outages
  - recent incidents
  - provider breakdown
  - regional impact

### Deliverables

- Dashboard widgets
- Incident reports
- Alerting hooks

### Acceptance criteria

- Internal users can view outage summaries and recent incidents.
- High-severity incidents can be surfaced to alerts or ticketing workflows.

---

## 5. Routing and API design

### Public APIs

- GET /api/public/network-map
- GET /api/public/network-map/summary
- GET /api/public/network-map/regions

### Monitoring APIs

- POST /api/monitoring/targets
- GET /api/monitoring/targets
- GET /api/monitoring/targets/:id
- PUT /api/monitoring/targets/:id
- DELETE /api/monitoring/targets/:id
- POST /api/monitoring/checks/run
- GET /api/monitoring/checks

### Lookup APIs

- GET /api/network/lookup?ip=...
- GET /api/network/providers?asn=...

### Controller APIs

- POST /api/controllers
- GET /api/controllers
- POST /api/controllers/:id/sync
- POST /api/controllers/:id/test

---

## 6. Frontend plan

### New public page

- Route: /network-map
- Features:
  - map view
  - filters
  - summary cards
  - drill-down to device details

### New internal pages

- /monitoring
  - target list
  - health summary
  - recent check results
- /network-map-admin
  - visibility configuration
  - manual incident overrides

### Shared components

- MapCard
- OutageStatusBadge
- FilterBar
- DeviceDetailPanel
- IncidentTimeline

---

## 7. Data flow design

### A. Monitoring flow

1. Register monitoring target
2. Poll target via configured source
3. Store check result
4. Update target status
5. Create or update incident if needed
6. Push updated status to public map and dashboard

### B. Controller sync flow

1. Read controller config
2. Poll vendor API
3. Normalize to internal model
4. Store devices/events/statuses
5. Generate or update incident correlation
6. Feed values into the public outage map

### C. Public map flow

1. Read latest monitoring state + controller state
2. Enrich device metadata with IP/provider lookup
3. Aggregate by region/provider/device
4. Return public-safe payload to the UI

---

## 8. Security and public-safety considerations

The public outage map should be public, but the system must avoid exposing sensitive internal data.

### Rules

- Public endpoints should only expose:
  - public-safe status
  - region/provider summary
  - hostname or asset label if approved
  - no internal credentials or detailed private network data
- Internal-only endpoints remain behind authentication and role checks.
- Admin-only actions remain restricted to authenticated users.

---

## 9. Implementation order

Recommended order for delivery:

1. Public outage map foundation
2. Monitoring target model and polling
3. Nagios integration and ticket creation
4. IP/provider enrichment
5. Same-location correlation and external outage signals
6. Controller integrations (Meraki/FortiManager/Palo Alto/SD1-style)
7. Dashboards, alerts, and reporting

This order gives a visible public result early while keeping the architecture extensible.

---

## 10. Risks and mitigations

### Risk: external APIs are unstable or rate-limited

Mitigation:

- add caching
- add retry logic
- add graceful degradation

### Risk: duplicate ticket creation

Mitigation:

- use deduplication logic before ticket creation
- attach events to existing incidents when possible

### Risk: public map reveals too much detail

Mitigation:

- define a public-safe schema and filter sensitive fields

### Risk: controller integrations vary widely by vendor

Mitigation:

- normalize early to a common shape
- keep vendor-specific code isolated in connectors

---

## 11. Testing and quality workstream

### Goal

Increase backend test coverage steadily and establish a quality gate for future changes.

### Target

- Reach 80%+ coverage for the API server core modules and the most critical business logic.
- Keep new feature work covered by unit tests wherever possible.
- Use database-backed integration tests only where the behavior truly depends on the database.

The API server enforces 80% statement and line coverage over production source, excluding tests and process bootstrap code.

### Initial approach

- Add unit tests for isolated logic modules first:
  - password/auth helpers
  - severity calculation
  - AI helper functions
  - HTTP response helpers
  - auth middleware
  - incident correlation logic
- Add route-level tests next for the most important API endpoints.
- Add connector-level tests with mocked vendor responses for Meraki/Fortinet/Palo Alto-style integrations.
- Add coverage reporting to the test workflow so regressions are visible.

### Proposed test targets

- [artifacts/api-server/src/lib/ai.ts](artifacts/api-server/src/lib/ai.ts)
- [artifacts/api-server/src/lib/incident-correlator.ts](artifacts/api-server/src/lib/incident-correlator.ts)
- [artifacts/api-server/src/middlewares/auth.ts](artifacts/api-server/src/middlewares/auth.ts)
- [artifacts/api-server/src/lib/http.ts](artifacts/api-server/src/lib/http.ts)
- [artifacts/api-server/src/routes/tickets.ts](artifacts/api-server/src/routes/tickets.ts)
- [artifacts/api-server/src/routes/controllers.ts](artifacts/api-server/src/routes/controllers.ts)

### Immediate implementation steps

1. Keep adding focused unit tests around core backend modules.
2. Add route-level tests for the outage-map and monitoring endpoints once implemented.
3. Introduce a CI-friendly coverage command and track changes over time.
4. Revisit integration tests once a local or shared PostgreSQL environment is available.

---

## 12. Suggested first implementation slice

If we want a practical first slice, implement this first:

- public /network-map route
- backend map data API
- monitoring target CRUD
- one Nagios connector flow
- ticket creation from failed monitored targets
- basic IP lookup enrichment
- a minimal coverage test suite around the new path

That first slice gives immediate value and creates the foundation for the larger controller integrations.

**Current state:** This first slice is implemented. Follow-on work should use the remaining priorities in Section 1.3 rather than repeat this slice.

---

## 13. Phase 8 — Frontend performance and production delivery

### Goal

Reduce startup cost, enforce release quality, and make deployments repeatable and observable.

### Current baseline

- The main frontend production build succeeds.
- The primary JavaScript bundle is approximately **998 KB minified / 272 KB gzip**.
- Vite reports a chunk-size warning because the main chunk exceeds 500 KB.
- The router currently imports enough application surface eagerly that feature pages are bundled into the initial application chunk.

### Frontend route-splitting tasks

1. Convert page-level imports in the application router to `React.lazy` dynamic imports.
2. Add a stable route loading state with no layout shift.
3. Keep authentication and the application shell in the initial chunk.
4. Isolate Leaflet/map code, controller operations, administration, invoice complaints, and ticket detail workflows into route chunks.
5. Configure intentional Vite chunk grouping only where automatic route splitting still produces oversized shared chunks.
6. Add a CI bundle-budget check using generated build metadata or a bundle-size reporting tool.

### Performance acceptance criteria

- No emitted application JavaScript chunk exceeds **500 KB minified**.
- The initial application JavaScript is below **400 KB minified**.
- Leaflet is not downloaded until a map route is opened.
- Admin and controller modules are not downloaded for the public network-map route.
- Login, dashboard, ticket list, ticket detail, monitoring, and public map routes render correctly after direct navigation and browser refresh.
- Desktop and mobile smoke tests show no loading-state overlap or layout shift.
- CI fails when the agreed bundle budget is exceeded.

### Delivery and operations tasks

- Baseline and repair Drizzle migration history before using `db:migrate` for production upgrades.
- Validate clean database installation and upgrade from the current deployed schema.
- Keep PostgreSQL-backed integration tests in CI and isolate login-rate-limit state per test.
- Publish versioned API container images and document migration-before-rollout ordering.
- Expand `/api/readyz` as new mandatory dependencies are introduced.
- Add request, database, scheduler, integration, and alert-delivery metrics.
- Add backup/restore, load, soak, and replica failover exercises before general availability.
