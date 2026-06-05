# Load Tests — D2D Platform

k6 scripts targeting the 50k-concurrent hot paths identified in the
HARDENING-LOG capacity review. Plain k6 JavaScript — no npm dependencies.

## Requirements

- [k6](https://k6.io/docs/getting-started/installation/) >= 0.50.0
- A deployed stack reachable at `BASE_URL` (see below)
- A valid bearer token for the test tenant (`AUTH_TOKEN`)

**These scripts CANNOT be driven to 50k VUs from a single laptop.**
At full scale you need k6 Cloud or a self-hosted k6 operator cluster on AWS.
Running locally is suitable for smoke-testing the scripts and collecting
low-concurrency baseline numbers (target <= 50 VUs on a dev machine).

## Environment variables

| Variable        | Required           | Description                                                      |
| --------------- | ------------------ | ---------------------------------------------------------------- |
| `BASE_URL`      | yes                | Base URL of the deployed API, e.g. `https://api.d2d.example.com` |
| `AUTH_TOKEN`    | yes (most scripts) | Bearer token with sufficient permissions                         |
| `TEST_EMAIL`    | login.js only      | Email of a pre-seeded load-test user                             |
| `TEST_PASSWORD` | login.js only      | Password of the load-test user                                   |

## Scripts

### `k6/knock-batch.js` — POST /v1/knocks/batch

Highest-throughput write path. Sends 200-knock batch payloads. Stages ramp to
50k VUs over ~22 minutes. Thresholds: p95 < 2000ms, error rate < 1%.

```
BASE_URL=https://api.d2d.example.com AUTH_TOKEN=<token> k6 run load-tests/k6/knock-batch.js
```

### `k6/login.js` — POST /v1/auth/login

Stress-tests the scrypt thread-pool path. This is the bottleneck addressed by
`UV_THREADPOOL_SIZE=16` (HARDENING-LOG P0-perf). Stages ramp to 50k VUs.
Use a pre-seeded pool of test accounts in staging to avoid single-row hot spots.
Thresholds: p95 < 2000ms, error rate < 1%.

```
BASE_URL=https://api.d2d.example.com TEST_EMAIL=loadtest@d2d.example.com \
  TEST_PASSWORD=LoadTest1234! k6 run load-tests/k6/login.js
```

### `k6/leads.js` — POST /v1/leads + GET /v1/leads

Mixed 30% create / 70% list workload. Simulates field-rep sessions. Stages
ramp to 50k VUs. Thresholds: p95 < 2000ms, error rate < 1%.

```
BASE_URL=https://api.d2d.example.com AUTH_TOKEN=<token> k6 run load-tests/k6/leads.js
```

### `k6/heatmap.js` — GET /v1/territories/heatmap

Read-heavy aggregation + PostGIS query. Rotates through a small viewport
set to exercise Redis cache warm-up. Stages ramp to 50k VUs.
Thresholds: p95 < 2000ms, error rate < 1%.

```
BASE_URL=https://api.d2d.example.com AUTH_TOKEN=<token> k6 run load-tests/k6/heatmap.js
```

## Running at scale

To drive 50k VUs you need distributed execution. Options:

- **k6 Cloud** — `k6 cloud load-tests/k6/<script>.js` (requires k6 Cloud account)
- **k6 Operator on EKS/ECS** — deploy the k6 operator, create a `K6` CR pointing
  at the script; set `parallelism` to spread VUs across pods

Do not run 50k-VU tests against production. Target the staging environment
(which mirrors prod architecture at reduced Fargate task count).

## Interpreting results

Key signals to watch for each script:

| Script         | Cache/DB signal                                                             | Threadpool signal                                                           |
| -------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| login.js       | n/a                                                                         | p95 latency plateau at ~16 concurrent scrypt calls; should not blow past 2s |
| knock-batch.js | Aurora write IOPS, Aurora ACU autoscaling                                   | n/a                                                                         |
| leads.js       | Aurora read replica lag                                                     | n/a                                                                         |
| heatmap.js     | Redis hit rate (CloudWatch `CacheHits` metric) should reach ~90% after warm | n/a                                                                         |
