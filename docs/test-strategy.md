# Test strategy

## Principles

1. **The target belongs to the repository.** Public demo sites are useful for
   functional UI suites; they are poor performance baselines because their load,
   CDN and rate limits are outside our control.
2. **No randomness.** Project ids derive from the k6 scenario iteration, latency
   comes from fixed environment values and every response body is asserted.
3. **Bounded load.** Every profile declares an explicit VU ramp and duration.
   There is no unbounded "run until it breaks" job presented as a reproducible
   result.
4. **Failures are visible.** An expected 503 is a checked scenario, not a hidden
   exception; a real failure breaches a threshold and fails the profile.
5. **Evidence is generated.** Reports come from `handleSummary()` and raw k6
   output. Nothing is copied into a chart by hand.

## Profiles in detail

### Smoke

One VU performs twelve iterations: health, dashboard, an API collection or item,
and one planned fault. It runs in a few seconds and proves that checks, tags and
the negative path behave before any concurrency is applied. Thresholds are
strict: all checks must pass and no unexpected request may fail.

### Load

A ramping-VU executor moves 1 → 5 → 10 VUs, holds at 10, then ramps down. Each
iteration requests a complete page-like set: HTML plus CSS plus JS, followed by
the project collection API. Thresholds cover page, asset and API `p(95)`, plus
iteration duration. An early abort prevents a broken target from consuming the
whole run.

### Stress

A ramping-VU executor moves 2 → 12 → 24 VUs and back to zero. It adds `/api/slow`
so the run measures a service with a deliberately higher cost. Percentile
thresholds are looser than load, reflecting the peak profile, but the run remains
bounded and aborts if unexpected failures exceed 2%.

## Thresholds

| Metric | Why |
| --- | --- |
| `checks rate==1` | A fast wrong response is still a failure. |
| `http_req_failed{expected:false}` | Excludes the deliberately failing smoke endpoint. |
| `http_req_duration{kind:page|asset|api}` | Prevents one fast endpoint from hiding a slow one. |
| `http_req_duration{kind:slow}` | Measures the higher-cost service separately. |
| `iteration_duration` | Caps the total user-visible cycle, including pacing. |
| `p(99)` in stress | Detects tail latency that an average would hide. |

The numbers are chosen for the documented local target, not copied from an
unrelated production SLO. If the target's latency settings change, thresholds and
results must be re-evaluated together.

## What is deliberately not tested

- Browser-level Web Vitals; that belongs to a Playwright performance lab.
- Third-party public APIs; their stability is not ours to guarantee.
- Distributed or k6 Cloud execution; no cloud credentials or orchestrator are
  claimed. The local execution design is documented so distributed execution can
  be added honestly later.
- Security or accessibility scans; separate QA disciplines with separate tools.

## Negative controls

A green load run is not enough: the suite must be capable of failing. The local
target exposes `/api/fault` for a checked 503, and `/api/slow` makes latency
visible as its own tagged metric. Changing `SLOW_LATENCY_MS` past the stress
threshold should breach that threshold; this is the manual check used before
publishing a result.
