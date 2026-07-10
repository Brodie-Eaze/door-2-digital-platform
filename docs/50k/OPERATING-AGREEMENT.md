# Road to 50k — Operating Agreement

> Authorised by Brodie 2026-06-05. This governs the autonomous build push toward
> "live production, 50,000 concurrent users." It is the safety rail the loop runs inside.

## Goal (the honest version)

Take Door 2 Digital from its current state — **~20% functioning end-to-end** (polished
front end on a real-but-unwired backend; demo login; no production DB; `api` not deployed;
no money/MiCamp path) per `docs/AUDIT-2026-06-04.md` — to a platform that can **handle
50,000 concurrent users in live production** at the Stripe/Plaid engineering bar.

This is **~80% build + real infrastructure + load-proof**, with the quality gates
(`/council`, `/remediate`, `/ship-ready`, `/soc2-swarm`) running alongside. It is **not** a
"loop until green" exercise. No remediation loop alone reaches 50k.

## Autonomy (operate mode)

| Action                                              | Policy                                                    |
| --------------------------------------------------- | --------------------------------------------------------- |
| Edit code, write IaC, run audits, design load tests | **Autonomous**                                            |
| Commit reversible work to branches                  | **Autonomous** (never `main`)                             |
| Push branches to origin + open PRs                  | **Autonomous**                                            |
| Merge to `main`                                     | **QUEUED** for one-click approval                         |
| Deploy (staging or prod)                            | **QUEUED** (staging may be opened later if Brodie elects) |
| Move money / touch real funds                       | **QUEUED** + only Brodie executes                         |
| Customer / regulator / partner comms                | **QUEUED** + only Brodie sends                            |
| Create AWS account/Org, bind domain, enter creds    | **NEVER** — human-only critical path                      |

## Budget

- Run to **~85% of weekly usage**, then **auto-pause and brief**.
- I cannot read an exact weekly-usage meter from inside the session — so I **pace, checkpoint
  after each wave, and stop at the first sign of budget pressure** rather than risk overrun.
  Brodie + the harness hold the hard number.
- Kill switch: `~/.claude/.operate-pause` (create the file → I stop immediately).

## Loop shape (per wave)

1. Pick the top unblocked milestone from `ROAD-TO-50K.md`.
2. Fan out the right specialist fleet (builders + adversarial critic + tester).
3. Reconcile, run `tsc`/lint/tests, commit to a branch.
4. Gate: anything irreversible → append to the approval queue, don't execute.
5. Checkpoint: update `ROAD-TO-50K.md` status + brief.

## Human-only critical path (only Brodie — no agent can be these)

- [ ] Create the AWS account/Org + approve monthly spend (~$300–800/mo at 50k-grade).
- [ ] MiCamp sandbox credentials (no money path can be proven without them).
- [ ] A real domain + TLS certificate.
- [ ] Engage an external pen-test firm (I rehearse, I don't replace).
- [ ] Engage a SOC 2 auditor / CPA firm (I make ready, not certified).
- [ ] Engage a lawyer (paid-solicitor state registrations, TOS, contracts).

## Records

- Reversible work → branches (never `main`).
- Irreversible actions → `~/.claude/projects/-Users-Brodie/approval-queue/pending.md`.
- Every agent dispatch → governance-checked + audit-logged.
- Living backlog + status → `docs/50k/ROAD-TO-50K.md`.
