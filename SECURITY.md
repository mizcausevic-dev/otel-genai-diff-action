# Security Policy

`otel-genai-diff-action` reads the OTel GenAI rollup report JSON file at the workflow's checkout HEAD, retrieves the previous version via `git show`, posts a single PR comment via the GitHub API (when run on a pull_request event with a valid token), and writes structured outputs. No remote fetch beyond the GitHub API comment call, no execution of user-supplied code.

The action uses `${{ github.token }}` by default — scoped to the repository where the workflow runs and never persisted. If you provide your own token via the `github-token` input, ensure it has only `pull-requests: write` permissions.

The `git show` invocation runs in a sub-shell with stdout-only piping; the previous file content is parsed as JSON without `eval` or `Function()`. The `threshold` input is parsed via `Number.parseFloat` and validated to `[0, 1]` before use; out-of-range values reject early.

This action operates on rollup reports — pre-aggregated cost/token data. It does **not** read raw trace exports, so it cannot leak per-request prompt content.

## Supported versions

Only the latest tagged release is supported.

## Reporting a vulnerability

Please use GitHub Security Advisories for private disclosure:

- [Open a security advisory](https://github.com/mizcausevic-dev/otel-genai-diff-action/security/advisories/new)

Do not file public issues for security reports.
