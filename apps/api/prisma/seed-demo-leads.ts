/**
 * Demo-lead seed — idempotent. Adds ~12 leads per demo org so the
 * web-operator `/accounts/[slug]/leads` route returns real Lead rows
 * scoped per tenant, with mixed statuses + a few converted ones.
 *
 * Run independently of seed-demo.ts so the user/org seed can run on a
 * separate cadence. Safe to re-run: rows are upserted by deterministic
 * `lead_demo_<slug>_<n>` IDs.
 *
 * Usage:
 *   pnpm tsx prisma/seed-demo-leads.ts
 */
import { PrismaClient } from '@prisma/client';
import type { LeadStatus, RegionCode, Vertical } from '@prisma/client';
import { emailDigest } from '@d2d/shared-utils';

const prisma = new PrismaClient();

const SEARCH_KEY = process.env.PII_SEARCH_KEY ?? 'dev-pii-search-key-must-be-at-least-32-chars';

interface DemoLead {
  givenName: string;
  familyName: string;
  emailLocal: string;
  emailDomain: string;
  phone: string;
  status: LeadStatus;
  daysAgo: number;
  addressStreet?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressPostcode?: string;
}

const NAMES: DemoLead[] = [
  {
    givenName: 'Maria',
    familyName: 'Santos',
    emailLocal: 'maria.santos',
    emailDomain: 'gmail.com',
    phone: '+15125550142',
    status: 'qualified',
    daysAgo: 0,
    addressStreet: '4827 Cedar Brook Ln',
    addressLocality: 'Austin',
    addressRegion: 'TX',
    addressPostcode: '78723',
  },
  {
    givenName: 'James',
    familyName: 'Okafor',
    emailLocal: 'james.okafor',
    emailDomain: 'outlook.com',
    phone: '+15125550218',
    status: 'contacted',
    daysAgo: 0,
  },
  {
    givenName: 'Priya',
    familyName: 'Patel',
    emailLocal: 'priya.patel',
    emailDomain: 'yahoo.com',
    phone: '+15125550306',
    status: 'new',
    daysAgo: 1,
  },
  {
    givenName: 'Daniel',
    familyName: 'Kim',
    emailLocal: 'daniel.kim',
    emailDomain: 'gmail.com',
    phone: '+15125550411',
    status: 'appointment_set',
    daysAgo: 1,
  },
  {
    givenName: 'Sofia',
    familyName: 'Hernandez',
    emailLocal: 's.hernandez',
    emailDomain: 'hotmail.com',
    phone: '+15125550503',
    status: 'converted',
    daysAgo: 2,
  },
  {
    givenName: 'Liam',
    familyName: 'Carter',
    emailLocal: 'liam.carter',
    emailDomain: 'icloud.com',
    phone: '+15125550619',
    status: 'qualified',
    daysAgo: 2,
  },
  {
    givenName: 'Aisha',
    familyName: 'Mohamed',
    emailLocal: 'aisha.m',
    emailDomain: 'protonmail.com',
    phone: '+15125550728',
    status: 'contacted',
    daysAgo: 3,
  },
  {
    givenName: 'Ethan',
    familyName: 'Rivera',
    emailLocal: 'ethan.rivera',
    emailDomain: 'gmail.com',
    phone: '+15125550834',
    status: 'lost',
    daysAgo: 4,
  },
  {
    givenName: 'Nora',
    familyName: 'Andersen',
    emailLocal: 'nora.a',
    emailDomain: 'outlook.com',
    phone: '+15125550911',
    status: 'new',
    daysAgo: 5,
  },
  {
    givenName: 'Marcus',
    familyName: 'Webb',
    emailLocal: 'marcus.webb',
    emailDomain: 'gmail.com',
    phone: '+15125551027',
    status: 'qualified',
    daysAgo: 5,
  },
  {
    givenName: 'Elena',
    familyName: 'Vasquez',
    emailLocal: 'elena.v',
    emailDomain: 'yahoo.com',
    phone: '+15125551142',
    status: 'converted',
    daysAgo: 6,
  },
  {
    givenName: 'Tobias',
    familyName: 'Larsen',
    emailLocal: 'tobias.larsen',
    emailDomain: 'hotmail.com',
    phone: '+15125551256',
    status: 'contacted',
    daysAgo: 7,
  },
];

interface DemoOrg {
  id: string;
  slug: string;
  regionCode: RegionCode;
  vertical: Vertical;
}

async function loadDemoOrgs(): Promise<DemoOrg[]> {
  const orgs = await prisma.org.findMany({
    where: { id: { startsWith: 'org_demo_' }, slug: { not: null } },
    select: { id: true, slug: true, regionCode: true, vertical: true },
  });
  return orgs
    .filter((o): o is DemoOrg => o.slug !== null && o.id !== 'org_demo_platform')
    .map((o) => ({
      id: o.id,
      slug: o.slug as string,
      regionCode: o.regionCode,
      vertical: o.vertical,
    }));
}

async function seedLeadsForOrg(org: DemoOrg): Promise<number> {
  let count = 0;
  for (let i = 0; i < NAMES.length; i += 1) {
    const tpl = NAMES[i];
    if (!tpl) continue;
    const id = `lead_demo_${org.slug.replace(/-/g, '_')}_${i.toString().padStart(2, '0')}`;
    const email = `${tpl.emailLocal}@${tpl.emailDomain}`;
    const created = new Date(Date.now() - tpl.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.lead.upsert({
      where: { id },
      update: {
        // Allow re-runs to update status / email digest etc; keep createdAt stable.
        status: tpl.status,
        email,
        emailDigest: emailDigest(email, SEARCH_KEY),
        phone: tpl.phone,
        givenName: tpl.givenName,
        familyName: tpl.familyName,
      },
      create: {
        id,
        orgId: org.id,
        regionCode: org.regionCode,
        brandCode: 'd2d',
        vertical: org.vertical,
        status: tpl.status,
        givenName: tpl.givenName,
        familyName: tpl.familyName,
        email,
        emailDigest: emailDigest(email, SEARCH_KEY),
        phone: tpl.phone,
        createdAt: created,
        updatedAt: created,
      },
    });
    count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  const orgs = await loadDemoOrgs();
  // eslint-disable-next-line no-console
  console.log(`[seed-demo-leads] ${orgs.length} demo orgs found`);
  for (const o of orgs) {
    const n = await seedLeadsForOrg(o);
    // eslint-disable-next-line no-console
    console.log(`  ${o.slug} (${o.id}) → ${n} leads`);
  }
  // eslint-disable-next-line no-console
  console.log('[seed-demo-leads] OK');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-demo-leads] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
