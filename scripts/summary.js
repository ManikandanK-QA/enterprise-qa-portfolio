const stats = [
  'avg',
  'min',
  'med',
  'max',
  'p(90)',
  'p(95)',
  'p(99)',
  'rate',
  'count',
  'passes',
  'fails',
];

function metricValues(metrics, name) {
  return metrics?.[name]?.values ?? {};
}

function pickStats(values) {
  const result = {};
  for (const key of stats) {
    if (typeof values[key] === 'number') result[key] = values[key];
  }
  return result;
}

function thresholdRows(data) {
  const rows = [];
  for (const [name, metric] of Object.entries(data.metrics ?? {})) {
    for (const [expression, result] of Object.entries(metric.thresholds ?? {})) {
      rows.push({ metric: name, expression, passed: result.ok === true });
    }
  }
  return rows;
}

function safeProfile() {
  return String(__ENV.PROFILE ?? 'unknown').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'unknown';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHtml(summary, thresholds) {
  const metricRows = Object.entries(summary.metrics)
    .map(([name, values]) => {
      const cells = Object.entries(values)
        .map(([key, value]) => `<td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td>`)
        .join('</tr><tr>');
      return `<tr><th scope="row">${escapeHtml(name)}</th><td colspan="2">${cells}</td></tr>`;
    })
    .join('');

  const thresholdHtml = thresholds.length
    ? `<table>
        <thead><tr><th>Metric</th><th>Threshold</th><th>Result</th></tr></thead>
        <tbody>${thresholds
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.metric)}</td><td>${escapeHtml(row.expression)}</td><td class="${row.passed ? 'pass' : 'fail'}">${row.passed ? 'PASS' : 'FAIL'}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '<p>No threshold metadata was emitted by this run.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>k6 report — ${escapeHtml(summary.profile)}</title>
<style>
:root { color-scheme: dark; font-family: system-ui, sans-serif; --border: #28364d; --muted: #9aa9c0; }
body { margin: 0; background: #0b1120; color: #e8eef8; }
main { width: min(1000px, calc(100% - 40px)); margin: 0 auto; padding: 48px 0 80px; }
h1 { font-size: 40px; margin: 0 0 8px; letter-spacing: -0.03em; }
p.meta { color: var(--muted); margin-top: 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 28px 0; }
.card { border: 1px solid var(--border); border-radius: 14px; padding: 18px; background: #111a2c; }
.card span { display: block; color: var(--muted); font-size: 13px; }
.card strong { display: block; margin-top: 6px; font-size: 28px; }
section { margin-top: 34px; }
table { width: 100%; border-collapse: collapse; border: 1px solid var(--border); }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; }
th { background: #111a2c; }
tr:last-child td, tr:last-child th { border-bottom: 0; }
.pass { color: #6ee7b7; font-weight: 700; }
.fail { color: #fca5a5; font-weight: 700; }
code { color: #7dd3fc; }
</style>
</head>
<body>
<main>
<h1>k6 ${escapeHtml(summary.profile)} profile</h1>
<p class="meta">Generated from the executed k6 summary at ${escapeHtml(summary.generatedAt)} · target ${escapeHtml(summary.baseUrl)}</p>
<div class="cards">
  <div class="card"><span>Checks pass rate</span><strong>${escapeHtml(summary.checksPassRate)}</strong></div>
  <div class="card"><span>Unexpected failure rate</span><strong>${escapeHtml(summary.failedRequestRate)}</strong></div>
  <div class="card"><span>Requests</span><strong>${escapeHtml(summary.requestCount)}</strong></div>
  <div class="card"><span>Thresholds passed</span><strong>${escapeHtml(summary.thresholdsPassed)}</strong></div>
</div>
<section><h2>Thresholds</h2>${thresholdHtml}</section>
<section><h2>Metrics</h2><table><tbody>${metricRows}</tbody></table></section>
<section><h2>Artifacts</h2><p>Raw samples: <code>reports/${escapeHtml(summary.profile)}-raw.json</code></p><p>Machine-readable summary: <code>reports/${escapeHtml(summary.profile)}-summary.json</code></p></section>
</main>
</body>
</html>`;
}

export function handleSummary(data) {
  const profile = safeProfile();
  const metrics = data.metrics ?? {};
  const checks = metricValues(metrics, 'checks');
  const failures = metricValues(metrics, 'http_req_failed');
  const unexpectedFailures = metricValues(metrics, 'http_req_failed{expected:false}');
  const requests = metricValues(metrics, 'http_reqs');
  const thresholds = thresholdRows(data);

  const summary = {
    profile,
    generatedAt: new Date().toISOString(),
    baseUrl: __ENV.BASE_URL ?? 'http://127.0.0.1:8085',
    metrics: {
      checks: pickStats(checks),
      checks_emitted: pickStats(metricValues(metrics, 'checks_emitted')),
      http_req_failed: pickStats(failures),
      'http_req_failed{expected:false}': pickStats(unexpectedFailures),
      http_reqs: pickStats(requests),
      http_req_duration: pickStats(metricValues(metrics, 'http_req_duration')),
      iteration_duration: pickStats(metricValues(metrics, 'iteration_duration')),
    },
    thresholds,
  };

  const checksPassRate =
    typeof checks.rate === 'number' ? `${(checks.rate * 100).toFixed(2)}%` : 'n/a';
  const rateForDisplay =
    typeof unexpectedFailures.rate === 'number' ? unexpectedFailures.rate : failures.rate;
  const failedRequestRate =
    typeof rateForDisplay === 'number' ? `${(rateForDisplay * 100).toFixed(2)}%` : 'n/a';

  const display = {
    ...summary,
    checksPassRate,
    failedRequestRate,
    requestCount: typeof requests.count === 'number' ? requests.count : 'n/a',
    thresholdsPassed: `${thresholds.filter((row) => row.passed).length}/${thresholds.length}`,
  };

  return {
    stdout:
      `\n${profile} summary\n` +
      `  checks pass rate: ${checksPassRate}\n` +
      `  unexpected fails: ${failedRequestRate}\n` +
      `  requests:         ${display.requestCount}\n` +
      `  thresholds:       ${display.thresholdsPassed}\n`,
    [`reports/${profile}-summary.json`]: JSON.stringify(summary, null, 2),
    [`reports/${profile}-report.html`]: renderHtml(display, thresholds),
  };
}
