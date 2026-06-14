/**
 * load-tests/k6/heatmap.js
 *
 * Hot path: GET /v1/territories/heatmap
 * The heatmap endpoint is a read-heavy aggregation query (geo + knock counts
 * grouped by territory polygon). Under high concurrency it stresses:
 *   - Postgres query planner (complex GROUP BY + PostGIS functions)
 *   - Redis caching layer (cache hit rate should climb to ~90% at scale)
 *   - JSON serialisation of large polygon+stats payloads
 *
 * The test exercises both cache-cold and cache-warm states by varying the
 * query parameters (zoom, bounds) — rotating through a small set of realistic
 * viewport combinations so cache warm-up is observable in the trend.
 *
 * Run:
 *   BASE_URL=https://api.d2d.example.com \
 *   AUTH_TOKEN=<bearer> \
 *   k6 run load-tests/k6/heatmap.js
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
const errorRate = new Rate('heatmap_errors');
const heatmapDuration = new Trend('heatmap_duration_ms', true);

// ---------------------------------------------------------------------------
// Stage ramp
// Heatmap is read-only and benefits from caching, so it tolerates higher VU
// counts at the same latency budget. Still ramp gradually to observe the
// cache warm-up inflection point in the trend data.
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 10000 },
    { duration: '10m', target: 50000 },
    { duration: '3m', target: 10000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    heatmap_errors: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Representative US city viewport bounding boxes (lng_min, lat_min, lng_max, lat_max)
// A small fixed set so caching kicks in at scale.
// ---------------------------------------------------------------------------
const VIEWPORTS = [
  { zoom: 10, bounds: '-87.94,41.64,-87.52,42.02' }, // Chicago
  { zoom: 10, bounds: '-97.92,29.52,-97.48,30.52' }, // Austin
  { zoom: 10, bounds: '-80.40,25.59,-80.05,25.92' }, // Miami
  { zoom: 10, bounds: '-118.67,33.70,-118.15,34.34' }, // Los Angeles
  { zoom: 10, bounds: '-122.52,37.70,-122.35,37.81' }, // San Francisco
  { zoom: 12, bounds: '-87.75,41.82,-87.60,41.95' }, // Chicago downtown (cache variant)
  { zoom: 8, bounds: '-89.50,40.50,-86.00,43.50' }, // Illinois state (large payload)
];

function randomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

// ---------------------------------------------------------------------------
// Default function
// ---------------------------------------------------------------------------
export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3010';
  const token = __ENV.AUTH_TOKEN || '';

  const vp = randomViewport();
  const url =
    `${baseUrl}/v1/territories/heatmap` +
    `?zoom=${vp.zoom}&bounds=${encodeURIComponent(vp.bounds)}`;

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: '10s',
  };

  const start = Date.now();
  const res = http.get(url, params);
  heatmapDuration.add(Date.now() - start);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'response is json': (r) => {
      try {
        const body = JSON.parse(r.body);
        // Expect either a GeoJSON FeatureCollection or an array of territory records
        return (
          (body.type === 'FeatureCollection' && Array.isArray(body.features)) ||
          Array.isArray(body) ||
          Array.isArray(body.territories)
        );
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);

  // Short think-time: map tiles are polled on pan/zoom events.
  sleep(Math.random() * 1.0 + 0.2);
}
