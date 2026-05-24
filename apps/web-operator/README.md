# apps/web-operator

Brodie's cross-tenant **Operator Console**. Mission-control view across every D2D client tenant (Pilot-Charlie + future signed customers).

## Run locally

```bash
pnpm install
pnpm --filter web-operator dev
# → http://localhost:3011
# → /overview is the home (login redirects there in Phase 0)
```

Requires:
- `NEXT_PUBLIC_API_URL=http://localhost:3010` (api running)
- `NEXT_PUBLIC_ENV=local`

## What's built (Phase 0)

- `OperatorShell` — sidebar + topbar layout via `@d2d/ui-web`
- `/overview` — cross-tenant mission-control home (anomalies + KPI rail + region status + build status)
- `/login` — login page scaffold (POST /v1/auth/login wiring Phase 1.1)

## What lands per phase

- **Phase 1.1:** Auth (login + SAML + WebAuthn step-up), org list + detail, audit drawer
- **Phase 1.2:** Territory + knocker overview across tenants
- **Phase 1.3:** Billing, MiCamp residuals dashboard, invoice viewer
- **Phase 1.4:** SOC 2 evidence pack viewer, compliance state matrix
- **Phase 2+:** Region switcher, AU + SG tenant views

Mirrors EazePay Intelligence visual DNA exactly. No glass. No aurora-green.
Strict navy + light-blue palette via `@d2d/ui-tokens`.
