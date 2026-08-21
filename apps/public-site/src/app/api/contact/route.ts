import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

/**
 * Public contact intake for the marketing site.
 *
 * Self-contained on purpose: this route validates manually (no new deps), is
 * PII-conscious in what it logs, and returns RFC 7807 Problem Details on bad
 * input — matching the platform-wide error contract. In production this hands
 * the validated payload to the notification / CRM intake; here it records a
 * redacted server-side trail so the form is genuinely wired, not a no-op.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROBLEM_BASE = 'https://docs.door2digital.io/problems';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERTICALS = new Set(['', 'charity', 'commercial', 'both', 'other']);

type ContactPayload = {
  name: string;
  email: string;
  organization: string;
  vertical: string;
  message: string;
  website: string; // honeypot
};

function problem(status: number, slug: string, title: string, detail: string): NextResponse {
  return NextResponse.json(
    { type: `${PROBLEM_BASE}/${slug}`, title, status, detail },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: Partial<ContactPayload>;
  try {
    body = (await req.json()) as Partial<ContactPayload>;
  } catch {
    return problem(
      400,
      'invalid-json',
      'Invalid request body',
      'The request body must be valid JSON.',
    );
  }

  const payload: ContactPayload = {
    name: asString(body.name),
    email: asString(body.email),
    organization: asString(body.organization),
    vertical: asString(body.vertical),
    message: asString(body.message),
    website: asString(body.website),
  };

  // Honeypot: a real user never fills this. Accept silently so bots can't probe.
  if (payload.website.length > 0) {
    return NextResponse.json({ ok: true, id: randomUUID() }, { status: 200 });
  }

  // Validation — mirror the platform's fail-closed posture.
  if (payload.name.length === 0 || payload.name.length > 200) {
    return problem(
      400,
      'validation',
      'Name required',
      'Please provide your name (under 200 characters).',
    );
  }
  if (!EMAIL_RE.test(payload.email) || payload.email.length > 320) {
    return problem(
      400,
      'validation',
      'Valid email required',
      'Please provide a valid work email address.',
    );
  }
  if (payload.organization.length > 200) {
    return problem(
      400,
      'validation',
      'Organization too long',
      'Organization must be under 200 characters.',
    );
  }
  if (!VERTICALS.has(payload.vertical)) {
    return problem(400, 'validation', 'Unknown vertical', 'Please choose a valid vertical option.');
  }
  if (payload.message.length === 0 || payload.message.length > 5000) {
    return problem(
      400,
      'validation',
      'Message required',
      'Please tell us a little about your program (under 5000 characters).',
    );
  }

  const id = randomUUID();

  // PII-conscious trail: log a redacted summary only — never the full message
  // or the raw email. The full validated payload is what a downstream intake
  // would receive; the marketing surface itself keeps no plaintext PII.
  const emailDomain = payload.email.slice(payload.email.indexOf('@') + 1);
  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify({
      event: 'contact.received',
      id,
      emailDomain,
      vertical: payload.vertical || 'unspecified',
      hasOrganization: payload.organization.length > 0,
      messageChars: payload.message.length,
      at: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true, id }, { status: 200 });
}

export function GET(): NextResponse {
  return problem(
    405,
    'method-not-allowed',
    'Method not allowed',
    'Use POST to submit the contact form.',
  );
}
