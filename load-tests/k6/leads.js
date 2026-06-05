/**
 * load-tests/k6/leads.js
 *
 * Hot paths: POST /v1/leads (create) + GET /v1/leads (list with pagination)
 * Models the mixed read/write pattern typical of field-rep sessions:
 *   - Reps create leads throughout the day (write-heavy during field hours).
 *   - Managers and dashboards poll the list endpoint (read-heavy at all times).
 * Split: 30% create / 70% list to reflect observed production ratio.
 *
 * Run:
 *   BASE_URL=https://api.d2d.example.com \
 *   AUTH_TOKEN=<bearer> \
 *   k6 run load-tests/k6/leads.js
 *
 * Thresholds:
 *   p95 response time < 2 000 ms
 *   error rate        < 1 %
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('leads_errors');
const createDuration = new Trend('leads_create_duration_ms', true);
const listDuration = new Trend('leads_list_duration_ms', true);
const createCount = new Counter('leads_created');
const listCount = new Counter('leads_listed');

// ---------------------------------------------------------------------------
// Stage ramp
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '5m', target: 5000 },
    { duration: '10m', target: 50000 },
    { duration: '3m', target: 5000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    leads_errors: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Realistic US first/last name pools (no external data files — inline arrays)
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Barbara',
  'David',
  'Elizabeth',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
];
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
];
const STATES = ['IL', 'OH', 'TX', 'FL', 'CA', 'PA', 'NY', 'GA', 'NC', 'MI'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildLead(vuId, iter) {
  return {
    first_name: randomElement(FIRST_NAMES),
    last_name: randomElement(LAST_NAMES),
    email: `loadtest+vu${vuId}iter${iter}@d2d.example.com`,
    phone: `555${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`,
    address: {
      street: `${Math.floor(Math.random() * 9999) + 1} Oak Ave`,
      city: 'Springfield',
      state: randomElement(STATES),
      zip: `${Math.floor(Math.random() * 90000) + 10000}`,
    },
    source: 'CANVASS',
  };
}

// ---------------------------------------------------------------------------
// Default function — 30/70 create/list split
// ---------------------------------------------------------------------------
export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3010';
  const token = __ENV.AUTH_TOKEN || '';

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: '10s',
  };

  // 30% create, 70% list
  if (Math.random() < 0.3) {
    // --- POST /v1/leads ---
    const payload = JSON.stringify(buildLead(__VU, __ITER));
    const start = Date.now();
    const res = http.post(`${baseUrl}/v1/leads`, payload, params);
    createDuration.add(Date.now() - start);
    createCount.add(1);

    const ok = check(res, {
      'create 201': (r) => r.status === 201,
      'create has id': (r) => {
        try {
          return typeof JSON.parse(r.body).id === 'string';
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  } else {
    // --- GET /v1/leads?page=N&limit=25 ---
    const page = Math.floor(Math.random() * 20) + 1;
    const url = `${baseUrl}/v1/leads?page=${page}&limit=25`;
    const start = Date.now();
    const res = http.get(url, params);
    listDuration.add(Date.now() - start);
    listCount.add(1);

    const ok = check(res, {
      'list 200': (r) => r.status === 200,
      'list has data array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data) || Array.isArray(body.leads);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  }

  sleep(Math.random() * 1.5 + 0.5);
}
