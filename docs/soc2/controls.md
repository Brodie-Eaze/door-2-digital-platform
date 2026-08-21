# Door 2 Digital — SOC 2 Type I Control Matrix

> **Scope:** Door 2 Digital platform, US region (us-east-1), Pilot-Charlie tenant.
> **Target:** Type I report — controls suitably designed as of audit date (Phase 1.4).
> **Type II observation window:** 90 days minimum, starting Phase 3.
> **Framework:** AICPA Trust Services Criteria 2017 (TSC) — Security + Availability + Confidentiality + Processing Integrity + Privacy.

---

## CC1 — Control Environment

| Control ID | Description                                   | Implementation                                                                           | Evidence                      |
| ---------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| CC1.1      | COSO principle — integrity and ethical values | `SECURITY.md` + `CONTRIBUTING.md` code-of-conduct; employee handbook                     | Policy docs committed to repo |
| CC1.2      | Board oversight of controls                   | Brodie as sole director; quarterly risk review scheduled                                 | Board minutes / risk register |
| CC1.3      | Organizational structure, reporting lines     | `docs/architecture.md` §15 team shape; CODEOWNERS file                                   | CODEOWNERS, org chart         |
| CC1.4      | Commitment to competence                      | Code review gates; CI type-check + lint; onboarding via CONTRIBUTING                     | PR gate logs; CONTRIBUTING    |
| CC1.5      | Accountability                                | RBAC enforced (`apps/api/src/shared/middleware/auth-guard.ts`); every write audit-logged | AuditEvent rows; RBAC tests   |

---

## CC2 — Communication and Information

| Control ID | Description                          | Implementation                                                                              | Evidence                            |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| CC2.1      | Internal communication of objectives | `docs/architecture.md` ADRs 0001–0028; `HANDOFF.md`                                         | Committed docs                      |
| CC2.2      | External communication policies      | `SECURITY.md` responsible-disclosure; `security.txt` at `/.well-known/security.txt`         | SECURITY.md; live endpoint          |
| CC2.3      | Communication to external parties    | Partner webhook HMAC signing; API changelog at `/v1/healthz`; OpenAPI at `/v1/openapi.json` | Webhook delivery logs; OpenAPI spec |

---

## CC3 — Risk Assessment

| Control ID | Description                     | Implementation                                                                            | Evidence                      |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| CC3.1      | Specifying suitable objectives  | Phase plan §14; per-phase success criteria                                                | Master plan doc               |
| CC3.2      | Identifying and analysing risk  | `docs/architecture.md` §18 risk register (18 enumerated risks with severity + mitigation) | Risk register section         |
| CC3.3      | Assessing fraud risk            | `services/risk` GPS-spoof + dup-conversion detection; audit chain tamper detection        | Risk service; `verifyChain()` |
| CC3.4      | Identifying changes to controls | ADR process for every cross-cutting decision; PR approval required for compliance code    | ADR files; CODEOWNERS         |

---

## CC4 — Monitoring Activities

| Control ID | Description                                | Implementation                                                                           | Evidence                          |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------- |
| CC4.1      | Evaluating and communicating deficiencies  | Weekly `audit:verify` CI job (Gate 10); Pino structured logs → Datadog; PagerDuty alerts | CI Gate 10 run logs; alert config |
| CC4.2      | Evaluating and communicating to management | `MORNING-BRIEF.md` daily ops review pattern; Railway deploy status                       | Morning brief template            |

---

## CC5 — Control Activities

| Control ID | Description                                    | Implementation                                                                               | Evidence                                    |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| CC5.1      | Selecting and developing controls              | Defence-in-depth: auth-guard → tenant-guard → Postgres RLS; gitleaks + semgrep + Trivy in CI | CI Gate logs                                |
| CC5.2      | Selecting and developing technology controls   | HTTPS-only; helmet CSP; rate limiting per route; HMAC webhooks                               | `apps/api/src/index.ts` security middleware |
| CC5.3      | Deploying controls via policies and procedures | `CONTRIBUTING.md`; pre-commit hooks (lint-staged + gitleaks); branch protection on main      | `.husky/`; branch protection config         |

---

## CC6 — Logical and Physical Access Controls

| Control ID | Description                                | Implementation                                                                                                     | Evidence                              |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| CC6.1      | Logical access security software           | JWT RS256 ≤5min lifetime; refresh token rotation; revocation epoch (`apps/api/src/domains/auth/service.ts`)        | Auth service; JWT claims              |
| CC6.2      | New users provisioned with least privilege | Invite-only user creation; role assigned at invite time; 8-role RBAC                                               | `apps/api/src/domains/user/routes.ts` |
| CC6.3      | Role assignment reviewed                   | Quarterly access review scheduled; `GET /v1/users` returns role per user for review                                | User list endpoint                    |
| CC6.4      | Access removed promptly                    | `DELETE /v1/users/:id` → soft-archive + token revocation in same transaction                                       | User archive route + auth service     |
| CC6.5      | Physical access controls                   | Hosted on Railway/AWS — provider physical controls (Railway SOC 2; AWS SOC 2 Type II)                              | Railway / AWS SOC 2 reports           |
| CC6.6      | Logical access to infrastructure           | Railway service-level credentials; AWS IAM roles (no long-lived access keys)                                       | Railway dashboard; Terraform IAM      |
| CC6.7      | Transmission encryption                    | TLS 1.3 enforced at edge; `Strict-Transport-Security: max-age=63072000; includeSubDomains`                         | Response headers                      |
| CC6.8      | Encryption at rest                         | PII envelope-encrypted (KMS); `ConsentRecord.proofKey` S3-KMS; DB encrypted at rest (Railway managed / Aurora SSE) | `services/pii-vault`; S3 KMS config   |

---

## CC7 — System Operations

| Control ID | Description                                | Implementation                                                                               | Evidence                       |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------ |
| CC7.1      | Infrastructure detection capabilities      | Pino structured logs with `level`/`traceId`/`orgId`; OpenTelemetry traces; `GET /healthz`    | Log output; OTel config        |
| CC7.2      | Monitoring for anomalies                   | `emitAnalyticsEvent` on every knock/conversion/session; anomaly detection in `services/risk` | Analytics outbox; risk service |
| CC7.3      | Evaluating security events                 | Audit chain replay weekly (Gate 10); PagerDuty SEV1 for security incidents                   | CI Gate 10; runbooks           |
| CC7.4      | Incident response                          | `docs/runbooks/incident-response.md`; `docs/runbooks/data-breach-72h.md`                     | Runbook files                  |
| CC7.5      | Identifying and mitigating vulnerabilities | Trivy + Semgrep + gitleaks in every PR (CI Gates 4–5); Dependabot weekly                     | CI Gate logs; Dependabot PRs   |

---

## CC8 — Change Management

| Control ID | Description                                                  | Implementation                                                                       | Evidence                      |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------- |
| CC8.1      | Authorizing, designing, developing, and implementing changes | All changes via PR; required review by CODEOWNERS; no direct push to main            | Branch protection; PR history |
| CC8.1a     | Testing before deployment                                    | 10-gate CI pipeline required to pass before merge; E2E tests gate production deploys | CI Gate logs                  |
| CC8.1b     | Separation of duties                                         | Code author ≠ approver required on security-sensitive PRs (CODEOWNERS enforces)      | CODEOWNERS; PR review history |

---

## CC9 — Risk Mitigation

| Control ID | Description                                   | Implementation                                                                                          | Evidence               |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| CC9.1      | Identifying and mitigating risks from vendors | Third-party vendors assessed quarterly; `infra/terraform/` vendor lock-in mitigated via adapter pattern | Vendor assessment log  |
| CC9.2      | Business continuity planning                  | `docs/runbooks/region-failover.md`; RDS automated backups; DR game-day quarterly                        | Runbook; backup config |

---

## Availability (A1)

| Control ID | Description               | Implementation                                                        | Evidence                  |
| ---------- | ------------------------- | --------------------------------------------------------------------- | ------------------------- |
| A1.1       | Capacity planning         | Railway autoscaling; Aurora Serverless v2; BullMQ concurrency limits  | Railway config; DB config |
| A1.2       | Environmental protections | Managed hosting (Railway → AWS); multi-AZ Aurora in prod              | Architecture doc §2.4     |
| A1.3       | Recovery objectives       | RPO 5min (Aurora PITR); RTO 1h target; documented in `docs/runbooks/` | Runbooks; backup config   |

---

## Confidentiality (C1)

| Control ID | Description                           | Implementation                                                                          | Evidence                                 |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| C1.1       | Identifying confidential information  | `docs/compliance/data-classification.md`; PII columns tagged `/// PII` in Prisma schema | Data classification doc; schema comments |
| C1.2       | Disposing of confidential information | RTBF via `POST /v1/dsar/requests`; 7yr audit retention, then S3 Object Lock expiry      | DSAR routes; S3 lifecycle policy         |

---

## Processing Integrity (PI1)

| Control ID | Description                                | Implementation                                                                                               | Evidence                                        |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| PI1.1      | Complete and accurate processing           | Idempotency keys on all POST mutations; `withIdempotency` middleware stores + replays                        | Idempotency middleware; IdempotencyRecord table |
| PI1.2      | Outputs complete and accurate              | Commission accrual inside `$transaction` with audit row; payout instruction file generated from locked batch | Commission service; payout service              |
| PI1.3      | Processing errors identified and corrected | BullMQ DLQ for failed jobs; error responses RFC 7807; `createKnockBatch` returns per-item errors             | Worker DLQ config; error middleware             |

---

## Privacy (P1–P8)

| Control ID | Description                | Implementation                                                                         | Evidence                        |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| P1         | Privacy notice             | `BrandKit.privacyPolicyUrl` per tenant; linked in consent capture flow                 | ConsentRecord + BrandKit        |
| P2         | Choice and consent         | `POST /v1/consent/capture` — channel-scoped, timestamped, signed consent               | Consent service + routes        |
| P3         | Collection                 | Only PII fields needed for operations collected; PII tagged in Prisma schema           | Schema; data-classification     |
| P4         | Use and retention          | 7yr audit retention; lead PII not shared cross-tenant; `Org.aiRetargetingOptOut` flag  | Retention policy; opt-out flag  |
| P5         | Access                     | JIT PII unmask: dual-control, 30min grant, per-read audit row                          | `services/pii-vault`            |
| P6         | Disclosure                 | No PII shared cross-region or cross-tenant; cross-tenant probe in CI                   | Cross-tenant test; region guard |
| P7         | Quality                    | PII vault deterministic-SIV digest for uniqueness; phone validation via libphonenumber | PII service; validation         |
| P8         | Monitoring and enforcement | DSAR flow for subject requests; OAIC/CFPB/PDPC SLA timers                              | DSAR routes                     |

---

## Evidence collection schedule

| Cadence     | Artifact                                                    | Owner              |
| ----------- | ----------------------------------------------------------- | ------------------ |
| Every PR    | CI Gate 1–10 pass logs                                      | GitHub Actions     |
| Weekly      | Audit chain Merkle root (`docs/audits/merkle-roots/`)       | CI Gate 10         |
| Quarterly   | Access review export (`GET /v1/users` per org)              | Brodie / org_admin |
| Quarterly   | Vendor security assessment                                  | Brodie             |
| Quarterly   | DR game-day report                                          | SRE                |
| Per release | Pen-test readiness checklist (`docs/PEN_TEST_READINESS.md`) | Security engineer  |
| Annual      | External pen test (Bastion / Pure Hacking)                  | Security engineer  |

---

## Human-only items (cannot be closed by code)

The following are required for Type I and cannot be automated:

- [ ] External pen test executed and all P0/P1 findings closed
- [ ] Cyber + E&O insurance policy bound ($2M minimum)
- [ ] Legal review of TOS and privacy policy by qualified attorney
- [ ] Employee security awareness training records (annual)
- [ ] Vendor DPA in place for all sub-processors handling PII (Twilio, Resend, Mapbox, Railway, AWS)
- [ ] SOC 2 scoping letter signed with CPA firm
- [ ] Management assertion letter signed by Brodie
- [ ] System description document (narrative) reviewed by CPA firm
- [ ] Physical access controls narrative from Railway / AWS SOC 2 reports referenced
- [ ] BCDR plan reviewed and game-day drill evidenced

---

_Last updated: 2026-06-14. Control owners: Brodie Eaze (all). Next review: 2026-09-14._
