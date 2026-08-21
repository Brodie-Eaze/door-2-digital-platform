/**
 * seed-tenants.ts — two real tenants to prove multi-tenant Knocker iOS.
 *
 *   Tenant A: "Hope Forward" (charity)    — manager + knocker + territory + 3 giving tiers + shift
 *   Tenant B: "PestPro"      (commercial) — manager + knocker + territory + 2 plans      + shift
 *
 * Each knocker logs into Knocker iOS scoped to THEIR org and should see ONLY
 * their org's territory / catalog / shifts. Run:
 *   TENANT_SEED_PASSWORD='<your-dev-password>' pnpm tsx prisma/seed-tenants.ts
 *
 * Idempotent (fixed ids + upserts). Bypasses the manager-invite UI to create
 * the data directly — the invite flow itself is exercised separately via the
 * live POST /v1/users → accept-invite path.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { emailDigest } from '@d2d/shared-utils';
import { hashPassword } from '../src/domains/auth/password';

const prisma = new PrismaClient();
const SEARCH_KEY = process.env.PII_SEARCH_KEY ?? 'dev-pii-search-key-must-be-at-least-32-chars';

interface TenantSpec {
  orgId: string;
  slug: string;
  legalName: string;
  tradingName: string;
  vertical: 'charity' | 'commercial';
  managerId: string;
  managerEmail: string;
  knockerId: string;
  knockerEmail: string;
  knockerGiven: string;
  knockerFamily: string;
  territoryId: string;
  territoryName: string;
  polygonWkt: string; // POLYGON((lng lat, …)) closed ring
  centroid: string; // "lng lat"
  offerings: Array<{
    id: string;
    name: string;
    blurb: string;
    amountCents: number;
    frequency: 'monthly' | 'weekly' | 'once';
    highlighted: boolean;
    sortOrder: number;
  }>;
}

const TENANTS: TenantSpec[] = [
  {
    orgId: 'org_demo_hope_forward',
    slug: 'hope-forward',
    legalName: 'Hope Forward International Inc.',
    tradingName: 'Hope Forward',
    vertical: 'charity',
    managerId: 'usr_demo_mgr_hope',
    managerEmail: 'mgr-hope@d2d.io',
    knockerId: 'usr_demo_rep_hope',
    knockerEmail: 'rep-hope@d2d.io',
    knockerGiven: 'Hannah',
    knockerFamily: 'Reyes',
    territoryId: 'ter_demo_hope_cherrywood',
    territoryName: 'Cherrywood East',
    // small quad in East Austin (lng lat)
    polygonWkt:
      'POLYGON((-97.7205 30.2870, -97.7095 30.2870, -97.7095 30.2785, -97.7205 30.2785, -97.7205 30.2870))',
    centroid: '-97.7150 30.2828',
    offerings: [
      {
        id: 'svo_hope_20',
        name: 'Hope Monthly',
        blurb: 'Feeds a child for a month',
        amountCents: 2000,
        frequency: 'monthly',
        highlighted: false,
        sortOrder: 1,
      },
      {
        id: 'svo_hope_40',
        name: 'Hope Plus',
        blurb: 'Clean water for a family',
        amountCents: 4000,
        frequency: 'monthly',
        highlighted: true,
        sortOrder: 2,
      },
      {
        id: 'svo_hope_once',
        name: 'One-off Gift',
        blurb: 'A single donation today',
        amountCents: 10000,
        frequency: 'once',
        highlighted: false,
        sortOrder: 3,
      },
    ],
  },
  {
    orgId: 'org_demo_pestmax',
    slug: 'pestmax',
    legalName: 'PestMax Services LLC',
    tradingName: 'PestMax',
    vertical: 'commercial',
    managerId: 'usr_demo_mgr_pest',
    managerEmail: 'mgr-pest@d2d.io',
    knockerId: 'usr_demo_rep_pest',
    knockerEmail: 'rep-pest@d2d.io',
    knockerGiven: 'Marcus',
    knockerFamily: 'Webb',
    territoryId: 'ter_demo_pest_lakewood',
    territoryName: 'Lakewood Heights',
    // small quad in Dallas (lng lat) — visibly different from Austin
    polygonWkt:
      'POLYGON((-96.7350 32.8200, -96.7240 32.8200, -96.7240 32.8120, -96.7350 32.8120, -96.7350 32.8200))',
    centroid: '-96.7295 32.8160',
    offerings: [
      {
        id: 'svo_pest_mo',
        name: 'Home Shield Monthly',
        blurb: 'Year-round pest protection',
        amountCents: 4900,
        frequency: 'monthly',
        highlighted: true,
        sortOrder: 1,
      },
      {
        id: 'svo_pest_qtr',
        name: 'Quarterly Service',
        blurb: 'Four treatments a year',
        amountCents: 12900,
        frequency: 'once',
        highlighted: false,
        sortOrder: 2,
      },
    ],
  },
];

/** Monday (UTC) of the week containing 2026-06-14, matching the roster contract. */
const WEEK_START = '2026-06-08';

function initials(given: string, family: string): string {
  return (given.charAt(0) + family.charAt(0)).toUpperCase();
}

async function upsertUser(
  id: string,
  orgId: string,
  email: string,
  given: string,
  family: string,
  role: 'manager' | 'knocker',
  regionCode: Prisma.UserUncheckedCreateInput['regionCode'],
  brandCode: string,
  passwordHash: string,
): Promise<void> {
  const digest = emailDigest(email, SEARCH_KEY);
  const data: Prisma.UserUncheckedCreateInput = {
    id,
    orgId,
    email,
    emailDigest: digest,
    givenName: given,
    familyName: family,
    role,
    regionCode,
    brandCode,
    status: 'active',
  };
  await prisma.user.upsert({
    where: { id },
    update: { email, emailDigest: digest, role, orgId, regionCode, brandCode, status: 'active' },
    create: data,
  });
  await prisma.userCredential.upsert({
    where: { userId: id },
    update: { passwordHash, inviteTokenHash: null, inviteExpiresAt: null },
    create: { userId: id, passwordHash },
  });
}

async function main(): Promise<void> {
  const password = process.env.TENANT_SEED_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set TENANT_SEED_PASSWORD (>=8 chars).');
  }
  const passwordHash = await hashPassword(password);

  for (const t of TENANTS) {
    // Org
    await prisma.org.upsert({
      where: { id: t.orgId },
      update: { slug: t.slug, tradingName: t.tradingName, vertical: t.vertical, status: 'active' },
      create: {
        id: t.orgId,
        slug: t.slug,
        legalName: t.legalName,
        tradingName: t.tradingName,
        vertical: t.vertical,
        type: 'client',
        regionCode: 'US',
        brandCode: 'd2d',
        status: 'active',
      },
    });

    // Manager + knocker
    await upsertUser(
      t.managerId,
      t.orgId,
      t.managerEmail,
      'Morgan',
      'Lee',
      'manager',
      'US',
      'd2d',
      passwordHash,
    );
    await upsertUser(
      t.knockerId,
      t.orgId,
      t.knockerEmail,
      t.knockerGiven,
      t.knockerFamily,
      'knocker',
      'US',
      'd2d',
      passwordHash,
    );

    // Territory + assignment
    await prisma.territory.upsert({
      where: { id: t.territoryId },
      update: {
        name: t.territoryName,
        polygon: t.polygonWkt,
        centroid: t.centroid,
        status: 'active',
      },
      create: {
        id: t.territoryId,
        orgId: t.orgId,
        regionCode: 'US',
        brandCode: 'd2d',
        name: t.territoryName,
        vertical: t.vertical,
        polygon: t.polygonWkt,
        centroid: t.centroid,
        status: 'active',
      },
    });
    const assignmentId = `tas_demo_${t.knockerId}`;
    await prisma.territoryAssignment.upsert({
      where: { id: assignmentId },
      update: { expiresAt: null },
      create: { id: assignmentId, territoryId: t.territoryId, userId: t.knockerId },
    });

    // Catalog
    for (const o of t.offerings) {
      await prisma.serviceOffering.upsert({
        where: { id: o.id },
        update: {
          name: o.name,
          blurb: o.blurb,
          amountCents: BigInt(o.amountCents),
          frequency: o.frequency,
          highlighted: o.highlighted,
          active: true,
          sortOrder: o.sortOrder,
        },
        create: {
          id: o.id,
          orgId: t.orgId,
          regionCode: 'US',
          brandCode: 'd2d',
          name: o.name,
          blurb: o.blurb,
          amountCents: BigInt(o.amountCents),
          frequency: o.frequency,
          vertical: t.vertical,
          highlighted: o.highlighted,
          active: true,
          sortOrder: o.sortOrder,
        },
      });
    }

    // Two shifts this week assigned to the knocker (Sat day=5, Sun day=6 = today)
    for (const day of [5, 6]) {
      const shiftId = `ksft_demo_${t.knockerId}_${day}`;
      await prisma.knockerShift.upsert({
        where: { id: shiftId },
        update: {
          userId: t.knockerId,
          territoryId: t.territoryId,
          territory: t.territoryName,
          status: 'scheduled',
        },
        create: {
          id: shiftId,
          orgId: t.orgId,
          weekStart: WEEK_START,
          repInitials: initials(t.knockerGiven, t.knockerFamily),
          repName: `${t.knockerGiven} ${t.knockerFamily}`,
          account: t.tradingName,
          day,
          start: '09:00',
          end: '17:00',
          territory: t.territoryName,
          lunch: '12:30-13:00',
          userId: t.knockerId,
          territoryId: t.territoryId,
          status: 'scheduled',
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `Seeded tenant ${t.tradingName} (${t.vertical}): knocker ${t.knockerEmail}, territory ${t.territoryName}, ${t.offerings.length} offerings, 2 shifts`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
