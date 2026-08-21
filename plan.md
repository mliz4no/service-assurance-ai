# Service Assurance AI — Technical Implementation Plan

## 1. Product scope and goals

This plan covers the next major capabilities requested by the product direction:

1. Public outage map
2. Network and device status enrichment
3. Nagios-based monitoring and ticket creation
4. Controller integrations for FortiManager / Meraki / Palo Alto / SD1-style ecosystems
5. Public-facing reporting and internal dashboard views

The implementation should be delivered in phases so the team can start with a public map and monitoring surface first, then expand into richer integrations and alerting.

6. Field dispatch integration
7. ITSM, CRM, and MSP integrations
8. Advanced public-network intelligence
9. Additional controller ecosystems
10. Billing and production observability

### 1.1 Current implementation status (updated 2026-08-20)

Status legend: **Implemented** means the end-to-end path exists; **Partial** means useful functionality exists but one or more acceptance criteria remain; **Planned** means implementation has not started.

| Phase                                | Status      | Current state                                                                                                                                                                                                                                      |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — Foundation                 | Implemented | Environment template, structured logging, correlation IDs, security headers, restricted production CORS, login throttling, request limits, persistent database sessions, liveness/readiness endpoints, and centralized error handling are present. |
| Phase 1 — Public outage map          | Implemented | The public map is the landing page and includes filters, summary metrics, approved targets/devices, affected-region classification, and geographic outage-area overlays.                                                                           |
| Phase 2 — Monitoring targets         | Partial     | Target CRUD, HTTP/TCP checks, scheduler, persistence, and ticket creation are present. Meeting-required ICMP echo checks for registered non-controller equipment remain.                                                                           |
| Phase 3 — Nagios and ticketing       | Implemented | Nagios synchronization creates or updates deduplicated tickets. Ticket numbering is database-atomic and monitoring runs use a cross-instance advisory lock.                                                                                        |
| Phase 4 — Outage correlation         | Partial     | Sibling-target and generic external-signal correlation are implemented. Licensed PowerOutage.us REST API access, GeoJSON mapping, or an approved equivalent provider remains.                                                                      |
| Phase 5 — IP/provider enrichment     | Partial     | IPinfo-based ASN/provider/region enrichment and caching exist. Reverse DNS, RDAP/RIR ownership, BGP prefix intelligence, provider block inventory, and automated geolocation coordinates remain.                                                   |
| Phase 6 — Controller integrations    | Implemented | Meraki, Fortinet/FortiManager, Palo Alto, and generic SD-WAN have live device, link, and event polling paths with normalized partial-result handling.                                                                                              |
| Phase 7 — Dashboard, reports, alerts | Partial     | Operational dashboards, incident views, escalation evaluation, email/webhook delivery, and ticket workflows exist. Durable delivery queues, complete historical reporting, and alert operations remain.                                            |
| Phase 8 — Performance and delivery   | Partial     | Monorepo typecheck/builds, CI, API container, route splitting, bundle budgets, migration baselining, and generated OpenAPI clients are complete. Metrics and production deployment validation remain.                                              |
| Phase 9 — Field dispatch             | Planned     | Dispatch is currently only a ticket status. Core Elevated delivery, dispatch job descriptions, idempotency, acknowledgement, and audit history are missing.                                                                                        |
| Phase 10 — ITSM/CRM/MSP integrations | Partial     | Salesforce account/contact import exists. ServiceNow and ConnectWise MSP/PSA integrations are not implemented.                                                                                                                                     |
| Phase 11 — Controller expansion      | Planned     | UniFi and MikroTik discovery, polling, normalized inventory, links, and event ingestion are not implemented.                                                                                                                                       |
| Phase 12 — Network intelligence      | Planned     | Reverse DNS/RDAP/BGP enrichment, authorized public-service probes, and ISP address-block intelligence are not implemented.                                                                                                                         |
| Phase 13 — Billing and observability | Partial     | Invoice complaints and Avalara validation exist. Billing scope needs confirmation; production metrics, tracing, alerting, and operational dashboards remain.                                                                                       |

### 1.2 Verified production-foundation work

- Bearer sessions are stored in PostgreSQL using token digests and expiry timestamps instead of process memory.
- Ticket numbers are allocated atomically through a database counter.
- Monitoring scheduler execution is protected across API replicas with PostgreSQL advisory locks.
- Managed devices require an explicit public label and visibility approval before appearing on the public map.
- API security includes Helmet, production CORS allowlisting, login throttling, request-body limits, and structured 404/500 responses.
- `/api/healthz` is a process liveness check and `/api/readyz` verifies database readiness.
- `.env.example` documents the active API, monitoring, alert, enrichment, Salesforce, InvoxAI, and Avalara settings.
- The complete monorepo typecheck passes and all application production builds complete.
- The API test suite passes all 89 tests. Test mode bypasses the process-wide login limiter while development and production throttling remain enabled.
- Drizzle migrations are validated for clean installation and for adoption of an existing `db:push`-managed schema through `db:baseline`.

### 1.3 Remaining production priorities

1. Implement production observability: metrics, tracing, SLOs, dashboards, paging rules, and runbooks.
2. Add ICMP checks, reverse DNS, and licensed PowerOutage.us Enterprise REST API correlation.
3. Define and implement the approved billing surface: invoice history, recurring charges, usage/rating, payments, and external billing synchronization.
4. Add ServiceNow and ConnectWise integrations, then UniFi and MikroTik controllers.
5. Complete RDAP/RIR, BGP prefix, and ISP block intelligence.
6. Add backup/restore, load, soak, replica failover, and public deployment validation.
7. Implement Core Elevated dispatch after its external API contract is available.

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

**Status: Implemented.** Controller devices require explicit public visibility approval. Approved points are grouped into operational, degraded, localized-outage, widespread-outage, or unknown regions.

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
- Public regional classification API at /api/public/network-map/regions
- Affected-region summaries and scaled geographic outage areas
- Internal admin view to manage visibility and status source

### Acceptance criteria

- Anonymous users can open /network-map and view the map.
- The map can display live status from known targets.
- Limited filters work without login.
- Affected regions are ranked by impact and can filter the visible map points.

---

## Phase 2 — Monitoring target model and IP-based discovery

### Goal

Allow the platform to register monitored IPs/hosts and evaluate their state.

**Status: Partial.** HTTP and TCP checks are implemented. ICMP echo checks required by the August 20 meeting are not implemented.

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

**Status: Partial.** Classification results are added to ticket context. The external provider interface exists, but production PowerOutage.us or equivalent data access is not configured or contractually validated.

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

**Status: Partial.** IPinfo is the current provider and database caching is configurable. Reverse DNS, RDAP/RIR ownership, BGP prefixes, provider block inventory, and provider-sourced coordinates are outstanding.

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

**Status: Implemented.** Meraki, Fortinet/FortiManager, Palo Alto, and generic SD-WAN expose live polling paths.

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
- [x] Replace Fortinet demo snapshots with live device, link, and event synchronization

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
- The previous primary JavaScript bundle was approximately **998 KB minified / 272 KB gzip**.
- Route-level lazy loading and stable vendor chunks reduce the complete initial static JavaScript graph to **391.8 KiB**.
- The largest emitted JavaScript chunk is approximately **249.3 KiB**.
- Leaflet, forms, admin, controllers, monitoring, invoice complaints, and ticket workflows load only when their routes require them.

### Frontend route-splitting tasks

1. [x] Convert page-level imports in the application router to `React.lazy` dynamic imports.
2. [x] Add a stable route loading state.
3. [x] Keep authentication state and application providers in the initial chunk.
4. [x] Isolate Leaflet/map code, controller operations, administration, invoice complaints, and ticket detail workflows into route chunks.
5. [x] Configure intentional framework, UI, forms, and map vendor chunks.
6. [x] Add a manifest-based CI bundle-budget check.

### Performance acceptance criteria

- No emitted application JavaScript chunk exceeds **500 KB minified**.
- The initial application JavaScript is below **400 KB minified**.
- Leaflet is not downloaded until a map route is opened.
- Admin and controller modules are not downloaded for the public network-map route.
- Login, dashboard, ticket list, ticket detail, monitoring, and public map routes render correctly after direct navigation and browser refresh.
- Desktop and mobile smoke tests show no loading-state overlap or layout shift.
- CI fails when the agreed bundle budget is exceeded.

### OpenAPI and generated clients

- [x] Document public map, monitoring, controller, managed device, network link, device event, and Salesforce endpoints.
- [x] Add bearer security metadata, request parameters, operational enums, and typed response models.
- [x] Regenerate React Query and Zod clients through Orval.
- [x] Add CI code-generation drift detection.

### Delivery and operations tasks

- [x] Baseline and repair Drizzle migration history for production upgrades.
- [x] Validate clean database installation and adoption of the current `db:push`-managed schema.
- [x] Keep PostgreSQL-backed integration tests in CI and isolate login-rate-limit state per test.
- Publish versioned API container images and document migration-before-rollout ordering.
- Expand `/api/readyz` as new mandatory dependencies are introduced.
- Add request, database, scheduler, integration, and alert-delivery metrics.
- Add backup/restore, load, soak, and replica failover exercises before general availability.

---

## 14. August 20 meeting requirements — English translation and audit

### 14.1 Translated requirements

1. **Outage map**

- Provide a publicly deployable network status map at `/network-map` and use it as the landing page.
- Show approved assets, outage areas, classifications, providers, and affected regions without exposing private network details.
- Provide a login path from the public map into the privileged application.

2. **Controllers and monitoring**

- Support FortiManager/Fortinet, Cisco Meraki, Palo Alto/Panorama, and SD1-style API controllers.
- Research comparable controller vendors and data sources.
- Integrate Nagios.
- Send ICMP echo checks to registered IP addresses, especially equipment not managed through SD1/controller APIs.
- Create or update a deduplicated ticket when monitored equipment stops responding.
- Before ticket creation, check approved power-outage data and the health of sibling equipment at the same physical location.
- Distinguish isolated equipment failures, shared-site failures, and regional utility/provider outages.

3. **Power-outage intelligence**

- Integrate PowerOutage.us enterprise data or an approved competitor.
- Use external outage evidence in incident classification and ticket context.
- The supplied PowerOutage.us product page advertises a commercial Live Outage REST API with 10-minute refresh and utility GeoJSON. Production use requires enterprise access; scraping is not an accepted integration method.

4. **Tickets and field dispatch**

- Add a real **Create Dispatch** action rather than only a `dispatch_scheduled` status.
- Send the complete allowlisted operational ticket record to a Core Elevated endpoint.
- Generate a technician-facing job description from ticket, customer, service, site, monitoring, controller, SLA, and contact context.
- Record delivery acknowledgement, external dispatch ID, status, retries, and audit history.

5. **Plugins and business integrations**

- Retain Salesforce integration.
- Add ServiceNow integration.
- Add ConnectWise MSP/PSA integration to import and synchronize customer data.

6. **Public IP and provider intelligence**

- Resolve public-IP geographic location.
- Perform reverse DNS/PTR lookup (the meeting-requested “RN lookup”) to resolve an IP address to a hostname, similar to `nslookup`.
- Parse carrier hostnames for provider and location hints while retaining the original PTR response and a confidence/source field.
- Resolve ASN, BGP prefix, RIR/RDAP ownership, ISP/provider, and assigned address blocks.
- Build provider block intelligence for major ISPs.
- Run only authorized public-service availability checks; do not crawl arbitrary third-party systems.

7. **August 20 product surface**

- Use the Network Status Map as the public landing page.
- Provide login access to the privileged application.
- Define the requested billing capability beyond the existing invoice-complaint/Avalara workflow.
- Add production observability.

8. **Controller expansion**

- Add UniFi as a controller ecosystem.
- Evaluate and add MikroTik through RouterOS REST/API where supported.

### 14.2 Gap matrix

| Requirement                                            | Status               | Remaining gap                                                                                                              |
| ------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Public landing map, login link, affected regions       | Implemented          | Production domain/CDN and deployment verification remain.                                                                  |
| FortiManager, Meraki, Palo Alto, SD1-style controllers | Implemented baseline | Vendor certification and real-environment acceptance tests remain.                                                         |
| Nagios ingestion and ticket creation                   | Implemented          | Production Nagios configuration and operational acceptance remain.                                                         |
| ICMP ping for non-controller equipment                 | Missing              | Add ICMP check type, permissions/runtime support, scheduler integration, and tests.                                        |
| Same-location sibling validation                       | Implemented          | Improve address normalization and define stale-status tolerance.                                                           |
| PowerOutage.us or competitor                           | Partial              | Acquire enterprise API access or select an approved provider; map its regional identifiers/GeoJSON and validate licensing. |
| Core Elevated dispatch                                 | Missing              | Endpoint, authentication, payload, acknowledgement, and lifecycle contract are undefined.                                  |
| Dispatch job description                               | Missing              | Define required fields and add generation/review workflow.                                                                 |
| Salesforce                                             | Implemented          | Current direction is read-only Accounts/Contacts import; broader bidirectional scope is undecided.                         |
| ServiceNow                                             | Missing              | Define modules, direction, entities, authentication, and conflict ownership.                                               |
| ConnectWise MSP/PSA                                    | Missing              | Select product/API and define customer/site/contact/agreement sync ownership.                                              |
| Public-IP geolocation                                  | Partial              | Provider/region exists; reliable latitude/longitude ingestion and confidence/source policy remain.                         |
| Reverse DNS / “RN lookup”                              | Missing              | Add PTR lookup, cache, carrier hostname parsing, source/confidence metadata, and tests.                                    |
| ASN lookup                                             | Implemented baseline | Add independent source validation and freshness policy.                                                                    |
| BGP prefix/RIR/provider block intelligence             | Missing              | Add RDAP/RIR and BGP provider adapters, persistent prefix model, and refresh jobs.                                         |
| Authorized public-service checks                       | Missing              | Define allowed protocols, targets, ownership verification, cadence, and abuse controls.                                    |
| Public outage-map deployment                           | Partial              | Route is public-safe; production hosting, DNS, CDN/cache, rate limits, and synthetic uptime checks remain.                 |
| Billing                                                | Defined/partial      | Build invoice history, recurring charges, usage/rating, payments, and external billing synchronization.                    |
| Observability                                          | Missing/partial      | Structured logs exist; metrics, tracing, SLOs, dashboards, and paging rules remain.                                        |
| UniFi controller                                       | Missing              | Add official API adapter, site/device/uplink/event normalization, and tests.                                               |
| MikroTik controller                                    | Missing              | Add RouterOS adapter, capability matrix, secure credentials, polling, and tests.                                           |

---

## 15. Phase 9 — Core Elevated field dispatch

### Goal

Create a reliable, auditable field-dispatch workflow from an incident ticket.

### Scope

- Add a dedicated `POST /api/tickets/:id/dispatch` command restricted to authorized internal roles.
- Resolve the complete operational context:
  - ticket and timeline
  - customer and escalation contacts
  - site address, access instructions, and local contact
  - service/circuit and provider identifiers
  - impacted devices/links and latest checks
  - correlation classification and external outage evidence
  - SLA/severity and requested response window
- Generate a dispatch-specific job description that includes symptoms, work requested, location, safety/access notes, known evidence, and completion criteria.
- Require an operator review/edit step before external submission unless product explicitly approves automatic dispatch.
- Deliver an allowlisted payload to Core Elevated using timeout, retry, idempotency, and correlation-ID conventions.
- Persist dispatch request, payload version, external ID, acknowledgement, status, attempts, errors, and timestamps.
- Change the ticket to `dispatch_scheduled` only after Core Elevated acknowledges the dispatch.

### Acceptance criteria

- Repeated requests with the same idempotency key do not create duplicate dispatches.
- Secrets, password hashes, internal credentials, and unrelated private data never leave the application.
- A successful response links the external dispatch ID to the ticket and writes an internal timeline event.
- Failed delivery remains retryable and does not falsely mark the ticket as dispatched.
- Operators can see pending, accepted, scheduled, completed, cancelled, and failed dispatch states.

---

## 16. Phase 10 — ServiceNow and ConnectWise integrations

### Goal

Synchronize service-management and MSP customer context through vendor-isolated, idempotent connectors.

### ServiceNow scope

- Confirm whether the target is Incident Management, Customer Service Management, Field Service Management, CMDB, or a combination.
- Support OAuth/client credentials where available.
- Define ticket/incident direction: import, export, or bidirectional.
- Map customers/accounts, contacts, locations, configuration items, incidents, work notes, status, severity, and external identities.
- Persist sync cursors, logs, conflicts, and source-of-truth ownership.

### ConnectWise scope

- Confirm the target product: ConnectWise PSA/Manage, RMM/Automate, or another API.
- Import companies/customers, contacts, sites, agreements, configurations, and service tickets as approved.
- Use external identity, incremental synchronization, idempotency, pagination, and rate-limit handling.
- Define field ownership so local operational updates are not overwritten unexpectedly.

### Acceptance criteria

- Repeated syncs update existing records without duplicates.
- A failed page or entity is retryable without replaying successful writes.
- Credentials are masked and encrypted using the repository integration pattern.
- Sync status, counts, errors, and last-success timestamps are visible to administrators.

---

## 17. Phase 11 — UniFi and MikroTik controller expansion

### Goal

Extend the normalized controller framework to UniFi and MikroTik without introducing vendor logic into ticketing or map services.

### UniFi scope

- Evaluate the official UniFi Site Manager/Network APIs and supported self-hosted controller APIs.
- Normalize sites, gateways, switches, access points, clients where public-safe, WAN uplinks, health, alarms, and events.
- Define cloud and on-premises authentication/certificate requirements.

### MikroTik scope

- Build a capability matrix for RouterOS REST API versus the RouterOS API protocol by supported version.
- Normalize routers, interfaces, routes, BGP peers where approved, link health, logs, and events.
- Require least-privilege service accounts, TLS, and explicit handling for self-signed certificates.

### Competitive controller assessment

- Compare API coverage, authentication, rate limits, webhooks, polling requirements, licensing, device inventory, WAN health, and event fidelity across supported and candidate vendors.
- Rank future candidates using customer demand and implementation risk rather than adding unbounded vendor-specific code.

### Acceptance criteria

- Both connectors satisfy `BaseConnector` and produce normalized devices, links, and events.
- Live-response fixture tests cover pagination, authentication failure, rate limits, malformed payloads, and partial sync.
- Controller data can feed internal dashboards and explicitly approved public-map records.

---

## 18. Phase 12 — Advanced network intelligence and authorized probes

### Goal

Improve provider attribution and outage diagnosis for registered, authorized public infrastructure.

### Scope

- Add ICMP echo as a monitoring check type using a proven cross-platform implementation and bounded execution.
- Add reverse DNS (`PTR`) lookup with timeout, cache, and confidence metadata.
- Implement the requested “RN lookup” as reverse DNS/PTR resolution, similar to `nslookup`.
- Parse provider/location hints from carrier-controlled PTR hostnames without treating naming conventions as authoritative geographic evidence.
- Add RDAP/RIR ownership and registration data.
- Add BGP prefix/origin-AS lookup through an approved provider such as Team Cymru or a commercial routing-data service.
- Persist normalized prefixes, ASN, organization, RIR, country, source, fetched time, and expiry.
- Build a refreshable inventory of address blocks associated with approved major providers/ISPs.
- Add authorized HTTP(S), TCP, DNS, and TLS-certificate checks for registered services.
- Require target ownership/authorization; do not implement unrestricted internet crawling or scanning.

### Acceptance criteria

- A public IP returns coordinates where licensed, PTR names, ASN, origin prefix, RIR owner, provider, and source timestamps when available.
- Cached data honors provider TTLs and degrades gracefully when external services fail.
- Probe concurrency, destination policy, timeouts, redirects, DNS rebinding, and private-address access are bounded to prevent SSRF or abusive scanning.
- Enrichment evidence is available to monitoring correlation but does not expose private fields publicly.

---

## 19. Phase 13 — Billing, observability, and public launch

### Goal

Define the remaining business surface and operate the application safely in production.

### Billing scope

- Add customer invoice history and line-item visibility.
- Add recurring service charges and contract/MRC tracking.
- Add usage ingestion, rating, pricing, and adjustment workflows.
- Add payment collection/status and reconciliation workflows.
- Add external billing-platform synchronization with explicit source-of-truth and conflict rules.
- Retain the implemented invoice-complaint and Avalara capabilities as part of the broader billing product.
- Define financial-data retention, access control, audit, reconciliation, and source-of-truth requirements.

### Observability scope

- Add request rate, latency, error, saturation, database-pool, scheduler, monitoring-check, connector-sync, ticket-creation, dispatch, and notification-delivery metrics.
- Add distributed traces across HTTP, database, external integrations, and background jobs.
- Define service-level indicators/objectives for public-map freshness, API availability, monitoring delay, ticket-creation delay, and dispatch delivery.
- Add dashboards and paging rules with runbook links.
- Redact secrets, credentials, tokens, customer-private fields, and sensitive ticket content from telemetry.

### Public launch scope

- Publish versioned container images and document migration-before-rollout and rollback procedures.
- Configure production DNS, TLS, CDN/cache policy, public API rate limits, and synthetic map checks.
- Validate responsive public-map behavior, accessibility, cache freshness, and failure states.
- Run backup/restore, load, soak, dependency outage, and multi-replica failover exercises.

### Acceptance criteria

- Invoice history, recurring charges, usage/rating, payments, and external billing synchronization have approved data models and ownership rules.
- Public-map and API SLOs are measured and alertable.
- A release can be deployed and rolled back through a documented, tested procedure.
- Backup restoration and dependency-failure drills produce recorded evidence.

---

## 20. Product decisions and remaining questions

### Decisions recorded August 20, 2026

- **Core Elevated:** Defer implementation until the external endpoint contract is available; keep the gap documented.
- **RN lookup:** Implement as reverse DNS/PTR resolution similar to `nslookup`. Carrier hostnames may provide provider and location hints.
- **Power outage provider:** Target the licensed PowerOutage.us Enterprise Live Outage REST API.
- **Billing:** Include invoice history, recurring charges, usage/rating, payments, and external billing synchronization.
- **Next implementation priority:** Observability.

### Remaining questions

1. **Core Elevated:** When available, provide the base URL, authentication method, API documentation, required payload, response schema, idempotency behavior, and dispatch status lifecycle.
2. **Dispatch job description:** Which fields are mandatory? Should AI draft it for operator approval or submit automatically? Are parts, estimated duration, required skills, safety, and access instructions required?
3. **Public-service checks:** Which domains/IPs and protocols are authorized, who proves ownership, and what cadence/concurrency is acceptable?
4. **PowerOutage.us:** Which countries/regions are required, and who owns procurement of Enterprise API access?
5. **ServiceNow:** Which modules and sync direction are required, and which system owns incident status and work notes?
6. **ConnectWise:** Which product is in scope, which entities should be imported, and is synchronization one-way or bidirectional?
7. **External billing:** Which billing platform is the initial integration target, and which system owns invoices, ratings, payments, and adjustments?
8. **UniFi:** Cloud Site Manager, self-hosted UniFi Network, or both? Which controller versions must be supported?
9. **MikroTik:** Minimum RouterOS version, REST versus API protocol preference, and required data such as interfaces, routes, BGP peers, logs, or configuration backups?
10. **Public launch:** What production domain, cloud/runtime, geographic coverage, data-retention policy, and target launch date should the plan use?
