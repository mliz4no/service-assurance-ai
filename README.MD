# Service Assurance AI

Monorepo for Service Assurance AI: contains the API server, front-end apps, libraries, and scripts used across the project.

Top-level folders:

- `artifacts/` — built artifacts and the `api-server` app
- `lib/` — shared client and API libraries
- `service-assurance/`, `mockup-sandbox/`, `engineering-deck/` — frontend apps and demos
- `scripts/` — utility scripts and seeders

Pending issues (collected from codebase):

1. Implement Fortinet connection test

   - File: [artifacts/api-server/src/connectors/fortinet.ts](artifacts/api-server/src/connectors/fortinet.ts#L72)
   - Note: currently contains a `TODO` placeholder and needs a real FortiManager/FortiGate connection test to validate credentials and connectivity.

2. Exclude previewPath from Replit preview (artifact config)

   - File: [artifacts/api-server/.replit-artifact/artifact.toml](artifacts/api-server/.replit-artifact/artifact.toml#L2)
   - Note: comment indicates `previewPath = "/api"` should be excluded from preview; confirm intended behavior and update artifact configuration.

How to help

- Run a repo-wide grep for `TODO`/`FIXME` to find more items:

  ```bash
  grep -RIn "\bTODO\b\|\bFIXME\b" .
  ```

- After fixing an item, remove or update the `TODO` comment and add a short changelog entry.

If you want, I can open PRs for fixes or expand each pending issue into individual tracked tickets.
