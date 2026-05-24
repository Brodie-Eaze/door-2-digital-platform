# ADR-0001 — Monorepo: Turbo + pnpm workspaces

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

D2D has ~10 deployable apps + 4 shared packages + an iOS app. We need a build system that shares code across apps, caches builds, and runs `affected` tasks on PRs.

## Decision

**Turbo 2.x + pnpm 9.12 workspaces.** Workspaces declared in `pnpm-workspace.yaml`: `apps/*`, `packages/*`. Per-package `package.json` declares `dev`, `build`, `typecheck`, `lint`, `test`. Turbo orchestrates via `turbo.json` with `^build` dependencies and remote caching (Turbo Cloud).

Mirrors EazePay Intelligence's setup 1:1. Reduces cognitive load for engineers moving between repos.

## Consequences

- Fast incremental builds — only changed packages rebuild.
- One install (`pnpm install`) hydrates everything.
- Per-app Dockerfiles can `COPY` only the affected packages.
- Workspace `workspace:*` references keep package versions in sync.

## Alternatives considered

- **Nx** — more features but heavier; EazePay App uses it but Intelligence moved to Turbo for simplicity. We follow Intelligence.
- **Bun workspaces** — newer, less battle-tested for enterprise CI.
- **Polyrepo** — no code sharing without npm publishing; rejected.
