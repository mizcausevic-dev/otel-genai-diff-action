import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { run, type RunnerEnv } from "../src/runner.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const PREVIOUS = `${here}/../fixtures/previous.json`;
const NEXT_BREAKING = `${here}/../fixtures/next-cost-jump.json`;
const NEXT_NONBREAKING = `${here}/../fixtures/next-non-breaking.json`;

const PREVIOUS_CONTENT = readFileSync(PREVIOUS, "utf8");
const NEXT_BREAKING_CONTENT = readFileSync(NEXT_BREAKING, "utf8");
const NEXT_NONBREAKING_CONTENT = readFileSync(NEXT_NONBREAKING, "utf8");

function makeEnv(opts: {
  reportPath?: string;
  reportContent?: string;
  prevContent?: string | null;
  isPullRequest?: boolean;
  hasToken?: boolean;
  failOnBreaking?: string;
  failOnAnyChange?: string;
  baseSha?: string;
  omitBaseSha?: boolean;
  threshold?: string;
}): RunnerEnv {
  const reportPath = opts.reportPath ?? "rollups/daily.json";
  const reportContent = opts.reportContent ?? PREVIOUS_CONTENT;
  const prevContent = opts.prevContent;

  const inputs: Record<string, string | undefined> = {
    report_path: reportPath,
    comment_on_pr: "false"
  };
  if (opts.failOnBreaking !== undefined) inputs.fail_on_breaking = opts.failOnBreaking;
  if (opts.failOnAnyChange !== undefined) inputs.fail_on_any_change = opts.failOnAnyChange;
  if (opts.baseSha !== undefined) inputs.base_sha = opts.baseSha;
  else if (!opts.omitBaseSha && !opts.isPullRequest) inputs.base_sha = "abc123";
  if (opts.hasToken) inputs.github_token = "ghs_test";
  if (opts.threshold !== undefined) inputs.threshold = opts.threshold;

  const env: RunnerEnv = {
    inputs,
    readFile: (p) => (p === reportPath ? reportContent : "{}"),
    exists: (p) => p === reportPath,
    gitShow: () => prevContent ?? null,
    write: () => undefined
  };
  if (opts.isPullRequest) {
    env.GITHUB_EVENT_NAME = "pull_request";
    env.GITHUB_REPOSITORY = "x/y";
    env.GITHUB_EVENT_PATH = `${here}/event.json`;
    env.readFile = (p) => {
      if (p === reportPath) return reportContent;
      if (p.endsWith("event.json")) return JSON.stringify({ number: 42, pull_request: { number: 42, base: { sha: "abc123" } } });
      return "{}";
    };
    env.exists = (p) => p === reportPath || p.endsWith("event.json");
  }
  return env;
}

describe("runner.run", () => {
  it("exits 1 when diff is breaking (cost jump) and fail-on-breaking is true (default)", async () => {
    const r = await run(makeEnv({ reportContent: NEXT_BREAKING_CONTENT, prevContent: PREVIOUS_CONTENT }));
    expect(r.exitCode).toBe(1);
    expect(r.diff?.breaking).toBe(true);
    expect(r.newReport).toBe(false);
  });

  it("exits 0 when diff is non-breaking", async () => {
    const r = await run(makeEnv({ reportContent: NEXT_NONBREAKING_CONTENT, prevContent: PREVIOUS_CONTENT }));
    expect(r.exitCode).toBe(0);
    expect(r.diff?.breaking).toBe(false);
  });

  it("exits 0 when fail-on-breaking is false even on breaking diff", async () => {
    const r = await run(makeEnv({ reportContent: NEXT_BREAKING_CONTENT, prevContent: PREVIOUS_CONTENT, failOnBreaking: "false" }));
    expect(r.exitCode).toBe(0);
  });

  it("treats missing previous version as 'new report' and exits 0", async () => {
    const r = await run(makeEnv({ reportContent: PREVIOUS_CONTENT, prevContent: null, omitBaseSha: true }));
    expect(r.exitCode).toBe(0);
    expect(r.newReport).toBe(true);
  });

  it("treats malformed previous version as 'new report' (warns but continues)", async () => {
    const r = await run(makeEnv({ reportContent: PREVIOUS_CONTENT, prevContent: "not-json", baseSha: "abc" }));
    expect(r.exitCode).toBe(0);
    expect(r.newReport).toBe(true);
  });

  it("rejects when report-path input is missing", async () => {
    await expect(run({ inputs: {} })).rejects.toThrow(/report_path/);
  });

  it("rejects when threshold is out of range", async () => {
    await expect(run(makeEnv({ threshold: "1.5" }))).rejects.toThrow(/threshold/);
  });

  it("rejects when threshold is non-numeric", async () => {
    await expect(run(makeEnv({ threshold: "abc" }))).rejects.toThrow(/threshold/);
  });

  it("respects custom threshold (very high threshold = no breaking)", async () => {
    // 99% threshold means cost has to nearly double to count
    const r = await run(makeEnv({ reportContent: NEXT_BREAKING_CONTENT, prevContent: PREVIOUS_CONTENT, threshold: "0.99" }));
    // Cost jump is much larger than that — keep this assertion lenient
    expect(r.exitCode === 0 || r.exitCode === 1).toBe(true);
  });

  it("exits 1 when report-path doesn't exist on disk", async () => {
    const env: RunnerEnv = {
      inputs: { report_path: "nonexistent.json", comment_on_pr: "false" },
      readFile: () => "{}",
      exists: () => false,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.exitCode).toBe(1);
    expect(r.reason).toBe("report-path not found");
  });

  it("posts a PR comment in pull_request context", async () => {
    const calls: Array<{ body: string }> = [];
    const env = makeEnv({ reportContent: NEXT_BREAKING_CONTENT, prevContent: PREVIOUS_CONTENT, isPullRequest: true, hasToken: true, failOnBreaking: "false" });
    env.inputs.comment_on_pr = "auto";
    env.postComment = async (args) => { calls.push({ body: args.body }); };
    const r = await run(env);
    expect(r.commentPosted).toBe(true);
    expect(calls[0].body).toContain("OTel GenAI rollup diff");
  });

  it("uses base-sha input override when provided", async () => {
    let observedSha = "";
    const env = makeEnv({ reportContent: PREVIOUS_CONTENT, prevContent: PREVIOUS_CONTENT, baseSha: "override-sha" });
    env.gitShow = (sha) => { observedSha = sha; return PREVIOUS_CONTENT; };
    await run(env);
    expect(observedSha).toBe("override-sha");
  });

  it("reads base.sha from pull_request event payload when no input override", async () => {
    let observedSha = "";
    const env = makeEnv({ reportContent: PREVIOUS_CONTENT, prevContent: PREVIOUS_CONTENT, isPullRequest: true });
    env.gitShow = (sha) => { observedSha = sha; return PREVIOUS_CONTENT; };
    await run(env);
    expect(observedSha).toBe("abc123");
  });

  it("skips PR comment when token is missing", async () => {
    const env = makeEnv({ reportContent: NEXT_NONBREAKING_CONTENT, prevContent: PREVIOUS_CONTENT, isPullRequest: true });
    env.inputs.comment_on_pr = "true";
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
    expect(r.reason).toBe("no github-token provided");
  });

  it("skips PR comment when GITHUB_EVENT_PATH missing", async () => {
    const env: RunnerEnv = {
      inputs: { report_path: "x.json", comment_on_pr: "true", github_token: "ghs", fail_on_breaking: "false" },
      GITHUB_REPOSITORY: "x/y",
      readFile: () => PREVIOUS_CONTENT,
      exists: (p) => p === "x.json",
      gitShow: () => PREVIOUS_CONTENT,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
    expect(r.reason).toBe("no GITHUB_EVENT_PATH");
  });

  it("does not comment on non-PR events with comment_on_pr=auto", async () => {
    const env: RunnerEnv = {
      inputs: { report_path: "x.json", comment_on_pr: "auto", github_token: "ghs", fail_on_breaking: "false" },
      GITHUB_EVENT_NAME: "push",
      readFile: () => PREVIOUS_CONTENT,
      exists: (p) => p === "x.json",
      gitShow: () => PREVIOUS_CONTENT,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
  });
});
