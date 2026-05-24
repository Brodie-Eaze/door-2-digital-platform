import Link from 'next/link';
import {
  Code2,
  KeyRound,
  Webhook,
  Download,
  ArrowRight,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'API Docs — Door 2 Digital',
  description:
    'REST API for knocks, leads, conversions, donations, sales, commissions, payouts, and webhooks. OpenAPI 3.1 spec.',
};

interface Endpoint {
  group: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  desc: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    group: 'Auth',
    method: 'POST',
    path: '/v1/auth/token',
    desc: 'Exchange API key for short-lived JWT',
  },
  { group: 'Auth', method: 'POST', path: '/v1/auth/refresh', desc: 'Refresh JWT before expiry' },
  { group: 'Orgs', method: 'GET', path: '/v1/orgs', desc: 'List orgs the principal can access' },
  { group: 'Orgs', method: 'GET', path: '/v1/orgs/{id}', desc: 'Fetch a single org' },
  { group: 'Territories', method: 'GET', path: '/v1/territories', desc: 'List territories' },
  {
    group: 'Territories',
    method: 'POST',
    path: '/v1/territories',
    desc: 'Create a territory polygon',
  },
  { group: 'Knocks', method: 'POST', path: '/v1/knocks', desc: 'Log a knock event from a knocker' },
  {
    group: 'Knocks',
    method: 'GET',
    path: '/v1/knocks',
    desc: 'Query knocks (filter by territory, knocker, time)',
  },
  {
    group: 'Leads',
    method: 'POST',
    path: '/v1/leads',
    desc: 'Create a lead from a knock conversation',
  },
  { group: 'Leads', method: 'PATCH', path: '/v1/leads/{id}', desc: 'Update lead stage / notes' },
  {
    group: 'Conversions',
    method: 'POST',
    path: '/v1/conversions',
    desc: 'Convert a lead — fires commission engine',
  },
  {
    group: 'Donations',
    method: 'POST',
    path: '/v1/donations',
    desc: 'Record a donor commitment + recurring schedule',
  },
  { group: 'Sales', method: 'POST', path: '/v1/sales', desc: 'Record a sale transaction' },
  {
    group: 'Commissions',
    method: 'GET',
    path: '/v1/commissions',
    desc: 'List commission accruals',
  },
  {
    group: 'Commissions',
    method: 'GET',
    path: '/v1/commissions/{id}',
    desc: 'Fetch a commission with audit trail',
  },
  {
    group: 'Payouts',
    method: 'POST',
    path: '/v1/payouts/release',
    desc: 'Release a payout batch (admin)',
  },
  {
    group: 'Payouts',
    method: 'GET',
    path: '/v1/payouts/{id}',
    desc: 'Fetch payout state + processor ref',
  },
  {
    group: 'Webhooks',
    method: 'GET',
    path: '/v1/webhooks',
    desc: 'List configured webhook endpoints',
  },
  { group: 'Webhooks', method: 'POST', path: '/v1/webhooks', desc: 'Register a webhook endpoint' },
  {
    group: 'Webhooks',
    method: 'POST',
    path: '/v1/webhooks/{id}/test',
    desc: 'Send a signed test event',
  },
];

function MethodPill({ method }: { method: Endpoint['method'] }): JSX.Element {
  const cls =
    method === 'GET'
      ? 'pill pill-info'
      : method === 'POST'
        ? 'pill pill-success'
        : method === 'PATCH'
          ? 'pill pill-warn'
          : 'pill pill-danger';
  return <span className={`${cls} mono-method`}>{method}</span>;
}

function CodeBlock({ title, code }: { title: string; code: string }): JSX.Element {
  return (
    <div className="card overflow-hidden bg-ink">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-heroLine">
        <div className="flex items-center gap-2 text-[11.5px] text-soft font-medium">
          <Terminal className="h-3.5 w-3.5" />
          {title}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-soft/30"></span>
          <span className="h-2.5 w-2.5 rounded-full bg-soft/30"></span>
          <span className="h-2.5 w-2.5 rounded-full bg-soft/30"></span>
        </div>
      </div>
      <pre className="p-5 text-[12.5px] text-surface font-mono leading-relaxed overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function PublicDocsPage(): JSX.Element {
  // Group endpoints
  const grouped = ENDPOINTS.reduce<Record<string, Endpoint[]>>((acc, e) => {
    const bucket = acc[e.group] ?? [];
    bucket.push(e);
    acc[e.group] = bucket;
    return acc;
  }, {});

  return (
    <PublicShell activeNav="docs">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              API Docs · v1
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              REST API. Every door, every dollar, every event.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              JSON over HTTPS. Auth via short-lived JWTs. Webhooks signed with HMAC-SHA-256. Spec is
              OpenAPI 3.1 — generate clients in any language.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#quickstart"
                className="inline-flex items-center gap-2 bg-ink text-surface text-[13px] font-semibold px-4 py-2.5 rounded-md hover:bg-ink2 transition"
              >
                Quickstart <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="#openapi"
                className="inline-flex items-center gap-2 bg-surface text-ink text-[13px] font-medium px-4 py-2.5 rounded-md border border-line hover:bg-paper transition"
              >
                <Download className="h-3.5 w-3.5" /> OpenAPI 3.1 spec
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* BASICS GRID */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card card-pad p-6 flex flex-col gap-3">
            <div className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accentSoft text-accent">
              <Code2 className="h-4 w-4" />
            </div>
            <h4 className="text-[15px] font-semibold text-ink tracking-tight">Base URL</h4>
            <code className="text-[12.5px] font-mono bg-paper px-3 py-2 rounded border border-line2 text-ink">
              https://api.door2digital.io/v1
            </code>
            <p className="text-[12.5px] text-muted">
              Region-aware: <span className="font-mono">.us</span>,{' '}
              <span className="font-mono">.au</span>, <span className="font-mono">.sg</span>{' '}
              subdomains route to the right residency.
            </p>
          </div>
          <div className="card card-pad p-6 flex flex-col gap-3">
            <div className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accentSoft text-accent">
              <KeyRound className="h-4 w-4" />
            </div>
            <h4 className="text-[15px] font-semibold text-ink tracking-tight">Auth</h4>
            <code className="text-[12.5px] font-mono bg-paper px-3 py-2 rounded border border-line2 text-ink">
              Authorization: Bearer &lt;jwt&gt;
            </code>
            <p className="text-[12.5px] text-muted">
              Exchange API key for a 15-minute JWT. Refresh tokens valid 30 days. IP-restricted by
              policy.
            </p>
          </div>
          <div className="card card-pad p-6 flex flex-col gap-3">
            <div className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accentSoft text-accent">
              <Webhook className="h-4 w-4" />
            </div>
            <h4 className="text-[15px] font-semibold text-ink tracking-tight">Webhooks</h4>
            <code className="text-[12.5px] font-mono bg-paper px-3 py-2 rounded border border-line2 text-ink">
              X-D2D-Signature: t=...,v1=...
            </code>
            <p className="text-[12.5px] text-muted">
              HMAC-SHA-256 over timestamp + body. Rotate secret anytime via the webhook registration
              endpoint.
            </p>
          </div>
        </div>
      </section>

      {/* QUICKSTART */}
      <section
        id="quickstart"
        className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16 scroll-mt-20"
      >
        <div className="max-w-2xl mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Quickstart
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">
            From zero to first conversion in three calls.
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-[14px] font-semibold text-ink mb-3">1. Authenticate</h4>
            <CodeBlock
              title="curl · POST /v1/auth/token"
              code={`curl -X POST https://api.door2digital.io/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "d2d_live_xxxxxxxxxxxxxxxx",
    "scope": "knocks:write conversions:write"
  }'

# Response:
# {
#   "access_token": "eyJhbGc...",
#   "expires_in": 900,
#   "refresh_token": "rft_..."
# }`}
            />
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-ink mb-3">2. Log a knock</h4>
            <CodeBlock
              title="curl · POST /v1/knocks"
              code={`curl -X POST https://api.door2digital.io/v1/knocks \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "territory_id": "ter_01H...",
    "knocker_id": "knk_01H...",
    "lat": 33.7490,
    "lng": -84.3880,
    "outcome": "no_answer",
    "captured_at": "2026-05-24T17:32:11Z"
  }'

# 201 Created
# { "id": "knk_evt_01H...", ... }`}
            />
          </div>
          <div className="lg:col-span-2">
            <h4 className="text-[14px] font-semibold text-ink mb-3">3. Record a conversion</h4>
            <CodeBlock
              title="curl · POST /v1/conversions"
              code={`curl -X POST https://api.door2digital.io/v1/conversions \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_id": "led_01H...",
    "bucket": "door",
    "amount_cents": 12500,
    "currency": "USD",
    "knocker_id": "knk_01H...",
    "occurred_at": "2026-05-24T17:48:02Z"
  }'

# 201 Created
# {
#   "id": "cnv_01H...",
#   "commission": { "knocker_cents": 1875, "house_cents": 10625, "bucket": "door" },
#   "audit_ref": "aud_01H..."
# }`}
            />
          </div>
        </div>
      </section>

      {/* ENDPOINT TABLE */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Endpoints
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">v1 surface area.</h3>
        </div>

        <div className="space-y-8">
          {Object.entries(grouped).map(([group, eps]) => (
            <div key={group}>
              <h4 className="text-[12px] uppercase tracking-[0.12em] text-muted font-semibold mb-3">
                {group}
              </h4>
              <div className="card overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {eps.map((e) => (
                      <tr
                        key={`${e.method}-${e.path}`}
                        className="border-b border-line2 last:border-b-0"
                      >
                        <td className="px-5 py-3 w-20">
                          <MethodPill method={e.method} />
                        </td>
                        <td className="px-5 py-3 font-mono text-[12.5px] text-ink whitespace-nowrap">
                          {e.path}
                        </td>
                        <td className="px-5 py-3 text-[13px] text-muted">{e.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WEBHOOK SIGNATURE */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <div className="card card-pad p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold text-ink tracking-tight">
                Verifying webhook signatures
              </h3>
              <p className="mt-3 text-[14px] text-muted leading-relaxed">
                Every webhook delivery carries an{' '}
                <code className="text-[12.5px] font-mono bg-paper px-1.5 py-0.5 rounded">
                  X-D2D-Signature
                </code>{' '}
                header. The format is{' '}
                <code className="text-[12.5px] font-mono bg-paper px-1.5 py-0.5 rounded">
                  t=&lt;unix_timestamp&gt;,v1=&lt;hmac-sha-256&gt;
                </code>
                . Compute the HMAC over{' '}
                <code className="text-[12.5px] font-mono bg-paper px-1.5 py-0.5 rounded">
                  t + &quot;.&quot; + body
                </code>{' '}
                using your endpoint secret, then compare in constant time.
              </p>
              <ul className="mt-5 space-y-2 text-[13px] text-ink">
                <li>· Reject timestamps older than 5 minutes (replay protection).</li>
                <li>· Use constant-time comparison; never == on the signature string.</li>
                <li>· Rotate secrets via PATCH /v1/webhooks/{'{id}'} anytime.</li>
                <li>· We retry with exponential backoff: 1m, 5m, 30m, 2h, 12h, 24h.</li>
              </ul>
            </div>
            <div>
              <CodeBlock
                title="node · verify signature"
                code={`import crypto from 'node:crypto';

function verify(headerSig, rawBody, secret) {
  const parts = Object.fromEntries(
    headerSig.split(',').map((p) => p.split('='))
  );
  const t = parts.t;
  const sig = parts.v1;
  if (!t || !sig) return false;

  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > 300) return false; // 5-minute replay window

  const payload = \`\${t}.\${rawBody}\`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(sig),
    Buffer.from(expected)
  );
}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* OPENAPI DOWNLOAD */}
      <section id="openapi" className="border-t border-line2 bg-paper scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="card card-pad p-10 max-w-4xl mx-auto text-center">
            <h3 className="text-2xl font-semibold text-ink tracking-tight">
              Full OpenAPI 3.1 specification
            </h3>
            <p className="mt-3 text-[14px] text-muted leading-relaxed max-w-xl mx-auto">
              Download the full spec to generate clients (TypeScript, Python, Go, Ruby, Swift) or
              import into Postman / Insomnia / Bruno.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition"
              >
                <Download className="h-4 w-4" />
                openapi.yaml
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3 rounded-md border border-line hover:bg-paper transition"
              >
                <Download className="h-4 w-4" />
                openapi.json
              </a>
              <Link
                href="/public/signup"
                className="inline-flex items-center justify-center gap-2 text-muted text-[14px] font-medium px-5 py-3 rounded-md hover:text-ink transition"
              >
                Sign up for an API key
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
