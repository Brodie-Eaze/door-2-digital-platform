/**
 * /api/users — roster-fillable users for the operator console.
 *
 * GET  ?role=knocker  Returns every User with the requested PlatformRole for the
 *      org, mapped to { id, role, initials }.
 *
 * Names / initials: User.givenName and familyName are PII-vaulted ciphertext in
 * this schema. We DO NOT return plaintext names. Instead we derive stable
 * placeholder initials from the userId suffix (last 2 alpha chars, uppercased),
 * matching the placeholder pattern used by /api/fleet and /api/activity. Full
 * name resolution requires the Fastify PII vault service — integrate when JIT
 * unmask is wired into the operator console.
 *
 * All reads are tenant-scoped to session.orgId. Cross-tenant operators
 * (super_admin) may pass an explicit ?orgId= to target a sub-account.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Mirror the PlatformRole enum values we permit querying from the operator UI.
const roleEnum = z.enum([
  'super_admin',
  'org_admin',
  'manager',
  'knocker',
  'inside_sales',
  'accountant',
  'auditor',
  'viewer',
]);

/** Derive placeholder initials from a userId like "usr_01JXXXXXXXX". */
function userIdToInitials(userId: string): string {
  // Take the last 2 alpha chars of the ULID suffix as a stable placeholder.
  const suffix = userId.replace(/^[a-z]+_/, '');
  const alphas = suffix.replace(/[^A-Za-z]/g, '');
  return (alphas.slice(-2) || suffix.slice(-2) || '??').toUpperCase();
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Default to knocker — the roster fills knocker slots.
  const rawRole = req.nextUrl.searchParams.get('role') ?? 'knocker';
  const parsedRole = roleEnum.safeParse(rawRole);
  if (!parsedRole.success) {
    return validation(`Invalid role "${rawRole}"`);
  }
  const role = parsedRole.data;

  // Resolve org scope: cross-tenant ops can pass ?orgId= to target sub-accounts.
  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context — cannot load users');
  }

  try {
    const rows = await db.user.findMany({
      where: { orgId: targetOrgId, role, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true },
    });

    const users = rows.map((u) => ({
      id: u.id,
      role: u.role,
      initials: userIdToInitials(u.id),
    }));

    return ok({ users, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/users GET] failed:', err);
    return internal('Failed to load users');
  }
}
