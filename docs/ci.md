# CI

## Workflow shape

```
quality (offline JavaScript validation)
   └── profiles: smoke | load | stress
          └── report: download all → build index → publish gh-pages
```

The quality gate runs first and has no external tool requirement. Profile jobs
fail independently (`fail-fast: false`) so one broken profile does not hide the
others.

## Pinned k6

The workflow pins k6 `2.4.0`, verifies the Linux archive against the SHA-256
published with the release, unpacks it to a temporary directory and prepends that
directory to `GITHUB_PATH`. A version guard then runs `k6 version`. This prevents
a silent upgrade from changing the meaning of a threshold result.

## Target lifecycle

`npm run test:<profile>` calls `scripts/run-profile.mjs`. The target is bound to
loopback. The runner polls `/api/health` before k6 starts, so a load result can
never be based on connection-refused samples. The server is stopped in `finally`,
including when k6 exits non-zero.

## Artifacts

Each profile uploads:

- `<profile>-raw.json`
- `<profile>-summary.json`
- `<profile>-report.html`

`if: always()` keeps artifacts available after a threshold failure. The report
job downloads all three artifact sets with `merge-multiple: true`, then
`scripts/build-site.mjs` refuses to publish unless every profile has all three
files. This avoids the common "merged" report that quietly contains one shard.

## Pages

On `main`, after successful profile jobs, `peaceiris/actions-gh-pages@v4`
publishes the generated `site/` directory to `gh-pages`. Pull requests still
upload the site artifact but do not publish. The Pages site is a report, not the
source repository: the source stays on `main`.

## Local equivalence

The same `run-profile.mjs`, k6 version and environment defaults are used locally
and in CI. The only difference is the machine's CPU, which is why thresholds are
stated as local-lab budgets and why raw samples are published alongside the HTML
summary.
