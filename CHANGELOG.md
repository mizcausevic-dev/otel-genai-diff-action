# Changelog

## v0.1.0 — 2026-05-27

- Initial release: GitHub Action wrapping `otel-genai-diff` as a per-PR OTel GenAI rollup-report breaking-change gate.
- Inputs: `report-path` (required), `base-sha` (default `pull_request.base.sha`), `threshold` (default 0.10), `comment-on-pr` (auto/true/false), `fail-on-breaking` (default true), `fail-on-any-change` (default false), `github-token`.
- Outputs: `breaking`, `change-count`, `new-report`, `cost-delta-usd`.
- Vendored `diffRollups()` + `toMarkdown` from `otel-genai-diff`.
- Same diff-action template as the other four — extended with `threshold` input (the otel-genai-diff lib accepts a configurable threshold) and `cost-delta-usd` output for downstream notification workflows.
- Handles 4 edge cases: newly-added report (no previous version), malformed previous version, missing report-path on disk, threshold validation.
- Composite Node 20 action with `dist/index.js` committed for SHA/tag pinning.
- 16 tests with injected `gitShow` for hermetic execution (2 extra threshold-validation tests beyond the standard 14).
- 3 fixtures inherited from `otel-genai-diff` (previous, next-cost-jump, next-non-breaking).
- **Fifth and final in the per-protocol diff Action quintet** — completes the set. Follows `agent-card-diff-action`, `mcp-tool-card-diff-action`, `prompt-provenance-diff-action`, `evidence-bundle-diff-action`.
- Node 20/22 CI (lint, typecheck, coverage, build, `npm audit`), AGPL-3.0-or-later, Dependabot.
