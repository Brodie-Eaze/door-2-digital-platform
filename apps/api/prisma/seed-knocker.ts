/**
 * seed-knocker.ts — adds one field knocker the mobile app can log in as.
 *
 * The demo seed (seed-demo.ts) only creates super_admin / org_admin users for
 * the web consoles. The Knocker iOS app pre-fills `knocker@d2d.io`, so this
 * script creates that user (role `knocker`) under the US `door2digital-platform`
 * org. Mirrors seed-demo's upsertUser exactly.
 *
 * The password is supplied at runtime via KNOCKER_SEED_PASSWORD (never on disk):
 *   KNOCKER_SEED_PASSWORD='...' pnpm tsx prisma/seed-knocker.ts
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { emailDigest } from '@d2d/shared-utils';
import { hashPassword } from '../src/domains/auth/password';

const prisma = new PrismaClient();

const EMAIL = 'knocker@d2d.io';
const USER_ID = 'usr_demo_knocker_01';
const ORG_SLUG = 'door2digital-platform';

async function main(): Promise<void> {
  const password = process.env.KNOCKER_SEED_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set KNOCKER_SEED_PASSWORD (>=8 chars) to seed the knocker.');
  }
  const searchKey = process.env.PII_SEARCH_KEY ?? 'dev-pii-search-key-must-be-at-least-32-chars';
  const digest = emailDigest(EMAIL, searchKey);

  const org = await prisma.org.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`Org not found for slug ${ORG_SLUG}`);

  const passwordHash = await hashPassword(password);

  const userData: Prisma.UserUncheckedCreateInput = {
    id: USER_ID,
    orgId: org.id,
    email: EMAIL,
    emailDigest: digest,
    givenName: 'Demo',
    familyName: 'Knocker',
    role: 'knocker',
    regionCode: org.regionCode,
    brandCode: org.brandCode,
    status: 'active',
  };

  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {
      email: EMAIL,
      emailDigest: digest,
      role: 'knocker',
      orgId: org.id,
      regionCode: org.regionCode,
      brandCode: org.brandCode,
      status: 'active',
    },
    create: userData,
  });

  await prisma.userCredential.upsert({
    where: { userId: USER_ID },
    update: { passwordHash, inviteTokenHash: null, inviteExpiresAt: null },
    create: { userId: USER_ID, passwordHash },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded knocker: ${EMAIL} (org=${org.slug}, role=knocker)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
