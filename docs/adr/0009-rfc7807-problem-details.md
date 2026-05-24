# ADR-0009 — RFC 7807 Problem Details for all error responses

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Three distinct API consumers (web apps, iOS app, partner integrations) all need a consistent error shape that distinguishes problem categories and carries enough context to act on without leaking internals.

## Decision

All non-2xx responses return `Content-Type: application/problem+json` with this shape:

```json
{
  "type": "https://docs.d2d.io/problems/region-mismatch",
  "title": "Region mismatch",
  "status": 403,
  "detail": "Resource lives in a different region",
  "instance": "/v1/orgs/org_01HX.../knocks",
  "traceId": "req_01HX...",
  "expectedRegion": "US",
  "actualRegion": "AU"
}
```

- Helper: `Problems.x()` factories in `@d2d/shared-utils/problem`.
- Throwable wrapper: `ProblemError(p)` in service code; the Fastify error handler converts to the response.
- ZodError → 400 validation problem.
- Unknown error → 500 internal problem with `traceId` only (no stack to client).

## Consequences

- Client libraries (web, iOS) can parse a single shape.
- Each problem type gets a documentation page at `https://docs.d2d.io/problems/<slug>`.
- Error catalogue lives in `@d2d/shared-utils/problem.ts` — single source of truth.

## Alternatives considered

- **Bespoke `{ error: { code, message } }`** — works but reinvents RFC 7807 badly.
- **GraphQL errors** — not applicable; we're REST.
