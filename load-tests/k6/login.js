/**
 * load-tests/k6/login.js
 *
 * Hot path: POST /v1/auth/login
 * This is the scrypt-thread-pool bottleneck targeted by HARDENING-LOG P0-perf.
 * Each login call invokes scrypt on a libuv thread; at default UV_THREADPOOL_SIZE=4
 * concurrent logins queue behind each other and latency blows up.
 * With UV_THREADPOOL_SIZE=16 the thread pool can service 16 concurrent hashes.
 *
 * The test is deliberately more aggressive at lower VU counts than knock-batch
 * because login is CPU-bound (scrypt) whereas batch is IO-bound (DB write).
 *
 * Run:
 *   BASE_URL=https://api.d2d.example.com \
 *   TEST_EMAIL=loadtest@d2d.example.com \
 *   TEST_PASSWORD=LoadTest1234! \
 *   k6 run load-tests/k6/login.js
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
const errorRate = new Rate('login_errors');
const loginDuration = new Trend('login_duration_ms', true);

// ---------------------------------------------------------------------------
// Stage ramp
// Ramps more slowly than the batch test — scrypt is CPU-bound so each Fargate
// task can handle far fewer concurrent login ops than batch writes.
// The 50k ceiling represents aggregate VUs across the fleet, not per-task.
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '2m', target: 200 }, // warm-up (scrypt cold start)
    { duration: '5m', target: 2000 }, // ramp
    { duration: '10m', target: 50000 }, // sustained ceiling
    { duration: '3m', target: 2000 }, // step-down
    { duration: '2m', target: 0 }, // cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    login_errors: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Default function
// ---------------------------------------------------------------------------
export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3010';

  // In production load testing, use a pre-seeded pool of test accounts so
  // the DB lookup is realistic. Single account here for simplicity — replace
  // with a shared array when running against staging.
  const email = __ENV.TEST_EMAIL || 'loadtest@d2d.example.com';
  const password = __ENV.TEST_PASSWORD || 'LoadTest1234!';

  const payload = JSON.stringify({ email, password });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s', // scrypt can take 1-2s under heavy load even with fix
  };

  const start = Date.now();
  const res = http.post(`${baseUrl}/v1/auth/login`, payload, params);
  loginDuration.add(Date.now() - start);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'access_token present': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.access_token === 'string';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);

  // Realistic session gap: users don't hammer login.
  sleep(Math.random() * 3 + 1);
}
