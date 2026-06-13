/**
 * /api/marketing/generate — BFF proxy for creative generation.
 *
 * POST  Forwards the generation brief to the Fastify API at
 *       NEXT_PUBLIC_API_URL/v1/marketing/creatives/generate, attaching the
 *       session cookie so the Fastify service can authenticate the caller.
 *
 * The Fastify marketing service dispatches to provider adapters (Claude for
 * copy, FLUX for images, Runway for video), persists a ContentGenerationJob,
 * and returns either a sync result (< 10s) or an async jobId.
 *
 * The BFF layer exists so the browser never calls the Fastify service directly
 * (CORS, auth cookie forwarding, request enrichment).
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { forbidden, internal, ok, requireSession, validation } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const generateSchema = z.object({
  vertical: z.enum(['charity', 'commercial']),
  region: z.enum(['US', 'AU', 'SG']),
  audience: z.string().min(1).max(500),
  headlineGoal: z.string().min(1).max(300),
  channel: z.enum(['Meta', 'Google', 'TikTok', 'meta', 'google', 'tiktok', 'email', 'sms']),
  format: z.enum(['image', 'carousel', 'video', 'text']),
  brandKit: z.string().optional(),
  orgId: z.string().optional(),
  // Account-scoped generation passes themes.
  themes: z.array(z.string()).optional(),
  variantCount: z.number().int().min(1).max(20).default(8),
});

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  if (!session.orgId && !['super_admin', 'platform_admin'].includes(session.role ?? '')) {
    return forbidden('No org context for marketing generation');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = generateSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid generation brief', parsed.error.flatten());
  }
  const brief = parsed.data;

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    // Fastify API not configured — return a descriptive error so it's obvious
    // in dev/prod what's missing. Never silently fake it.
    console.error('[api/marketing/generate] NEXT_PUBLIC_API_URL is not set');
    return internal('Marketing API URL not configured (set NEXT_PUBLIC_API_URL)');
  }

  const targetUrl = `${apiBase}/v1/marketing/creatives/generate`;

  // Forward the session cookie so Fastify can authenticate the caller.
  const cookie = req.headers.get('cookie') ?? '';

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
        // Propagate correlation id if present.
        ...(req.headers.get('x-correlation-id')
          ? { 'x-correlation-id': req.headers.get('x-correlation-id')! }
          : {}),
      },
      body: JSON.stringify({
        ...brief,
        orgId: brief.orgId ?? session.orgId,
        requestedByUserId: session.userId,
      }),
    });

    const contentType = upstream.headers.get('content-type') ?? '';

    if (!upstream.ok) {
      const body = contentType.includes('json')
        ? await upstream.json()
        : { detail: await upstream.text() };
      return new Response(JSON.stringify(body), {
        status: upstream.status,
        headers: { 'content-type': 'application/problem+json' },
      });
    }

    const result = contentType.includes('json') ? await upstream.json() : await upstream.text();
    return ok(result as Record<string, unknown>);
  } catch (err) {
    console.error('[api/marketing/generate POST] upstream fetch failed:', err);
    return internal('Marketing generation service unavailable');
  }
}
