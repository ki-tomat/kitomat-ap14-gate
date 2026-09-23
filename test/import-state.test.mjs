import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ImportStateError, resolveImportState } from "../src/import-state.mjs";
import { resolveWorkflowImportState } from "../scripts/resolve-import-state.mjs";

const plan = Object.freeze({
  artifactId: "example-artifact",
  branch: "prompt/example-artifact-i42",
  issueNumber: 42,
  payloadSha256: "b".repeat(64)
});

function pullRequest(overrides = {}) {
  const hash = overrides.hash ?? "a".repeat(64);
  return {
    number: 7,
    state: "OPEN",
    mergedAt: null,
    headRefName: plan.branch,
    url: "https://github.com/ki-tomat/kitomat-ap14-gate/pull/7",
    body: [
      `<!-- kitomat:payload-sha256:${hash} -->`,
      `<!-- kitomat:issue:${plan.issueNumber} -->`,
      `<!-- kitomat:artifact-id:${plan.artifactId} -->`
    ].join("\n"),
    ...overrides
  };
}

test("ohne vorhandenen Zustand wird ein neuer Import angelegt", () => {
  assert.deepEqual(resolveImportState(plan), { mode: "create" });
});

test("gleicher Hash und offener zugeordneter PR ergeben No-op", () => {
  const pr = pullRequest({ hash: plan.payloadSha256 });
  const result = resolveImportState(plan, { branchNames: [plan.branch], pullRequests: [pr] });
  assert.equal(result.mode, "noop");
  assert.equal(result.prNumber, 7);
});

test("neuer Hash und offener zugeordneter PR ergeben kontrolliertes Update", () => {
  const result = resolveImportState(plan, {
    branchNames: [plan.branch],
    pullRequests: [pullRequest()]
  });
  assert.equal(result.mode, "update");
  assert.equal(result.previousHash, "a".repeat(64));
});

test("geschlossener zugeordneter PR bleibt geschlossen", () => {
  const result = resolveImportState(plan, { pullRequests: [pullRequest({ state: "CLOSED" })] });
  assert.equal(result.mode, "closed");
});

test("gemergter zugeordneter PR läuft nicht erneut", () => {
  const result = resolveImportState(plan, {
    pullRequests: [pullRequest({ state: "CLOSED", mergedAt: "2026-09-23T20:00:00Z" })]
  });
  assert.equal(result.mode, "merged");
});

test("Artefakt auf main wird ohne Commit gestoppt", () => {
  assert.deepEqual(resolveImportState(plan, { mainArtifactExists: true }), { mode: "main_exists" });
});

test("fremde Branch-Familie wird nicht verändert", () => {
  assert.deepEqual(
    resolveImportState(plan, { branchNames: ["prompt/example-artifact-i999"] }),
    { mode: "collision" }
  );
});

test("exakte verwaiste Issue-Branch wird nur zur geprüften Wiederaufnahme vorgemerkt", () => {
  assert.deepEqual(resolveImportState(plan, { branchNames: [plan.branch] }), { mode: "recover" });
});

test("PR einer anderen Issue mit gleicher Artefakt-ID gilt als Kollision", () => {
  const other = pullRequest({
    headRefName: "prompt/example-artifact-i99",
    body: [
      `<!-- kitomat:payload-sha256:${"c".repeat(64)} -->`,
      "<!-- kitomat:issue:99 -->",
      `<!-- kitomat:artifact-id:${plan.artifactId} -->`
    ].join("\n")
  });
  assert.deepEqual(resolveImportState(plan, { pullRequests: [other] }), { mode: "collision" });
});

test("zugeordneter PR auf fremder Branch wird fail-closed abgewiesen", () => {
  assert.throws(
    () => resolveImportState(plan, { pullRequests: [pullRequest({ headRefName: "foreign" })] }),
    (error) => error instanceof ImportStateError && error.code === "FOREIGN_PR_BRANCH"
  );
});

test("mehrere PRs für dieselbe Issue werden fail-closed abgewiesen", () => {
  assert.throws(
    () => resolveImportState(plan, { pullRequests: [pullRequest(), pullRequest({ number: 8 })] }),
    (error) => error instanceof ImportStateError && error.code === "AMBIGUOUS_ISSUE_PR"
  );
});

test("Workflow-Adapter schreibt ausschließlich sichere Zustandsausgaben", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kitomat-state-"));
  const branchesPath = path.join(temporaryRoot, "branches.txt");
  const pullsPath = path.join(temporaryRoot, "pulls.json");
  const outputPath = path.join(temporaryRoot, "output.txt");
  try {
    await mkdir(temporaryRoot, { recursive: true });
    await writeFile(branchesPath, `${"d".repeat(40)}\trefs/heads/${plan.branch}\n`, "utf8");
    await writeFile(pullsPath, JSON.stringify([pullRequest({ hash: plan.payloadSha256 })]), "utf8");
    const result = await resolveWorkflowImportState({
      ARTIFACT_ID: plan.artifactId,
      BRANCH: plan.branch,
      BRANCHES_PATH: branchesPath,
      GITHUB_OUTPUT: outputPath,
      ISSUE_NUMBER: String(plan.issueNumber),
      MAIN_ARTIFACT_EXISTS: "false",
      PAYLOAD_SHA256: plan.payloadSha256,
      PULL_REQUESTS_PATH: pullsPath
    });
    assert.equal(result.mode, "noop");
    assert.equal(
      await readFile(outputPath, "utf8"),
      ["mode=noop", "pr_number=7", `pr_url=${pullRequest().url}`, `previous_hash=${plan.payloadSha256}`, ""].join("\n")
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
