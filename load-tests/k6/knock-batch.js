/**
 * load-tests/k6/knock-batch.js
 *
 * Hot path: POST /v1/knocks/batch
 * Models the highest-throughput write path — a rep submitting 200 knocks
 * in a single batch call. Targets the 50k-concurrent ceiling defined in the
 * HARDENING-LOG capacity requirements.
 *
 * Run (full ramp):
 *   BASE_URL=https://api.d2d.example.com \
 *   EMAIL=<knocker email> PASSWORD=<password> TERRITORY_ID=<ter_...> \
 *   k6 run load-tests/k6/knock-batch.js
 *
 * Local smoke (20 VUs / 30s — verifies the script hits real 201s):
 *   SMOKE=1 EMAIL=... PASSWORD=... TERRITORY_ID=... k6 run load-tests/k6/knock-batch.js
 *
 * setup() logs in and opens a knock session; every batch call carries the
 * Idempotency-Key header + per-knock idempotencyKey the API requires.
 *
 * Thresholds:
 *   p95 response time < 2 000 ms
 *   error rate        < 1 %
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('knock_batch_errors');
const batchDuration = new Trend('knock_batch_duration_ms', true);

// ---------------------------------------------------------------------------
// Stage ramp — 3-phase: warm → sustained peak → cool-down
// ---------------------------------------------------------------------------
const SMOKE = !!__ENV.SMOKE;

export const options = {
  stages: SMOKE
    ? [
        { duration: '10s', target: 20 },
        { duration: '20s', target: 20 },
        { duration: '5s', target: 0 },
      ]
    : [
        { duration: '2m', target: 500 }, // warm-up
        { duration: '5m', target: 5000 }, // ramp to high concurrency
        { duration: '10m', target: 50000 }, // sustained 50k VU ceiling
        { duration: '3m', target: 5000 }, // step-down
        { duration: '2m', target: 0 }, // cool-down
      ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    knock_batch_errors: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * setup() — one real login + one knock session shared by all VUs. Matches the
 * app contract exactly: POST /v1/auth/login then POST /v1/sessions.
 */
export function setup() {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3010';
  if (__ENV.AUTH_TOKEN && __ENV.SESSION_ID) {
    return {
      token: __ENV.AUTH_TOKEN,
      sessionId: __ENV.SESSION_ID,
      territoryId: __ENV.TERRITORY_ID,
      run: Date.now().toString(36),
    };
  }
  const login = http.post(
    `${baseUrl}/v1/auth/login`,
    JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (login.status !== 200) {
    throw new Error(`setup login failed: ${login.status} ${login.body}`);
  }
  const token = JSON.parse(login.body).accessToken;
  const territoryId = __ENV.TERRITORY_ID;
  const sess = http.post(
    `${baseUrl}/v1/sessions`,
    JSON.stringify({
      territoryId,
      deviceId: `k6-${Date.now()}`,
      startGeo: { lng: -97.715, lat: 30.295 },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': `idem_k6_setup_${Date.now()}`,
      },
    },
  );
  if (sess.status !== 201 && sess.status !== 200) {
    throw new Error(`setup session failed: ${sess.status} ${sess.body}`);
  }
  const sessionId = JSON.parse(sess.body).session
    ? JSON.parse(sess.body).session.id
    : JSON.parse(sess.body).id;
  // Per-run nonce — idempotency keys must be unique across runs, or the API
  // correctly 409s replays of an old key with a new body.
  return { token, sessionId, territoryId, run: Date.now().toString(36) };
}

/**
 * Build a schema-correct knock batch. Batch size is 20 in smoke (fast local
 * loops) and 200 at scale (the max-throughput field case, half the 500 cap).
 */
function buildKnockBatch(vuId, iter, ctx) {
  const n = SMOKE ? 20 : 200;
  const knocks = [];
  for (let i = 0; i < n; i++) {
    knocks.push({
      sessionId: ctx.sessionId,
      territoryId: ctx.territoryId || undefined,
      rawAddress: {
        formatted: `${100 + i} Main St, Springfield IL 62701`,
        street: `${100 + i} Main St`,
        locality: 'Springfield',
        region: 'IL',
        postcode: '62701',
        countryCode: 'US',
      },
      disposition: i % 5 === 0 ? 'callback' : 'no_answer',
      geo: { lng: -97.7151 + i * 0.0001, lat: 30.2951 },
      capturedAt: new Date().toISOString(),
      idempotencyKey: `k6-${ctx.run}-${vuId}-${iter}-${i}`,
    });
  }
  return knocks;
}

// ---------------------------------------------------------------------------
// Default function
// ---------------------------------------------------------------------------
export default function (ctx) {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3010';

  const payload = JSON.stringify({
    knocks: buildKnockBatch(__VU, __ITER, ctx),
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
      'Idempotency-Key': `idem_k6_${ctx.run}_${__VU}_${__ITER}`,
    },
    timeout: '10s',
  };

  const start = Date.now();
  const res = http.post(`${baseUrl}/v1/knocks/batch`, payload, params);
  batchDuration.add(Date.now() - start);

  const ok = check(res, {
    'status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'batch inserted or deduped': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.inserted === 'number' && typeof body.deduped === 'number';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);

  // Brief think-time: reps do not fire batches back-to-back in real usage.
  sleep(Math.random() * 2 + 0.5);
}
