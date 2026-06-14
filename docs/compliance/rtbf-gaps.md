# RTBF Gap Register — Right to Be Forgotten

Per ADR-0013: deletion DSAR = anonymise PII at rest, preserve structural rows for audit chain.

## RTBF-001 — Deletion without subjectLeadId

**Status:** Open  
**Severity:** P1 — requires manual resolution by org admin

**Description:**  
`fulfilDsarRequest()` dispatches `executeRtbf()` which requires a `subjectLeadId` to scope
the erasure to all PII-bearing rows (Lead, Knock, KnockPhoto, VoiceRecording). If the DSAR
was filed with only `subjectEmail` / `subjectPhone` (no `subjectLeadId`), the automated
erasure path is skipped and an audit event `dsar.rtbf.skipped_no_lead` is written instead.

**Resolution path:**  
Org admin must:

1. Search for the Lead using the unmasked email/phone (via PII vault JIT-unmask if needed).
2. Re-submit the DSAR fulfilment with `subjectLeadId` populated, OR
3. Execute a direct DB admin erasure via the `reindex-pii` tool (when built) targeting that
   specific Lead ID. This requires `super_admin` + WebAuthn hardware key + second approver.

**Tracking:** Referenced in `apps/api/src/domains/dsar/service.ts` → `executeRtbf()`.

---

## RTBF-002 — User model PII (givenName, familyName, phone) not erased on lead deletion

**Status:** Open  
**Severity:** P2 — User rows are org-staff, not leads; separate erasure path needed

**Description:**  
`executeRtbf()` erases Lead + Knock chain. It does NOT erase `User` model PII (givenName,
familyName, phone) because knocker/staff Users are a different identity from Leads. A knocker
who is ALSO a donor would have their Lead row erased but their User row untouched.

**Resolution path:**  
If a DSAR covers a person who is ALSO a platform User (e.g. a staff member), the org admin
must separately offboard + anonymise the User row via `DELETE /v1/users/:id` (which should
be extended to anonymise rather than hard-delete). Tracked as a separate user-erasure feature.

---

## RTBF-003 — Address model not erased

**Status:** Open  
**Severity:** P3 — Address rows are shared across Leads; safe-to-erase requires count check

**Description:**  
The `Address` model (`street`, `locality`, `postcode`) is NOT erased by `executeRtbf()`.
A Lead references an Address via `addressId`, but the Address row is shared across all Leads
at the same physical address. Erasing it would affect other tenants/leads.

**Resolution path:**  
Phase 1.4 will introduce Address.street/postal vault columns (noted in pii-vault/service.ts
line 599). The RTBF path should: decrement a reference count, and erase if count drops to 0
for that org, OR anonymise the street/postal columns within an org-scoped view without
touching the shared row.

---

## RTBF-004 — VoiceRecording.transcript ML write path

**Status:** Open  
**Severity:** P3 — no transcripts exist yet (ML pipeline not built)

**Description:**  
`executeRtbf()` nulls `transcriptVault` on VoiceRecording rows linked to erased Knocks.
The ML pipeline write path (Phase 3.2) must write encrypted-only from Day 1 so that RTBF
nulling the vault is sufficient for erasure. Until the pipeline is built, `transcript` is
always null and this gap has no practical impact.

**Resolution path:**  
ML pipeline integration spec (when written) must include: write `transcriptVault` (encrypted),
write `transcript = '[vaulted]'` sentinel. RTBF is then automatic via vault null.

---

## RTBF-005 — DsarRequest.subjectEmail / subjectPhone (masked sentinels post-RTBF)

**Status:** Accepted / By Design  
**Severity:** Informational

**Description:**  
After RTBF execution, `DsarRequest.subjectEmail` and `subjectEmail` retain the masked
sentinel (e.g. `j•••@gmail.com`) and the vault columns (`subjectEmailVault`,
`subjectPhoneVault`) are NOT nulled. This is intentional: the DSAR record itself is the
legal evidence that a deletion request was received and fulfilled. Erasing the subject
identifier from the DSAR would make it impossible to audit compliance.

**Legal basis:** The audit row proving the DSAR was fulfilled must be retained. The masked
sentinel does not identify the individual; the vault ciphertext is decryptable only via KMS
by `super_admin` with WebAuthn second factor.
