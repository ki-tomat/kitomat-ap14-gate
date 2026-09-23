import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { prepareImport } from "../scripts/prepare-import.mjs";
import { encodePayload } from "../src/payload-codec.mjs";
import {
  buildPullRequestBody,
  IMPORT_LABEL,
  ImportPlanError,
  prepareImportPlan
} from "../src/import-plan.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.resolve(testDirectory, "..", "fixtures");

async function loadFixture(name = "prompt") {
  return JSON.parse(await readFile(path.join(fixtureDirectory, `${name}.json`), "utf8"));
}

async function validEvent(fixtureName = "prompt") {
  const payload = await loadFixture(fixtureName);
  return {
    action: "labeled",
    label: { name: IMPORT_LABEL },
    sender: { login: "maintainer-one" },
    repository: { full_name: "ki-tomat/kitomat-ap14-gate" },
    issue: {
      number: 142,
      state: "open",
      body: `Lesbare Einleitung\n\n${encodePayload(payload).block}`,
      html_url: "https://github.com/ki-tomat/kitomat-ap14-gate/issues/142",
      user: { login: "contributor-one" }
    }
  };
}

function assertImportError(expectedCode, operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof ImportPlanError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("gültiges Label-Ereignis erzeugt sicheren Importplan", async () => {
  const plan = prepareImportPlan(await validEvent(), {
    expectedRepository: "ki-tomat/kitomat-ap14-gate"
  });

  assert.equal(plan.branch, "prompt/synthetische-kundenanfrage-sortieren-i142");
  assert.equal(plan.branchFamily, "prompt/synthetische-kundenanfrage-sortieren-i");
  assert.equal(plan.relativeDirectory, "prompts/synthetische-kundenanfrage-sortieren");
  assert.equal(plan.issueAuthor, "contributor-one");
  assert.equal(plan.labelActor, "maintainer-one");
  assert.match(plan.payloadSha256, /^[a-f0-9]{64}$/);
});

test("PR-Text trennt verifizierte GitHub-Herkunft von Maintainer-Selbstauskunft", async () => {
  const plan = prepareImportPlan(await validEvent());
  const body = buildPullRequestBody(plan);

  assert.ok(body.includes("Issue-Autor: @contributor-one"));
  assert.ok(body.includes("Label vergeben von: @maintainer-one"));
  assert.ok(body.includes("Eingetragener Maintainer (Selbstauskunft): ap14-test-user"));
  assert.ok(body.includes(`kitomat:payload-sha256:${plan.payloadSha256}`));
  assert.ok(body.includes("kitomat:artifact-id:synthetische-kundenanfrage-sortieren"));
  assert.equal(body.includes("Co-authored-by"), false);
  assert.equal(body.includes("- [x]"), false);
});

test("Branch und PR-Titel verwenden keine freie Titeleingabe", async () => {
  const event = await validEvent();
  const payload = await loadFixture();
  payload.answers.title = "$(touch owned) ${{ github.token }}";
  event.issue.body = encodePayload(payload).block;
  const plan = prepareImportPlan(event);

  assert.equal(plan.branch, "prompt/synthetische-kundenanfrage-sortieren-i142");
  assert.equal(plan.pullRequestTitle, "AP14 import: synthetische-kundenanfrage-sortieren");
});

for (const [description, mutate, code] of [
  ["falsche Aktion", (event) => (event.action = "edited"), "INVALID_EVENT_ACTION"],
  ["falsches Label", (event) => (event.label.name = "bug"), "INVALID_IMPORT_LABEL"],
  ["fehlende Issue-Nummer", (event) => delete event.issue.number, "INVALID_ISSUE_NUMBER"],
  ["geschlossenes Issue", (event) => (event.issue.state = "closed"), "ISSUE_NOT_OPEN"],
  ["fehlender Body", (event) => delete event.issue.body, "INVALID_ISSUE_BODY"],
  ["fremdes Repository", (event) => (event.repository.full_name = "other/repo"), "REPOSITORY_MISMATCH"],
  ["ungültiger Label-Akteur", (event) => (event.sender.login = "../actor"), "INVALID_EVENT_LOGIN"],
  ["ungültiger Issue-Autor", (event) => (event.issue.user.login = "@author"), "INVALID_EVENT_LOGIN"]
]) {
  test(`${description} wird vor jeder Generierung abgewiesen`, async () => {
    const event = await validEvent();
    mutate(event);
    assertImportError(code, () =>
      prepareImportPlan(event, { expectedRepository: "ki-tomat/kitomat-ap14-gate" })
    );
  });
}

test("Payload-Fehler werden als Importfehler gekapselt", async () => {
  const event = await validEvent();
  event.issue.body = "ohne Payload";
  assertImportError("PAYLOAD_INVALID_MARKERS", () => prepareImportPlan(event));
});

test("prepare-import schreibt Artefakt, PR-Text und sichere Workflow-Ausgaben", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kitomat-import-e2e-"));
  const workspace = path.join(temporaryRoot, "workspace");
  const runnerTemp = path.join(temporaryRoot, "runner");
  const eventPath = path.join(temporaryRoot, "event.json");
  const outputPath = path.join(temporaryRoot, "github-output.txt");

  try {
    await writeFile(eventPath, JSON.stringify(await validEvent()), "utf8");
    await Promise.all([mkdir(workspace), mkdir(runnerTemp)]);
    const result = await prepareImport({
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: "ki-tomat/kitomat-ap14-gate",
      GITHUB_OUTPUT: outputPath,
      GITHUB_WORKSPACE: workspace,
      RUNNER_TEMP: runnerTemp
    });

    const outputs = await readFile(outputPath, "utf8");
    const metadata = await readFile(
      path.join(workspace, "prompts", result.artifactPath.split("/")[1], "metadata.yml"),
      "utf8"
    );
    const prBody = await readFile(path.join(runnerTemp, "kitomat-pr-body-142.md"), "utf8");

    assert.equal(result.fileCount, 7);
    assert.ok(outputs.includes("branch=prompt/synthetische-kundenanfrage-sortieren-i142\n"));
    assert.ok(outputs.includes("branch_family=prompt/synthetische-kundenanfrage-sortieren-i\n"));
    assert.ok(outputs.includes("data_risk=green\n"));
    assert.ok(metadata.includes('title: "Synthetische Kundenanfragen'));
    assert.ok(prBody.includes("Issue-Autor: @contributor-one"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("prepare-import bricht vor der Generierung bei falschem Label ab", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kitomat-import-reject-"));
  const workspace = path.join(temporaryRoot, "workspace");
  const runnerTemp = path.join(temporaryRoot, "runner");
  const eventPath = path.join(temporaryRoot, "event.json");
  const outputPath = path.join(temporaryRoot, "github-output.txt");

  try {
    const event = await validEvent();
    event.label.name = "bug";
    await writeFile(eventPath, JSON.stringify(event), "utf8");
    await Promise.all([mkdir(workspace), mkdir(runnerTemp)]);
    await assert.rejects(
      prepareImport({
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: "ki-tomat/kitomat-ap14-gate",
          GITHUB_OUTPUT: outputPath,
          GITHUB_WORKSPACE: workspace,
          RUNNER_TEMP: runnerTemp
      }),
      (error) => error.code === "INVALID_IMPORT_LABEL"
    );
    await assert.rejects(readFile(outputPath, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(path.join(workspace, "prompts"), "utf8"), { code: "ENOENT" });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("prepare-import kann den validierten Plan ohne Dateischreibzugriff ausgeben", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kitomat-import-plan-only-"));
  const workspace = path.join(temporaryRoot, "workspace");
  const runnerTemp = path.join(temporaryRoot, "runner");
  const eventPath = path.join(temporaryRoot, "event.json");
  const outputPath = path.join(temporaryRoot, "github-output.txt");

  try {
    await writeFile(eventPath, JSON.stringify(await validEvent()), "utf8");
    await Promise.all([mkdir(workspace), mkdir(runnerTemp)]);
    const result = await prepareImport({
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: "ki-tomat/kitomat-ap14-gate",
      GITHUB_OUTPUT: outputPath,
      GITHUB_WORKSPACE: workspace,
      KITOMAT_PLAN_ONLY: "true",
      RUNNER_TEMP: runnerTemp
    });

    assert.equal(result.generated, false);
    assert.match(await readFile(outputPath, "utf8"), /manifest_sha256=[a-f0-9]{64}\n/u);
    await assert.rejects(readFile(path.join(workspace, "prompts"), "utf8"), { code: "ENOENT" });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
