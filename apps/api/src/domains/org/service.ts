/**
 * Org service — create / read / update / archive / brand-kit / billing.
 *
 * Region pinning is immutable: enforced at create time, every mutation
 * runs through the region guard, PATCH refuses any regionCode field.
 * Every mutation writes an AuditEvent in the same TX.
 */
import type { RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import type { CreateOrgRequest } from '@d2d/shared-types';
import { prisma, tenantTx } from '../../config/db';
import { redis } from '../../config/redis';
import { writeAudit } from '../../shared/audit/write';
import type { UpdateOrgRequest, UpdateBrandKitRequest, UpdateBillingRequest } from './schemas';

// ── Org cache helpers ──────────────────────────────────────────────────────
//
// Org records are read on nearly every authenticated request (route guard +
// billing lookups) but mutate rarely. A short-TTL Redis cache with jitter
// eliminates the DB round-trip on hot paths.
//
// TTL: 5 minutes + ±30s jitter → avoids stampede on deploy or bulk import.
// Invalidation: every write path (updateOrg / archiveOrg / upsertBrandKit /
// updateBilling) calls `invalidateOrgCache` so consumers see fresh data
// within one request cycle. Stale cache is the fallback, not the guarantee.
//
// Key format: `org:{orgId}:v1` — per-tenant, versioned namespace.

const ORG_CACHE_TTL_BASE_S = 300; // 5 min
const ORG_CACHE_JITTER_S = 30;

function orgCacheKey(orgId: string): string {
  return `org:${orgId}:v1`;
}

function orgCacheTtl(): number {
  return (
    ORG_CACHE_TTL_BASE_S + Math.floor(Math.random() * ORG_CACHE_JITTER_S * 2) - ORG_CACHE_JITTER_S
  );
}

async function getCachedOrg(orgId: string): Promise<OrgPublic | null> {
  try {
    const raw = await redis().get(orgCacheKey(orgId));
    if (!raw) return null;
    return JSON.parse(raw) as OrgPublic;
  } catch {
    // Redis hiccup — degrade gracefully to DB
    return null;
  }
}

async function setCachedOrg(org: OrgPublic): Promise<void> {
  try {
    await redis().setex(orgCacheKey(org.id), orgCacheTtl(), JSON.stringify(org));
  } catch {
    // Non-fatal — DB is the source of truth
  }
}

export async function invalidateOrgCache(orgId: string): Promise<void> {
  try {
    await redis().del(orgCacheKey(orgId));
  } catch {
    // Non-fatal
  }
}

interface ActorContext {
  userId?: string;
  regionCode?: RegionCode;
}

export async function createOrg(
  input: CreateOrgRequest,
  actor?: ActorContext,
): Promise<{ org: OrgPublic; brandKit: BrandKitPublic; billing: BillingPublic }> {
  const orgId = newId('org');
  const brandKitId = newId('brk');
  const billingId = newId('bil');

  const result = await tenantTx(orgId, async (tx) => {
    const org = await tx.org.create({
      data: {
        id: orgId,
        legalName: input.legalName,
        tradingName: input.tradingName,
        vertical: input.vertical,
        type: input.type,
        regionCode: input.regionCode,
        brandCode: input.brandCode ?? 'd2d',
        abnAcnUen: input.abnAcnUen ?? null,
        ssoProvider: input.ssoProvider ?? null,
      },
    });
    const brandKit = await tx.brandKit.create({
      data: {
        id: brandKitId,
        orgId,
        displayName: input.tradingName,
      },
    });
    const billing = await tx.orgBilling.create({
      data: {
        id: billingId,
        orgId,
        currency: input.currency,
      },
    });
    await writeAudit(tx, {
      orgId,
      regionCode: org.regionCode,
      actorUserId: actor?.userId ?? null,
      action: 'org.created',
      resourceType: 'Org',
      resourceId: orgId,
      afterJson: { legalName: org.legalName, regionCode: org.regionCode, type: org.type },
    });
    return { org, brandKit, billing };
  });

  return {
    org: toOrgPublic(result.org),
    brandKit: toBrandKitPublic(result.brandKit),
    billing: toBillingPublic(result.billing),
  };
}

export async function getOrg(orgId: string): Promise<OrgPublic> {
  // Org is a CONTROL-PLANE table (SEC-005 / WS6 §4b): it has no `orgId` column —
  // its tenant key is its own primary key `id`. The rls_belt migration enables RLS
  // on 26 child tables; Org is deliberately ABSENT (OrgBilling carries the tenant
  // column, not Org). So there is no GUC to pin and no deny-by-default to dodge — a
  // plain prisma() read is correct under the d2d_app belt (d2d_app holds DML grants
  // on all tables). tenantPrismaTx would pass Org straight through untouched anyway
  // (db.ts: non-org-scoped models bypass the GUC wrapper), so wrapping it would be a
  // misleading no-op. Tenant isolation for Org is enforced ABOVE this layer: the
  // route guard (req.params.id === ctx.orgId) + WS1 app-layer suspenders.
  //
  // Cache-aside: warm path serves from Redis (5-min TTL + jitter). Cold/miss
  // path falls back to DB and re-populates the cache. Every write path
  // invalidates via `invalidateOrgCache`.
  const cached = await getCachedOrg(orgId);
  if (cached) return cached;

  const org = await prisma().org.findUnique({ where: { id: orgId } });
  if (!org) throw new ProblemError(Problems.notFound('Org', orgId));
  const pub = toOrgPublic(org);
  await setCachedOrg(pub);
  return pub;
}

export async function updateOrg(
  orgId: string,
  input: UpdateOrgRequest,
  actor: ActorContext,
): Promise<OrgPublic> {
  // Defensive: schema declares regionCode as never, but double-check at the
  // service layer too. Belt + suspenders, easier to test than a strict-schema
  // refusal in isolation.
  if ((input as Record<string, unknown>).regionCode !== undefined) {
    throw new ProblemError({
      type: 'https://docs.d2d.io/problems/region-immutable',
      title: 'Region immutable',
      status: 400,
      detail: 'Region code is locked at org creation and cannot be changed',
    });
  }
  const existing = await prisma().org.findUnique({ where: { id: orgId } });
  if (!existing) throw new ProblemError(Problems.notFound('Org', orgId));

  const updated = await tenantTx(orgId, async (tx) => {
    const next = await tx.org.update({
      where: { id: orgId },
      data: {
        ...(input.legalName !== undefined && { legalName: input.legalName }),
        ...(input.tradingName !== undefined && { tradingName: input.tradingName }),
        ...(input.abnAcnUen !== undefined && { abnAcnUen: input.abnAcnUen }),
        ...(input.brandCode !== undefined && { brandCode: input.brandCode }),
        ...(input.aiBudgetCents !== undefined && {
          aiBudgetCents:
            typeof input.aiBudgetCents === 'bigint'
              ? input.aiBudgetCents
              : BigInt(input.aiBudgetCents as string),
        }),
        ...(input.aiRetargetingOptOut !== undefined && {
          aiRetargetingOptOut: input.aiRetargetingOptOut,
        }),
        ...(input.ssoProvider !== undefined && { ssoProvider: input.ssoProvider }),
      },
    });
    await writeAudit(tx, {
      orgId,
      regionCode: next.regionCode,
      actorUserId: actor.userId ?? null,
      action: 'org.updated',
      resourceType: 'Org',
      resourceId: orgId,
      beforeJson: subset(existing, Object.keys(input)),
      afterJson: subset(next, Object.keys(input)),
    });
    return next;
  });
  await invalidateOrgCache(orgId);
  return toOrgPublic(updated);
}

export async function archiveOrg(orgId: string, actor: ActorContext): Promise<OrgPublic> {
  const existing = await prisma().org.findUnique({ where: { id: orgId } });
  if (!existing) throw new ProblemError(Problems.notFound('Org', orgId));
  if (existing.status === 'archived') return toOrgPublic(existing);

  const updated = await tenantTx(orgId, async (tx) => {
    const next = await tx.org.update({
      where: { id: orgId },
      data: { status: 'archived', archivedAt: new Date() },
    });
    await writeAudit(tx, {
      orgId,
      regionCode: next.regionCode,
      actorUserId: actor.userId ?? null,
      action: 'org.archived',
      resourceType: 'Org',
      resourceId: orgId,
      beforeJson: { status: existing.status },
      afterJson: { status: 'archived' },
    });
    return next;
  });
  await invalidateOrgCache(orgId);
  return toOrgPublic(updated);
}

export async function upsertBrandKit(
  orgId: string,
  input: UpdateBrandKitRequest,
  actor: ActorContext,
): Promise<BrandKitPublic> {
  const org = await prisma().org.findUnique({ where: { id: orgId } });
  if (!org) throw new ProblemError(Problems.notFound('Org', orgId));

  const result = await tenantTx(orgId, async (tx) => {
    const existing = await tx.brandKit.findUnique({ where: { orgId } });
    const data = {
      displayName: input.displayName ?? existing?.displayName ?? org.tradingName,
      logoLightKey: input.logoLightKey ?? existing?.logoLightKey ?? null,
      logoDarkKey: input.logoDarkKey ?? existing?.logoDarkKey ?? null,
      iconKey: input.iconKey ?? existing?.iconKey ?? null,
      faviconKey: input.faviconKey ?? existing?.faviconKey ?? null,
      primaryColor: input.primaryColor ?? existing?.primaryColor ?? '#0F172A',
      accentColor: input.accentColor ?? existing?.accentColor ?? '#3B82F6',
      customDomain: input.customDomain ?? existing?.customDomain ?? null,
      supportEmail: input.supportEmail ?? existing?.supportEmail ?? null,
      supportPhone: input.supportPhone ?? existing?.supportPhone ?? null,
      privacyPolicyUrl: input.privacyPolicyUrl ?? existing?.privacyPolicyUrl ?? null,
      termsUrl: input.termsUrl ?? existing?.termsUrl ?? null,
    };
    const next = existing
      ? await tx.brandKit.update({ where: { orgId }, data })
      : await tx.brandKit.create({ data: { id: newId('brk'), orgId, ...data } });
    await writeAudit(tx, {
      orgId,
      regionCode: org.regionCode,
      actorUserId: actor.userId ?? null,
      action: existing ? 'brandKit.updated' : 'brandKit.created',
      resourceType: 'BrandKit',
      resourceId: next.id,
      beforeJson: existing ? subset(existing, Object.keys(input)) : null,
      afterJson: subset(next, Object.keys(input)),
    });
    return next;
  });
  // BrandKit changes update the org's presentation layer; invalidate so any
  // cached org record (which embedders may derive from) is refreshed.
  await invalidateOrgCache(orgId);
  return toBrandKitPublic(result);
}

export async function updateBilling(
  orgId: string,
  input: UpdateBillingRequest,
  actor: ActorContext,
): Promise<BillingPublic> {
  const org = await prisma().org.findUnique({ where: { id: orgId } });
  if (!org) throw new ProblemError(Problems.notFound('Org', orgId));

  const result = await tenantTx(orgId, async (tx) => {
    const existing = await tx.orgBilling.findUnique({ where: { orgId } });
    if (!existing) {
      // Should be created by createOrg, but guard for legacy rows.
      throw new ProblemError(Problems.notFound('OrgBilling'));
    }
    const next = await tx.orgBilling.update({
      where: { orgId },
      data: {
        ...(input.platformFeeMonthlyCents !== undefined && {
          platformFeeMonthlyCents:
            typeof input.platformFeeMonthlyCents === 'bigint'
              ? input.platformFeeMonthlyCents
              : BigInt(input.platformFeeMonthlyCents as string),
        }),
        ...(input.doorRakePercent !== undefined && {
          doorRakePercent: input.doorRakePercent,
        }),
        ...(input.insideSalesRakePercent !== undefined && {
          insideSalesRakePercent: input.insideSalesRakePercent,
        }),
        ...(input.retargetingRakePercent !== undefined && {
          retargetingRakePercent: input.retargetingRakePercent,
        }),
        ...(input.billingDay !== undefined && { billingDay: input.billingDay }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.micampMerchantId !== undefined && {
          micampMerchantId: input.micampMerchantId,
        }),
        ...(input.stripeCustomerId !== undefined && {
          stripeCustomerId: input.stripeCustomerId,
        }),
      },
    });
    await writeAudit(tx, {
      orgId,
      regionCode: org.regionCode,
      actorUserId: actor.userId ?? null,
      action: 'orgBilling.updated',
      resourceType: 'OrgBilling',
      resourceId: next.id,
      beforeJson: serializeBilling(existing),
      afterJson: serializeBilling(next),
    });
    return next;
  });
  // Billing changes affect rate/limit data often read alongside the org.
  await invalidateOrgCache(orgId);
  return toBillingPublic(result);
}

// ───────────────────────────────────────────────────────────────────────────
// Public shapes (BigInt → string for JSON transport)
// ───────────────────────────────────────────────────────────────────────────

export interface OrgPublic {
  id: string;
  legalName: string;
  tradingName: string;
  vertical: string;
  type: string;
  regionCode: RegionCode;
  brandCode: string;
  status: string;
  abnAcnUen: string | null;
  aiBudgetCents: string;
  aiRetargetingOptOut: boolean;
  ssoProvider: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface BrandKitPublic {
  id: string;
  orgId: string;
  displayName: string;
  logoLightKey: string | null;
  logoDarkKey: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  updatedAt: string;
}

export interface BillingPublic {
  id: string;
  orgId: string;
  platformFeeMonthlyCents: string;
  doorRakePercent: string;
  insideSalesRakePercent: string;
  retargetingRakePercent: string;
  billingDay: number;
  currency: string;
  micampMerchantId: string | null;
  stripeCustomerId: string | null;
  updatedAt: string;
}

function toOrgPublic(o: {
  id: string;
  legalName: string;
  tradingName: string;
  vertical: string;
  type: string;
  regionCode: RegionCode;
  brandCode: string;
  status: string;
  abnAcnUen: string | null;
  aiBudgetCents: bigint;
  aiRetargetingOptOut: boolean;
  ssoProvider: string | null;
  createdAt: Date;
  archivedAt: Date | null;
}): OrgPublic {
  return {
    id: o.id,
    legalName: o.legalName,
    tradingName: o.tradingName,
    vertical: o.vertical,
    type: o.type,
    regionCode: o.regionCode,
    brandCode: o.brandCode,
    status: o.status,
    abnAcnUen: o.abnAcnUen,
    aiBudgetCents: o.aiBudgetCents.toString(),
    aiRetargetingOptOut: o.aiRetargetingOptOut,
    ssoProvider: o.ssoProvider,
    createdAt: o.createdAt.toISOString(),
    archivedAt: o.archivedAt ? o.archivedAt.toISOString() : null,
  };
}

function toBrandKitPublic(b: {
  id: string;
  orgId: string;
  displayName: string;
  logoLightKey: string | null;
  logoDarkKey: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  updatedAt: Date;
}): BrandKitPublic {
  return {
    id: b.id,
    orgId: b.orgId,
    displayName: b.displayName,
    logoLightKey: b.logoLightKey,
    logoDarkKey: b.logoDarkKey,
    primaryColor: b.primaryColor,
    accentColor: b.accentColor,
    customDomain: b.customDomain,
    supportEmail: b.supportEmail,
    supportPhone: b.supportPhone,
    updatedAt: b.updatedAt.toISOString(),
  };
}

function toBillingPublic(b: {
  id: string;
  orgId: string;
  platformFeeMonthlyCents: bigint;
  doorRakePercent: { toString(): string };
  insideSalesRakePercent: { toString(): string };
  retargetingRakePercent: { toString(): string };
  billingDay: number;
  currency: string;
  micampMerchantId: string | null;
  stripeCustomerId: string | null;
  updatedAt: Date;
}): BillingPublic {
  return {
    id: b.id,
    orgId: b.orgId,
    platformFeeMonthlyCents: b.platformFeeMonthlyCents.toString(),
    doorRakePercent: b.doorRakePercent.toString(),
    insideSalesRakePercent: b.insideSalesRakePercent.toString(),
    retargetingRakePercent: b.retargetingRakePercent.toString(),
    billingDay: b.billingDay,
    currency: b.currency,
    micampMerchantId: b.micampMerchantId,
    stripeCustomerId: b.stripeCustomerId,
    updatedAt: b.updatedAt.toISOString(),
  };
}

function serializeBilling(b: {
  platformFeeMonthlyCents: bigint;
  doorRakePercent: { toString(): string };
  insideSalesRakePercent: { toString(): string };
  retargetingRakePercent: { toString(): string };
  billingDay: number;
  currency: string;
}): Record<string, unknown> {
  return {
    platformFeeMonthlyCents: b.platformFeeMonthlyCents.toString(),
    doorRakePercent: b.doorRakePercent.toString(),
    insideSalesRakePercent: b.insideSalesRakePercent.toString(),
    retargetingRakePercent: b.retargetingRakePercent.toString(),
    billingDay: b.billingDay,
    currency: b.currency,
  };
}

function subset<T extends Record<string, unknown>>(
  obj: T,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) {
      const v = obj[k];
      out[k] = typeof v === 'bigint' ? v.toString() : v;
    }
  }
  return out;
}
