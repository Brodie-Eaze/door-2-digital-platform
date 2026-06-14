/**
 * Consent service — capture + lookup consent records.
 *
 * One ConsentRecord row per channel. Consent is source-of-truth for
 * "may we contact this person" and lives outside Lead so it survives
 * lead deletion per compliance requirements.
 *
 * Tenant isolation is enforced by verifying the referenced leadId
 * belongs to the calling org before writing.
 */
import type { ConsentChannel } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import type { CaptureConsentRequest } from '@d2d/shared-types';

interface ActorContext {
  userId: string;
  orgId: string;
}

export interface ConsentRecordPublic {
  id: string;
  leadId: string | null;
  channel: string;
  granted: boolean;
  scope: string;
  capturedAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
}

function toPublic(row: {
  id: string;
  leadId: string | null;
  channel: ConsentChannel;
  granted: boolean;
  text: string;
  capturedAt: Date;
  revokedAt: Date | null;
  expiresAt: Date | null;
}): ConsentRecordPublic {
  // scope is embedded in the text field as "scope:<value> — <wording>"
  const scope = row.text.startsWith('scope:')
    ? row.text.split(' — ')[0].replace('scope:', '')
    : 'marketing';
  return {
    id: row.id,
    leadId: row.leadId,
    channel: row.channel,
    granted: row.granted,
    scope,
    capturedAt: row.capturedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

// ── Capture ────────────────────────────────────────────────────────────────

export async function captureConsent(
  body: CaptureConsentRequest,
  actor: ActorContext,
): Promise<{ records: ConsentRecordPublic[] }> {
  // If leadId provided, verify it belongs to the calling org (tenant isolation)
  if (body.leadId) {
    const lead = await prisma().lead.findUnique({
      where: { id: body.leadId },
      select: { orgId: true },
    });
    if (!lead) throw new ProblemError(Problems.notFound('Lead', body.leadId));
    if (lead.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(lead.orgId));
  }

  const capturedAt = new Date(body.capturedAt);
  const consentText = `scope:${body.scope} — consented via ${body.channels.join(', ')}`;

  const records = await prisma().$transaction(
    body.channels.map((channel) =>
      prisma().consentRecord.create({
        data: {
          id: newId('cns'),
          leadId: body.leadId ?? null,
          channel: channel as ConsentChannel,
          granted: true,
          text: consentText,
          capturedAt,
          proofKey: body.signatureKey ?? body.evidenceKey ?? null,
        },
      }),
    ),
  );

  return { records: records.map(toPublic) };
}

// ── Lookup ─────────────────────────────────────────────────────────────────

export async function lookupConsent(
  leadId: string,
  actor: ActorContext,
  channel?: ConsentChannel,
): Promise<{ records: ConsentRecordPublic[] }> {
  const lead = await prisma().lead.findUnique({
    where: { id: leadId },
    select: { orgId: true },
  });
  if (!lead) throw new ProblemError(Problems.notFound('Lead', leadId));
  if (lead.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(lead.orgId));

  const rows = await prisma().consentRecord.findMany({
    where: {
      leadId,
      revokedAt: null,
      ...(channel && { channel }),
    },
    orderBy: { capturedAt: 'desc' },
  });

  return { records: rows.map(toPublic) };
}

// ── Withdraw ───────────────────────────────────────────────────────────────

export async function withdrawConsent(
  id: string,
  actor: ActorContext,
): Promise<ConsentRecordPublic> {
  const row = await prisma().consentRecord.findUnique({
    where: { id },
    include: { lead: { select: { orgId: true } } },
  });
  if (!row) throw new ProblemError(Problems.notFound('ConsentRecord', id));

  // Tenant check via the associated lead
  if (row.lead && row.lead.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(row.lead.orgId));
  }

  const updated = await prisma().consentRecord.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return toPublic(updated);
}
