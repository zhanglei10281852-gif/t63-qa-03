# Sanitation Operations

Sanitation Operations is a Go backend for municipal vehicle dispatch and route operations. It models route planning, shift assignment, dispatch, inspection, incidents, fuel records, maintenance, audit events, outbox processing, and daily reconciliation.

The repository is a Go-first production baseline with a Vue 3 + TypeScript + Vite operator console. The frontend uses Ant Design Vue for operational controls and consumes the Go HTTP API.

## Structure

- `cmd/server`: HTTP server, dependency wiring, worker lifecycle, and graceful shutdown.
- `internal/domain`: domain models and state transitions.
- `internal/service`: dispatch, planning, crew, fleet, inspection, fuel, maintenance, batch, query, and reconciliation workflows.
- `internal/repository`: storage contracts and transaction boundary.
- `internal/storage/sqlite`: SQLite implementation, migrations, optimistic version checks, and isolated reads.
- `internal/httpapi` and `internal/middleware`: JSON API, request IDs, timeout, CORS, rate limiting, logging, and panic recovery.
- `internal/worker`: outbox claiming, retry/backoff, permanent failure, and cancellation.
- `frontend`: Vue 3/TypeScript operator console backed by Ant Design Vue.
- `migrations`: readable schema baseline; the server embeds the same schema for startup migration.

## Data model

The SQLite schema contains `vehicles`, `drivers`, `driver_certifications`, `routes`, `shifts`, `trips`, `inspections`, `inspection_items`, `maintenance_orders`, `incidents`, `fuel_logs`, `audit_events`, `idempotency_keys`, and `outbox_jobs`, plus `schema_migrations`. Foreign keys, uniqueness constraints, indexes, timestamps, and optimistic `version` columns are enforced by the database.

## Run locally

Requires Go 1.22 or newer and Node.js 20+ for the console.

```text
go run ./cmd/server
cd frontend
npm ci
npm run dev
```

The API listens on `http://localhost:8653`; the console listens on `http://localhost:5173`. Configuration is injected with the variables in `.env.example`.

## Docker

```text
docker compose up --build -d
docker compose logs -f backend
```

The backend stores SQLite data in the `sanitation-data` volume. The frontend proxies `/api` to the backend service. Stop the stack with `docker compose down`.

## Main API

```text
GET  /health/live
GET  /health/ready
GET  /api/v1/vehicles?limit=20&status=available
GET  /api/v1/drivers
POST /api/v1/routes
POST /api/v1/shifts
POST /api/v1/shifts/assign
POST /api/v1/trips/start
POST /api/v1/trips/{id}/return
POST /api/v1/inspections
POST /api/v1/inspections/{id}/submit
GET  /api/v1/reconciliation?service_date=2026-08-18
```

Mutating requests accept `X-Operator-ID`; starting a trip requires an `Idempotency-Key` header or JSON field. Errors use `{code, message, request_id}` and standard HTTP status codes.

## Verification

```text
go test ./... -count=1
go test -race ./... -count=1
go vet ./...
go build ./...
go run E:/gomark/.agents/skills/go-base-project-create/scripts/measure_project.go -root . -enforce
cd frontend
npm ci
npm test -- --run
npm run typecheck
npm run build
```

The test suite covers domain state machines, service workflows, real SQLite persistence, transaction rollback, HTTP contracts, worker retries, context cancellation, concurrency, and reopen/recovery behavior.
