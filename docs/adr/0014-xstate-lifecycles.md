# ADR-0014 — XState v5 for lifecycle state machines

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

D2D has several long-lived stateful objects: Lead (new → contacted → qualified → appointment_set → converted/lost), Conversion (intake → enrichment → payment → finalised), PayoutBatch (draft → ready_to_pay → instructed → acknowledged), Donation (active → cancelled). Ad-hoc status-string fields drift; transition logic scattered.

## Decision

Each domain that owns a stateful entity ships an XState v5 machine in `services/<domain>/state-machine.ts`. Transitions are validated by the machine; service methods invoke transitions instead of mutating `status` directly.

## Consequences

- Visual state-chart artefact aids documentation + onboarding.
- Invalid transitions become impossible at compile time + runtime.
- Slight learning curve for engineers new to XState.
- Snapshots can serialise into the row for audit replay.

## Alternatives considered

- **Plain switch statements** — what we had before; drifted.
- **Workflow engines (Temporal, Inngest)** — overkill for our scale; revisit if we add long-running async flows.
