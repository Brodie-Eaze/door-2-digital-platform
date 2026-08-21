/**
 * Billing service — Phase 1.3.
 *
 * Generates monthly invoices for client orgs: flat platform fee + per-bucket
 * attribution-source rakes (door 15%, inside_sales 10%, retargeting 5%).
 *
 * All amounts in BigInt cents (ADR-0007). Integer percent math pattern:
 *   (amountCents * BigInt(Math.round(pct * 10))) / 1000n
 * so a Decimal(5,2) like 15.00 → 150 → (x * 150n) / 1000n = exactly 15%.
 *
 * Invoice generation is idempotent on (orgId, calendar-month):
 *   idempotencyKey = `inv-${orgId}-${periodStart.toISOString().slice(0,7)}`
 * A second call for the same month returns the existing invoice.
 */
import type { Prisma, RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type { ListInvoicesQuery, ResidualsQuery } from './schemas';
import type { GenerateInvoiceRequest } from '@d2d/shared-types';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

// ─── public shapes ───────────────────────────────────────────────────────────

export interface InvoiceLineItemPublic {
  id: string;
  kind: string;
  description: string;
  amountCents: string; // BigInt serialised as string
  currency: string;
  conversionCount: number;
}

export interface InvoicePublic {
  id: string;
  orgId: string;
  regionCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  platformFeeCents: string;
  doorRakeCents: string;
  insideSalesRakeCents: string;
  retargetingRakeCents: string;
  additionalCents: string;
  totalCents: string;
  currency: string;
  idempotencyKey: string;
  sentAt: string | null;
  paidAt: string | null;
  lineItems: InvoiceLineItemPublic[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcessorResidualRow {
  conversionId: string;
  amountCents: string;
  processorResidualCents: string;
  paymentProvider: string;
  signedAt: string;
}

// ─── generate ────────────────────────────────────────────────────────────────

export async function generateInvoice(
  input: GenerateInvoiceRequest,
  actor: ActorContext,
): Promise<InvoicePublic> {
  // Callers may only generate invoices for their own org.
  if (input.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(input.orgId));
  }

  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);
  const idempotencyKey = `inv-${input.orgId}-${periodStart.toISOString().slice(0, 7)}`;

  // Idempotent: return existing if already generated for this month.
  const existing = await prisma().invoice.findUnique({
    where: { idempotencyKey },
    include: { lineItems: true },
  });
  if (existing) return toPublicInvoice(existing);

  // Load billing config for this org.
  const billing = await prisma().orgBilling.findUnique({
    where: { orgId: input.orgId },
  });
  if (!billing) {
    throw new ProblemError(Problems.notFound('OrgBilling', input.orgId));
  }

  // Aggregate conversions by AttributionSource for this period.
  const agg = await prisma().conversion.groupBy({
    by: ['attributionSource'],
    where: {
      orgId: input.orgId,
      signedAt: { gte: periodStart, lt: periodEnd },
    },
    _sum: { amountCents: true },
    _count: { id: true },
  });

  const bySource = (source: string) => agg.find((r) => r.attributionSource === source);

  // Integer percent helper — keeps BigInt throughout.
  const rake = (totalCents: bigint, pctDecimal: number): bigint =>
    (totalCents * BigInt(Math.round(pctDecimal * 10))) / 1000n;

  const doorTotal = BigInt(bySource('door')?._sum.amountCents ?? 0n);
  const insideSalesTotal = BigInt(bySource('inside_sales')?._sum.amountCents ?? 0n);
  const retargetingTotal = BigInt(bySource('retargeting')?._sum.amountCents ?? 0n);

  const platformFeeCents = BigInt(billing.platformFeeMonthlyCents);
  const doorRakeCents = rake(doorTotal, Number(billing.doorRakePercent));
  const insideSalesRakeCents = rake(insideSalesTotal, Number(billing.insideSalesRakePercent));
  const retargetingRakeCents = rake(retargetingTotal, Number(billing.retargetingRakePercent));

  // Manual line items passed in the request (overages, credits, one-off fees).
  const additionalCents = (input.lineItems ?? []).reduce(
    (acc, li) => acc + BigInt(li.amountCents),
    0n,
  );

  const totalCents =
    platformFeeCents +
    doorRakeCents +
    insideSalesRakeCents +
    retargetingRakeCents +
    additionalCents;

  // Build the line-item rows to insert.
  const lineItemData: Prisma.InvoiceLineItemCreateManyInvoiceInput[] = [
    {
      id: newId('ili'),
      kind: 'platform_fee',
      description: `Platform fee — ${periodStart.toISOString().slice(0, 7)}`,
      amountCents: platformFeeCents,
      currency: billing.currency,
      conversionCount: 0,
    },
  ];

  if (doorRakeCents > 0n) {
    lineItemData.push({
      id: newId('ili'),
      kind: 'door_rake',
      description: `Door-close rake (${billing.doorRakePercent}%) — ${bySource('door')?._count.id ?? 0} conversions`,
      amountCents: doorRakeCents,
      currency: billing.currency,
      conversionCount: bySource('door')?._count.id ?? 0,
    });
  }

  if (insideSalesRakeCents > 0n) {
    lineItemData.push({
      id: newId('ili'),
      kind: 'inside_sales_rake',
      description: `Inside-sales rake (${billing.insideSalesRakePercent}%) — ${bySource('inside_sales')?._count.id ?? 0} conversions`,
      amountCents: insideSalesRakeCents,
      currency: billing.currency,
      conversionCount: bySource('inside_sales')?._count.id ?? 0,
    });
  }

  if (retargetingRakeCents > 0n) {
    lineItemData.push({
      id: newId('ili'),
      kind: 'retargeting_rake',
      description: `Retargeting rake (${billing.retargetingRakePercent}%) — ${bySource('retargeting')?._count.id ?? 0} conversions`,
      amountCents: retargetingRakeCents,
      currency: billing.currency,
      conversionCount: bySource('retargeting')?._count.id ?? 0,
    });
  }

  // Append any manual line items from the request.
  for (const li of input.lineItems ?? []) {
    lineItemData.push({
      id: newId('ili'),
      kind: li.kind,
      description: li.description,
      amountCents: BigInt(li.amountCents),
      currency: li.currency ?? billing.currency,
      conversionCount: 0,
    });
  }

  // Write invoice + line items atomically inside a tenant-pinned transaction.
  const invoiceId = newId('inv');
  const invoice = await tenantTx(actor.orgId, async (tx) => {
    const created = await tx.invoice.create({
      data: {
        id: invoiceId,
        orgId: input.orgId,
        regionCode: actor.regionCode,
        periodStart,
        periodEnd,
        status: 'draft',
        platformFeeCents,
        doorRakeCents,
        insideSalesRakeCents,
        retargetingRakeCents,
        additionalCents,
        totalCents,
        currency: billing.currency,
        idempotencyKey,
        lineItems: { createMany: { data: lineItemData } },
      },
      include: { lineItems: true },
    });

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'invoice.generated',
      resourceType: 'Invoice',
      resourceId: created.id,
      afterJson: {
        period: periodStart.toISOString().slice(0, 7),
        totalCents: totalCents.toString(),
        status: 'draft',
      },
    });

    return created;
  });

  return toPublicInvoice(invoice);
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listInvoices(
  query: ListInvoicesQuery,
  actor: ActorContext,
): Promise<{ data: InvoicePublic[]; nextCursor: string | null }> {
  const where: Prisma.InvoiceWhereInput = { orgId: actor.orgId };
  if (query.status) where.status = query.status;

  const rows = await prisma().invoice.findMany({
    where,
    include: { lineItems: true },
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { periodStart: 'desc' },
  });

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toPublicInvoice), nextCursor };
}

// ─── get one ─────────────────────────────────────────────────────────────────

export async function getInvoice(id: string, actor: ActorContext): Promise<InvoicePublic> {
  const invoice = await prisma().invoice.findUnique({
    where: { id },
    include: { lineItems: true },
  });

  if (!invoice) throw new ProblemError(Problems.notFound('Invoice', id));
  if (invoice.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(invoice.orgId));
  }

  return toPublicInvoice(invoice);
}

// ─── processor residuals ──────────────────────────────────────────────────────

export async function getProcessorResiduals(
  query: ResidualsQuery,
  actor: ActorContext,
): Promise<{ data: ProcessorResidualRow[]; nextCursor: string | null }> {
  const rows = await prisma().conversion.findMany({
    where: {
      orgId: actor.orgId,
      signedAt: { gte: new Date(query.from), lt: new Date(query.to) },
      processorResidualCents: { gt: 0 },
    },
    select: {
      id: true,
      amountCents: true,
      processorResidualCents: true,
      paymentProvider: true,
      signedAt: true,
    },
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { signedAt: 'desc' },
  });

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;

  return {
    data: slice.map((r) => ({
      conversionId: r.id,
      amountCents: r.amountCents.toString(),
      processorResidualCents: (r.processorResidualCents ?? 0n).toString(),
      paymentProvider: r.paymentProvider ?? 'unknown',
      signedAt: r.signedAt?.toISOString() ?? '',
    })),
    nextCursor,
  };
}

// ─── serialisation ────────────────────────────────────────────────────────────

function toPublicInvoice(inv: {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  platformFeeCents: bigint;
  doorRakeCents: bigint;
  insideSalesRakeCents: bigint;
  retargetingRakeCents: bigint;
  additionalCents: bigint;
  totalCents: bigint;
  currency: string;
  idempotencyKey: string;
  sentAt: Date | null;
  paidAt: Date | null;
  lineItems: {
    id: string;
    kind: string;
    description: string;
    amountCents: bigint;
    currency: string;
    conversionCount: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}): InvoicePublic {
  return {
    id: inv.id,
    orgId: inv.orgId,
    regionCode: inv.regionCode,
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    status: inv.status,
    platformFeeCents: inv.platformFeeCents.toString(),
    doorRakeCents: inv.doorRakeCents.toString(),
    insideSalesRakeCents: inv.insideSalesRakeCents.toString(),
    retargetingRakeCents: inv.retargetingRakeCents.toString(),
    additionalCents: inv.additionalCents.toString(),
    totalCents: inv.totalCents.toString(),
    currency: inv.currency,
    idempotencyKey: inv.idempotencyKey,
    sentAt: inv.sentAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    lineItems: inv.lineItems.map((li) => ({
      id: li.id,
      kind: li.kind,
      description: li.description,
      amountCents: li.amountCents.toString(),
      currency: li.currency,
      conversionCount: li.conversionCount,
    })),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}
