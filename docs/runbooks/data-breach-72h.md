# Runbook — Data Breach 72-Hour Response

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Classification:** CONFIDENTIAL — handle on need-to-know basis during response
> **Stack:** D2D Platform, multi-region (US: us-east-1, AU: ap-southeast-2, SG: ap-southeast-1)
> **Legal counsel contact:** [Insert US counsel contact before go-live]
> **Privacy contact for AU:** [Insert AU privacy officer contact]

---

## Clock starts at first awareness

Every notification deadline runs from "when you knew or ought reasonably to have known." Do not delay investigation to avoid triggering the clock. The clock is already running.

---

## Jurisdiction notification deadlines

| Jurisdiction                    | Trigger                                                                                                                                                       | Regulator deadline                                                                                                                                               | Individual notification                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AU (Privacy Act / NDB)**      | Reasonable grounds to believe eligible data breach occurred (unauthorised access/disclosure of personal information that is likely to result in serious harm) | **72 hours** to OAIC via NDB notification form                                                                                                                   | "As soon as practicable" if serious harm likely; no set statutory period but OAIC expects it to accompany or follow regulator notification closely |
| **US — California (CCPA/CPRA)** | Breach of unencrypted personal information                                                                                                                    | **30 days** to AG (breaches >500 CA residents); **no statutory deadline** for individual notification but "expedient time" is the standard; in practice ≤60 days | Promptly; no later than 30–45 days is safest                                                                                                       |
| **US — New York (SHIELD Act)**  | Breach of private information                                                                                                                                 | **30 days** notification to AG and affected individuals (no formal AG notification if <500 NY residents, but notify individuals)                                 | 30 days                                                                                                                                            |
| **US — other states**           | Varies; most are 30–90 days                                                                                                                                   | Check per-state table in `docs/compliance/us-state-breach-matrix.md` (create this before Phase 1 go-live)                                                        | Varies                                                                                                                                             |
| **SG (PDPA)**                   | Breach involving significant harm OR ≥500 individuals                                                                                                         | **72 hours** to PDPC via Data Breach Notification Form                                                                                                           | Notify affected individuals in parallel if significant harm likely                                                                                 |

**Practical rule:** Assume 72-hour clock applies to any breach touching AU or SG data. Treat US breach notifications as 30-day but begin drafting immediately.

---

## Step 1 — Detect + assess (Hour 0–2)

**Triggers that initiate this runbook:**

- Alert from Datadog / CloudWatch: anomalous outbound data transfer, unusual query patterns, unexpected large SELECT on PII tables
- Sentry error with PII in stack trace or payload
- External report: partner, researcher, or affected user
- Audit chain anomaly (see `audit-chain-mismatch.md`)
- BullMQ job exporting data to an unexpected destination

**Immediate actions:**

1. Open a private Slack/messaging thread for this incident. Do not discuss in public channels.
2. Capture the exact timestamp you first learned of the potential breach.
3. Screenshot or preserve all evidence before taking any remediation steps that could overwrite logs.
4. Determine data classification affected:
   - `PII` (name, email, phone, address) — highest priority
   - `PII-FINANCIAL` (payment instrument, bank account) — highest priority
   - `PII-SENSITIVE` (signature, photo of individual)
   - `INTERNAL` (configuration, non-PII business data)
5. Determine which `regionCode` rows were affected (US / AU / SG) — this controls which notification clocks are running.
6. Identify the mechanism: unauthorised access, misconfigured permission, exfiltration via partner API, code bug, insider?

**Containment — do NOW, before investigation is complete:**

- If a live attack is in progress: block the attacking IP at WAF. If unclear, take the affected service out of rotation (Route 53 weight to zero, or ECS service desired-count to zero for that region).
- If a leaked credential is suspected: immediately rotate the credential in Secrets Manager. Invalidate all active sessions for affected users: `DELETE FROM "RefreshToken" WHERE userId IN (...)`.
- If PII was logged (Pino `redact` bypass or misconfiguration): disable the logging route immediately; do not let it accumulate more data.
- Preserve CloudWatch / Datadog logs for the window. Set a manual retention lock if automated expiry might delete them before the investigation completes.

---

## Step 2 — Contain + scope (Hour 2–12)

1. Identify all data records that were potentially accessed or exfiltrated. Query the audit chain (`AuditEvent` table, then `S3 audit bucket`) for the affected resource types and time window.
2. Count affected individuals by region. This number drives which notification paths are mandatory.
3. Determine whether data was encrypted at rest (it should be — KMS CMK per region). If it was, many breach notification triggers may not apply (encrypted data is often excluded from notification requirements if the key was not compromised).
4. If KMS key compromise is suspected: escalate immediately. A compromised CMK invalidates the encryption defence. Contact AWS Support (Enterprise level if active).
5. Document: what data, which individuals, which region, how long was it exposed, is the exposure ongoing or closed?

---

## Step 3 — Notify (Hour 12–48)

### Decision tree

```
Was personal information accessed or disclosed without authorisation?
├── No → document + close (no notification required)
└── Yes → continue

Was the data encrypted with an uncompromised KMS key?
├── Yes → assess jurisdiction rules (encryption exemption may apply)
└── No / uncertain → proceed with notification

Does the breach affect AU data or SG data?
├── Yes → 72-hour clock is running — begin regulator notification NOW
└── No (US only) → 30-day clock for most states; begin drafting

Number of affected individuals ≥ 500?
├── Yes → California AG notification required (30 days)
└── No → individual state rules vary; check us-state-breach-matrix.md
```

### AU — OAIC notification

Portal: `https://www.oaic.gov.au/privacy/notifiable-data-breaches/report-a-data-breach`

Required information:

- Description of the eligible data breach (what happened, when)
- Type of personal information involved
- Number of individuals affected (estimate acceptable if unknown)
- Recommendations for individuals to protect themselves
- Contact details for affected individuals to seek more information

Statement must be filed within 72 hours of forming reasonable grounds. If uncertain, file a preliminary notification and supplement it.

### SG — PDPC notification

Portal: `https://www.pdpc.gov.sg/Guidelines-and-Consultation/Breach-Notification`

Required information: similar to AU; additionally requires whether the breach is ongoing and what remediation steps have been taken.

### US — individual notifications

Template (adapt per state requirements):

```
Subject: Notice of Data Breach — Door 2 Digital

Dear [Name],

We are writing to notify you of a data security incident that may have affected
your personal information stored in the Door 2 Digital platform.

What happened: [Description]
What information was involved: [Types of data]
What we are doing: [Remediation steps]
What you can do: [Recommended actions — monitor accounts, fraud alert, etc.]
For more information: Contact [email address]

We sincerely apologise for this incident.

[Signature]
Door 2 Digital
```

---

## Step 4 — Remediate (ongoing from Hour 1)

- Patch the vulnerability that allowed the breach. Deploy to staging first, validate, then prod.
- If a third-party partner was involved (MiCamp, Twilio, Meta, etc.), notify them and obtain their incident report.
- Conduct a full access review: revoke any credentials or sessions that were potentially compromised.
- PII vault key rotation if there is any suspicion the KMS CMK was accessed: `aws kms create-key`, re-encrypt affected DEKs, update Secrets Manager.
- Run `audit-chain-mismatch.md` verification to confirm audit trail integrity was not tampered with during the breach window.

---

## Step 5 — Postmortem + regulator follow-up

- File a blameless postmortem within 7 days.
- If the OAIC or PDPC requests a follow-up report (they often do for significant breaches), provide it within the requested timeframe.
- Update `docs/compliance/incident-register.md` (create this before Phase 1 go-live) with: incident ID, date, scope, notification dates, regulatory correspondence, remediation completed.
- SOC 2 auditor must be informed of any breach during the Type II observation window.

---

## What this runbook does NOT replace

- Legal advice. D2D's US counsel reviews all regulator notification text before filing.
- A forensic investigation. If the breach is significant, engage an external IR firm. Do not let internal teams overwrite forensic evidence.
- Cyber insurance notification. If D2D has a cyber policy, notify the insurer within the policy's required window (often 24–72 hours).
