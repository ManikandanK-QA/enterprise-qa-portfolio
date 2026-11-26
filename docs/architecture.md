# Architecture

## System under test

OpsBoard is a local Node HTTP server with no npm dependencies. It serves one HTML
page, two static assets and a small JSON API. The project list is a fixed array of
six records; the only variable behaviour is latency supplied by environment
variables. This gives the load profiles a stable baseline that can be reproduced
on a laptop, in a container and in GitHub Actions.

Important routes:

| Route | Purpose |
| --- | --- |
| `GET /` | Dashboard page with `data-test` hooks |
| `GET /assets/app.css`, `GET /assets/app.js` | Real asset requests to exercise a browser-like page load |
| `GET /api/health` | Cheap readiness and heartbeat request |
| `GET /api/projects` | Deterministic collection response |
| `GET /api/projects/:id` | Deterministic item response and 404 path |
| `GET /api/slow` | Higher-latency endpoint for the stress profile |
| `GET /api/fault` | Planned 503 used by the smoke profile |

## Script layers

```
profile (shape of load)
   ↓
config.js   → tags, base URL
checks.js   → correctness assertions
summary.js  → evidence from executed metrics
   ↓
k6 runtime
   ↓
OpsBoard
```

`smoke.js`, `load.js` and `stress.js` contain only scenario definitions, the
sequence of requests and their thresholds. They import shared request helpers and
checks, so a change to the API contract is made once.

## Request tagging

Every request carries `project`, `profile`, `kind` and `expected` tags. This allows
thresholds to distinguish:

- page, asset, API and slow requests;
- expected negative responses from genuine failures;
- one profile's evidence from another's in the combined report.

The planned 503 is tagged `expected=true`; all normal requests are
`expected=false`. The failure-rate threshold filters on `expected:false`, so the
negative-path check cannot distort the SLO metric.

## Summary design

`handleSummary()` uses only the `data` object k6 passes at the end of a run. It
computes rates and percentiles from the same metrics k6 recorded, records whether
each threshold passed, writes a JSON file and renders a self-contained HTML page.
There is no remote jslib import and no hand-authored number in the report.

`scripts/run-profile.mjs` owns process lifecycle: it starts the target, polls the
health endpoint, invokes k6 with an argument array, writes raw samples and stops
the target in `finally`. CI calls the same script as a developer would, which
removes "works only in the workflow" drift.

## Report publication

Each matrix job uploads `reports/`. The report job downloads all three artifacts
into one `site/` directory with `merge-multiple: true`, verifies that each profile
has its report, summary and raw samples, generates `index.html`, then publishes
the directory to `gh-pages`. A missing artifact fails the site build instead of
silently publishing an incomplete report.
