/**
 * load-tests/k6/knock-batch.js
 *
 * Hot path: POST /v1/knocks/batch
 * Models the highest-throughput write path — a rep submitting 200 knocks
 * in a single batch call. Targets the 50k-concurrent ceiling defined in the
 * HARDENING-LOG capacity requirements.
 *
 * Run:
 *   BASE_URL=https://api.d2d.example.com \
 *   AUTH_TOKEN=<bearer> \
 *   k6 run load-tests/k6/knock-batch.js
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
export const options = {
  stages: [
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
 * Build a synthetic 200-knock payload.
 * Each knock has a realistic structure: lead id, address fields, outcome.
 */
function buildKnockBatch(vuId, iter) {
  const knocks = [];
  for (let i = 0; i < 200; i++) {
    knocks.push({
      external_id: `vu-${vuId}-iter-${iter}-k-${i}`,
      lead_id: `lead_${Math.floor(Math.random() * 1_000_000)}`,
      address: {
        street: `${100 + i} Main St`,
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      },
      outcome: i % 5 === 0 ? 'INTERESTED' : 'NOT_HOME',
      knocked_at: new Date().toISOString(),
      rep_notes: 'Load test knock',
    });
  }
  return knocks;
}

// ---------------------------------------------------------------------------
// Default function
// ---------------------------------------------------------------------------
export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3010';
  const token = __ENV.AUTH_TOKEN || '';

  const payload = JSON.stringify({
    knocks: buildKnockBatch(__VU, __ITER),
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: '10s',
  };

  const start = Date.now();
  const res = http.post(`${baseUrl}/v1/knocks/batch`, payload, params);
  batchDuration.add(Date.now() - start);

  const ok = check(res, {
    'status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response has batch id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.batch_id === 'string' || typeof body.id === 'string';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);

  // Brief think-time: reps do not fire batches back-to-back in real usage.
  sleep(Math.random() * 2 + 0.5);
}
