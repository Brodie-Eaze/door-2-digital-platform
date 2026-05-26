/**
 * Securely read one of a known set of security docs from `docs/` and return
 * its raw markdown text.
 *
 * The allowlist is hardcoded so a path-traversal attempt (`../../etc/passwd`)
 * is impossible by construction — the slug maps to a fixed filename, not a
 * user-provided path. Phase 1.4 will replace this with proper MDX rendering
 * inside the security review page; today we just serve the raw markdown so
 * the link goes somewhere honest instead of nowhere.
 *
 * The repo root is resolved at runtime via `process.cwd()` which Next.js
 * sets to the app directory in dev and the project root in prod build.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SecurityDocSlug = 'review' | 'pen-test-readiness' | 'code-audit' | 'region-pinning';

interface SecurityDocMeta {
  title: string;
  description: string;
  /** Relative path from the repo root. */
  path: string;
  /** Link back from doc viewer to a related page. */
  backHref: string;
  backLabel: string;
}

const DOCS: Record<SecurityDocSlug, SecurityDocMeta> = {
  review: {
    title: 'Security review',
    description: 'Honest pen-test-readiness audit of the operator surface.',
    path: 'docs/SECURITY-REVIEW.md',
    backHref: '/public/security',
    backLabel: 'Back to Security',
  },
  'pen-test-readiness': {
    title: 'Pen-test readiness checklist',
    description: '20-item checklist tracked across releases.',
    path: 'docs/PEN_TEST_READINESS.md',
    backHref: '/public/security',
    backLabel: 'Back to Security',
  },
  'code-audit': {
    title: 'Code audit',
    description: 'Static review of the operator surface.',
    path: 'docs/CODE-AUDIT.md',
    backHref: '/public/security',
    backLabel: 'Back to Security',
  },
  'region-pinning': {
    title: 'ADR-0016 · Region pinning',
    description: 'Multi-region data residency — pinned at org creation, immutable.',
    path: 'docs/adr/0016-region-pinning.md',
    backHref: '/public/security',
    backLabel: 'Back to Security',
  },
};

export function getSecurityDocMeta(slug: SecurityDocSlug): SecurityDocMeta {
  return DOCS[slug];
}

/**
 * Read a security doc by slug. Returns null when:
 *   - the file isn't in the deployed build (e.g. docs/ wasn't copied)
 * The caller (a Next.js page) renders a graceful fallback in that case.
 *
 * We try a couple of cwd-relative paths so the same code works in:
 *   - dev:  cwd is `apps/web-operator/`
 *   - prod: cwd may be the monorepo root or the app dir depending on host
 */
export async function readSecurityDoc(slug: SecurityDocSlug): Promise<string | null> {
  const meta = DOCS[slug];
  const candidates = [
    join(process.cwd(), meta.path),
    join(process.cwd(), '..', '..', meta.path),
    join(process.cwd(), '..', meta.path),
  ];
  for (const candidate of candidates) {
    try {
      const txt = await readFile(candidate, 'utf-8');
      return txt;
    } catch {
      // try next candidate
    }
  }
  return null;
}
