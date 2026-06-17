# Service Assurance AI

Monorepo for Service Assurance AI: contains the API server, front-end apps, libraries, and scripts used across the project.

Top-level folders:

- `artifacts/` — built artifacts and the `api-server` app
- `lib/` — shared client and API libraries
- `service-assurance/`, `mockup-sandbox/`, `engineering-deck/` — frontend apps and demos
- `scripts/` — utility scripts and seeders

Resolved issues

1. Implemented Fortinet connection test

   - File: [artifacts/api-server/src/connectors/fortinet.ts](artifacts/api-server/src/connectors/fortinet.ts)
   - Note: `FortinetConnector.testConnection()` now performs a live FortiManager login or FortiGate system status request instead of returning a placeholder success message.

2. Removed Replit previewPath from artifact config

   - File: [artifacts/api-server/.replit-artifact/artifact.toml](artifacts/api-server/.replit-artifact/artifact.toml)
   - Note: `previewPath` has been removed so the Replit artifact is not forced to preview `/api`.

Validation

- No remaining `TODO` or `FIXME` markers were found in the inspected files related to these issues.

How to help

- Run a repo-wide grep for `TODO`/`FIXME` to find more items:

  ```bash
  grep -RIn "\bTODO\b\|\bFIXME\b" .
  ```

- After fixing an item, remove or update the comment and add a short changelog entry.
