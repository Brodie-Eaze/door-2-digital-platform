/**
 * Field-signup service — one-call door-step sign-up.
 *
 * The native Knocker app can't construct the rich `POST /v1/conversions` shape
 * (it would need a pre-existing leadId + ConversionType + currency +
 * paymentProvider). This service takes the simple field shape and, in a SINGLE
 * tenant-pinned transaction, creates BOTH:
 *
 *   1. a Lead (PII vault-encrypted email/phone, emailDigest, vertical 'charity',
 *      consentGiven since the customer physically signed), and
 *   2. a Conversion (+ its child Donation) mapping the field frequency onto the
 *      real ConversionType / DonationFrequency enums.
 *
 * Everything is scoped to the authenticated principal's org — the orgId is NEVER
 * read from the request body. Mirrors the audit + idempotency discipline of the
 * conversion service.
 */
import { Prisma } from '@prisma/client';
import type { DonationFrequency, RegionCode } from '@prisma/client';
import { computeRake, money, newId, Problems, ProblemError } from '@d2d/shared-utils';
import { tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import { emitAnalyticsEvent } from '../analytics/service';
import { PiiVaultService } from '../pii-vault/service';
import type { CreateFieldSignupRequest, FieldSignupFrequency } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface FieldSignupPublic {
  id: string; // the conversion id (cnv_*)
  leadId: string;
}

/**
 * MiCamp ISO boards us at 0.5% of gross — mirror the conversion service's
 * residual stub. The field path always uses the `micamp` provider (the manual
 * ISO board path), so this is the only branch we need.
 */
function micampResidualCents(amountCents: bigint): bigint {
  return (amountCents * 5n) / 1000n;
}

/**
 * Split a free-text customer name into given / family. The first whitespace
 * token is the given name; the remainder is the family name. A single-token
 * name yields an empty family name (the Lead schema requires non-empty given,
 * so we guarantee given is non-empty by validation upstream).
 */
function splitName(full: string): { givenName: string; familyName: string } {
  const parts = full.trim().split(/\s+/);
  const givenName = parts[0] ?? full.trim();
  const familyName = parts.length > 1 ? parts.slice(1).join(' ') : '';
  return { givenName, familyName };
}

/**
 * Map the field-app frequency onto the real enums. `once` => one-off donation
 * (no DonationFrequency); `weekly`/`monthly` => recurring with the matching
 * DonationFrequency value.
 */
function mapFrequency(frequency: FieldSignupFrequency): {
  conversionType: 'donation_oneoff' | 'donation_recurring';
  donationFrequency: DonationFrequency | null;
} {
  if (frequency === 'once') {
    return { conversionType: 'donation_oneoff', donationFrequency: null };
  }
  return { conversionType: 'donation_recurring', donationFrequency: frequency };
}

export async function createFieldSignup(
  input: CreateFieldSignupRequest,
  actor: ActorContext,
): Promise<FieldSignupPublic> {
  const { givenName, familyName } = splitName(input.customerName);
  if (!givenName) {
    throw new ProblemError(Problems.validation('customerName must contain a name'));
  }

  const { conversionType, donationFrequency } = mapFrequency(input.frequency);

  const amountCents = BigInt(input.amountCents);
  const currency = 'USD';
  const signedAt = input.signedAt ? new Date(input.signedAt) : new Date();
  const processorResidualCents = micampResidualCents(amountCents);
  // Field sign-ups are door-attributed by definition — the rep knocked it.
  const rakeMoney = computeRake(money(amountCents, currency), 'door');
  const rake = rakeMoney.cents;

  const leadId = newId('lead');
  const conversionId = newId('cnv');

  // PII vault wraps email/phone exactly like the lead service. Digests use
  // HMAC-SHA256 (deterministic) so unique lookups work without plaintext.
  const emailVault = input.customerEmail
    ? PiiVaultService.encryptForRow('Lead', leadId, input.customerEmail)
    : null;
  const phoneVault = input.customerPhone
    ? PiiVaultService.encryptForRow('Lead', leadId, input.customerPhone)
    : null;
  const emailDig = input.customerEmail ? PiiVaultService.digest(input.customerEmail) : null;
  const phoneDig = input.customerPhone ? PiiVaultService.digest(input.customerPhone) : null;

  // Belt+suspenders unique key on the Conversion row (the header-level
  // Idempotency-Key already replays the response at the middleware layer).
  const idempotencyKey = newId('cnvidem');

  // SEC-005 — tenant-pinned TX so Postgres RLS scopes every row to actor.orgId.
  const result = await tenantTx(actor.orgId, async (tx) => {
    const lead = await tx.lead.create({
      data: {
        id: leadId,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        sourceKnockId: input.knockId ?? null,
        status: 'converted', // they signed on the doorstep — this is a conversion
        vertical: 'charity',
        givenName,
        familyName,
        // Legacy plaintext columns kept for backwards compatibility — the
        // canonical PII lives in *Vault and is read via PiiVaultService.
        email: input.customerEmail ?? null,
        emailDigest: emailDig,
        emailVault: emailVault ? (emailVault as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        phone: input.customerPhone ?? null,
        phoneDigest: phoneDig,
        phoneVault: phoneVault ? (phoneVault as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    // Consent: the customer physically signed at the door, so we record a
    // granted door-channel ConsentRecord as of the signature time. (The Lead
    // model has no consent columns — ConsentRecord is the authoritative home,
    // mirroring the consent service.)
    await tx.consentRecord.create({
      data: {
        id: newId('con'),
        leadId: lead.id,
        channel: 'door',
        granted: true,
        text: 'Door-step sign-up — customer signed the recurring-gift authorisation.',
        capturedAt: signedAt,
        proofKey: input.signatureKey ?? null,
      },
    });

    const conv = await tx.conversion.create({
      data: {
        id: conversionId,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        brandCode: 'd2d',
        leadId: lead.id,
        // The field app sends a CLIENT-generated knock UUID. The server knock
        // is created separately via POST /v1/knocks/batch with its OWN id
        // (newId('knk')), so the client UUID never matches a real Knock row —
        // linking it on this FK violates Conversion_knockId_fkey. We therefore
        // leave the conversion's knockId null here; the client knock id is
        // preserved on Lead.sourceKnockId (a non-FK column) + the audit trail
        // for later knock↔conversion reconciliation once the batch lands.
        knockId: null,
        knockerId: actor.userId,
        type: conversionType,
        attributionSource: 'door',
        amountCents,
        currency,
        signedAt,
        signatureKey: input.signatureKey ?? null,
        paymentProvider: 'micamp',
        processorResidualCents,
        d2dRakeCents: rake,
        idempotencyKey,
      },
    });

    await tx.donation.create({
      data: {
        id: newId('don'),
        conversionId,
        donorEmail: 'redacted@vaulted', // PII vault stores the real value at the Lead row.
        amountCents,
        currency,
        frequency: donationFrequency,
        paymentMethodTokenVault: null, // captured + encrypted when the recurring is set up
        status: 'active',
        startedAt: signedAt,
      },
    });

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'conversion.created',
      resourceType: 'Conversion',
      resourceId: conversionId,
      afterJson: {
        source: 'field_signup',
        type: conversionType,
        attributionSource: 'door',
        amountCents: amountCents.toString(),
        currency,
        paymentProvider: 'micamp',
        processorResidualCents: processorResidualCents.toString(),
        d2dRakeCents: rake.toString(),
        leadId: lead.id,
        clientKnockId: input.knockId ?? null, // for later knock↔conversion reconciliation

        // PII redacted — digests are reversible only with PII_SEARCH_KEY.
        emailDigest: emailDig,
        phoneDigest: phoneDig,
      },
    });

    // Real-time warehouse outbox: emit the "sale" event in the SAME tenantTx as
    // the Conversion so the AnalyticsEvent commits atomically with it (no event
    // can exist without its conversion, and vice-versa). orgId/regionCode/userId
    // come from the auth principal — never the request body.
    await emitAnalyticsEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      userId: actor.userId,
      eventType: 'sale',
      entityType: 'Conversion',
      entityId: conversionId,
      occurredAt: signedAt,
      payload: {
        amountCents: Number(amountCents),
        attributionSource: 'door',
        type: conversionType,
        serviceId: input.serviceId,
        frequency: input.frequency,
      },
    });

    return { leadId: lead.id, conversionId: conv.id };
  });

  return { id: result.conversionId, leadId: result.leadId };
}
