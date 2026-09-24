import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Legacy-Artefaktbranches erhalten die aktuelle Workflow-Laufzeit vor der Generierung", async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, ".github", "workflows", "webui-import.yml"),
    "utf8"
  );
  const switchIndex = workflow.indexOf('git switch --create "$BRANCH" --track "origin/$BRANCH"');
  const restoreIndex = workflow.indexOf(
    "git restore --source=origin/main --worktree -- \\\n            scripts src tools package.json package-lock.json"
  );
  const generateIndex = workflow.indexOf("node scripts/generate-import-artifact.mjs");

  assert.ok(switchIndex >= 0, "Der Workflow muss die zugeordnete Artefaktbranch auschecken.");
  assert.ok(restoreIndex > switchIndex, "Die aktuelle Laufzeit muss nach dem Branchwechsel geladen werden.");
  assert.ok(generateIndex > restoreIndex, "Die Generierung darf erst nach dem Laufzeit-Restore starten.");
});
