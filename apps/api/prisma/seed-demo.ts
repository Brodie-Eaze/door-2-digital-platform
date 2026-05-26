/**
 * Demo seed — idempotent. Creates the 4 sub-account Orgs that the
 * web-operator UI links to (hope-forward, world-vision, pestmax,
 * gold-coast-hospital), one platform Org for Brodie, and 5 demo Users
 * with known passwords.
 *
 * Safe to re-run: every row is upserted by deterministic id / email digest,
 * so this script can land in a CI bootstrap or be invoked by hand after a
 * fresh `prisma migrate reset`.
 *
 * Usage:
 *   pnpm tsx prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import type { Prisma, RegionCode, Vertical } from '@prisma/client';
import { emailDigest } from '@d2d/shared-utils';
import { hashPassword } from '../src/domains/auth/password';

const prisma = new PrismaClient();

interface DemoOrg {
  id: string;
  slug: string;
  legalName: string;
  tradingName: string;
  vertical: Vertical;
  regionCode: RegionCode;
  brandCode: string;
}

interface DemoUser {
  id: string;
  email: string;
  password: string;
  givenName: string;
  familyName: string;
  role: 'super_admin' | 'org_admin';
  orgSlug: string;
}

// Deterministic IDs so re-runs upsert cleanly rather than duplicating.
const ORGS: DemoOrg[] = [
  {
    id: 'org_demo_platform',
    slug: 'door2digital-platform',
    legalName: 'Door 2 Digital Platform',
    tradingName: 'Door 2 Digital',
    vertical: 'commercial',
    regionCode: 'US',
    brandCode: 'd2d',
  },
  {
    id: 'org_demo_hope_forward',
    slug: 'hope-forward',
    legalName: 'Hope Forward International',
    tradingName: 'Hope Forward',
    vertical: 'charity',
    regionCode: 'US',
    brandCode: 'd2d',
  },
  {
    id: 'org_demo_world_vision',
    slug: 'world-vision',
    legalName: 'World Vision Australia',
    tradingName: 'World Vision',
    vertical: 'charity',
    regionCode: 'AU',
    brandCode: 'd2d',
  },
  {
    id: 'org_demo_pestmax',
    slug: 'pestmax',
    legalName: 'PestMax Services',
    tradingName: 'PestMax',
    vertical: 'commercial',
    regionCode: 'US',
    brandCode: 'd2d',
  },
  {
    id: 'org_demo_gch',
    slug: 'gold-coast-hospital',
    legalName: 'Gold Coast Hospital Foundation',
    tradingName: 'Gold Coast Hospital',
    vertical: 'charity', // schema enum only supports charity|commercial — healthcare-foundation maps to charity for now
    regionCode: 'AU',
    brandCode: 'd2d',
  },
];

const USERS: DemoUser[] = [
  {
    id: 'usr_demo_brodie',
    email: 'brodie@door2digital.com',
    password: 'D2D-Demo-2026!',
    givenName: 'Brodie',
    familyName: 'Mitchell',
    role: 'super_admin',
    orgSlug: 'door2digital-platform',
  },
  {
    id: 'usr_demo_hf_manager',
    email: 'manager@hope-forward.com',
    password: 'Hope-Demo-2026!',
    givenName: 'Hope',
    familyName: 'Manager',
    role: 'org_admin',
    orgSlug: 'hope-forward',
  },
  {
    id: 'usr_demo_wv_manager',
    email: 'manager@world-vision.org.au',
    password: 'WV-Demo-2026!',
    givenName: 'World',
    familyName: 'Vision',
    role: 'org_admin',
    orgSlug: 'world-vision',
  },
  {
    id: 'usr_demo_pestmax_manager',
    email: 'manager@pestmax.com',
    password: 'Pest-Demo-2026!',
    givenName: 'Pest',
    familyName: 'Max',
    role: 'org_admin',
    orgSlug: 'pestmax',
  },
  {
    id: 'usr_demo_gch_manager',
    email: 'manager@goldcoasthospital.org.au',
    password: 'GCH-Demo-2026!',
    givenName: 'Gold',
    familyName: 'Coast',
    role: 'org_admin',
    orgSlug: 'gold-coast-hospital',
  },
];

async function upsertOrg(o: DemoOrg): Promise<void> {
  await prisma.org.upsert({
    where: { id: o.id },
    update: {
      legalName: o.legalName,
      tradingName: o.tradingName,
      vertical: o.vertical,
      brandCode: o.brandCode,
      // regionCode intentionally NOT updated — region is pinned.
    },
    create: {
      id: o.id,
      legalName: o.legalName,
      tradingName: o.tradingName,
      vertical: o.vertical,
      type: 'client',
      regionCode: o.regionCode,
      brandCode: o.brandCode,
      status: 'active',
    },
  });
  // Brand kit + billing — required side rows, idempotent.
  await prisma.brandKit.upsert({
    where: { orgId: o.id },
    update: {},
    create: {
      id: `brk_demo_${o.id.slice(9)}`,
      orgId: o.id,
      displayName: o.tradingName,
    },
  });
  await prisma.orgBilling.upsert({
    where: { orgId: o.id },
    update: {},
    create: {
      id: `bil_demo_${o.id.slice(9)}`,
      orgId: o.id,
      currency: o.regionCode === 'AU' ? 'AUD' : o.regionCode === 'SG' ? 'SGD' : 'USD',
    },
  });
}

async function upsertUser(u: DemoUser): Promise<void> {
  const searchKey = process.env.PII_SEARCH_KEY ?? 'dev-pii-search-key-must-be-at-least-32-chars';
  const digest = emailDigest(u.email, searchKey);

  const org = ORGS.find((o) => o.slug === u.orgSlug);
  if (!org) throw new Error(`Org not found for slug ${u.orgSlug}`);

  const passwordHash = await hashPassword(u.password);

  const userData: Prisma.UserUncheckedCreateInput = {
    id: u.id,
    orgId: org.id,
    email: u.email,
    emailDigest: digest,
    givenName: u.givenName,
    familyName: u.familyName,
    role: u.role,
    regionCode: org.regionCode,
    brandCode: org.brandCode,
    status: 'active',
  };

  await prisma.user.upsert({
    where: { id: u.id },
    update: {
      email: u.email,
      emailDigest: digest,
      role: u.role,
      orgId: org.id,
      regionCode: org.regionCode,
      brandCode: org.brandCode,
      status: 'active',
    },
    create: userData,
  });
  await prisma.userCredential.upsert({
    where: { userId: u.id },
    update: {
      passwordHash,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
    create: {
      userId: u.id,
      passwordHash,
    },
  });
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[seed-demo] Upserting orgs…');
  for (const o of ORGS) {
    await upsertOrg(o);
    // eslint-disable-next-line no-console
    console.log(`  org ${o.slug} (${o.regionCode}) → ${o.id}`);
  }
  // eslint-disable-next-line no-console
  console.log('[seed-demo] Upserting users…');
  for (const u of USERS) {
    await upsertUser(u);
    // eslint-disable-next-line no-console
    console.log(`  user ${u.email} (${u.role}) → ${u.id}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[seed-demo] OK — ${ORGS.length} orgs, ${USERS.length} users.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-demo] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
