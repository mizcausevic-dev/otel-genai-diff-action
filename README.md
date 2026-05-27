# otel-genai-diff-action

[![CI](https://github.com/mizcausevic-dev/otel-genai-diff-action/actions/workflows/ci.yml/badge.svg)](https://github.com/mizcausevic-dev/otel-genai-diff-action/actions/workflows/ci.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)

GitHub Action that **gates PRs touching an OTel GenAI rollup report**. Retrieves the previous version of the report via `git show <base.sha>:<report-path>`, diffs against HEAD via [`otel-genai-diff`](https://github.com/mizcausevic-dev/otel-genai-diff), posts the structured diff as a PR comment, and **fails the build on breaking cost / token jumps** (default 10% threshold).

**Fifth and final in the per-protocol diff Action quintet** (agent-card / mcp-tool-card / prompt-provenance / evidence-bundle / otel-genai). Quintet complete.

Part of the [Kinetic Gain Suite](https://suite.kineticgain.com/).

---

## Usage

```yaml
name: OTel GenAI cost gate
on:
  pull_request:
    paths: ["rollups/**/*.json"]

jobs:
  otel-genai-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed so the Action can `git show base.sha:path`
      - uses: mizcausevic-dev/otel-genai-diff-action@v0.1-shipped
        with:
          report-path: rollups/daily.json
          threshold: "0.10"    # 10% jump threshold
          fail-on-breaking: true
```

> **Important:** Your `checkout` step must use `fetch-depth: 0` so the Action can resolve the base SHA. Otherwise the previous version retrieval returns null and the diff is reported as "new report".

## Inputs

| input               | required | default       | description |
|---|---|---|---|
| `report-path`       | ✓        | —             | Path (relative to repo root) to the OTel GenAI rollup report JSON file (output of `otel-genai-rollup`). |
| `base-sha`          |          | `pull_request.base.sha` | Override the base SHA. |
| `threshold`         |          | `0.10`        | Minimum relative delta (0..1) to flag a token / span / cost change. |
| `comment-on-pr`     |          | `auto`        | `auto` posts only on `pull_request` events. |
| `fail-on-breaking`  |          | `true`        | Fail when the diff is BREAKING (cost/token jump above threshold, new/removed model, currency change). |
| `fail-on-any-change`|          | `false`       | Fail on ANY diff. |
| `github-token`      |          | `${{ github.token }}` | Token used to post the PR comment. |

## Outputs

| output           | description |
|---|---|
| `breaking`       | `true` iff the diff is BREAKING. |
| `change-count`   | Number of changes detected. |
| `new-report`     | `true` iff the file didn't exist at base SHA (newly added report). |
| `cost-delta-usd` | Net change in total cost (next − previous) in USD, six decimals. |

## What it detects

Same change reasons as [`otel-genai-diff`](https://github.com/mizcausevic-dev/otel-genai-diff) — breaking reasons include `cost-increased`, `input-tokens-jumped`, `output-tokens-jumped`, `spans-jumped`, `model-added`, `model-removed`, `currency-changed`. Threshold-gated to suppress noise from normal day-to-day variation.

## How it handles edge cases

- **New report** (file didn't exist at base SHA) → no diff, exits 0, sets `new-report=true`.
- **Malformed previous version** → warns and treats as new report.
- **report-path doesn't exist on disk** → exits 1 with a clear error.
- **Non-PR context** (push, manual dispatch) → skips PR comment; still emits diff to logs.
- **Threshold validation** — out-of-range values reject early (must be in `[0, 1]`).

## Composes with

- [**`otel-genai-diff`**](https://github.com/mizcausevic-dev/otel-genai-diff) — the library this wraps.
- [**`otel-genai-rollup`**](https://github.com/mizcausevic-dev/otel-genai-rollup) — produces the rollup reports this Action diffs.
- [**`otel-genai-validator`**](https://github.com/mizcausevic-dev/otel-genai-validator) · [**`otel-genai-fleet-summary-action`**](https://github.com/mizcausevic-dev/otel-genai-fleet-summary-action) — full OTel GenAI family.
- Sibling diff actions: [**`agent-card-diff-action`**](https://github.com/mizcausevic-dev/agent-card-diff-action) · [**`mcp-tool-card-diff-action`**](https://github.com/mizcausevic-dev/mcp-tool-card-diff-action) · [**`prompt-provenance-diff-action`**](https://github.com/mizcausevic-dev/prompt-provenance-diff-action) · [**`evidence-bundle-diff-action`**](https://github.com/mizcausevic-dev/evidence-bundle-diff-action).

## License

[AGPL-3.0-or-later](LICENSE)
