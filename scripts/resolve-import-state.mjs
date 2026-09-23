import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveImportState } from "../src/import-state.mjs";

function requireEnvironment(environment, name) {
  const value = environment[name];
  if (!value) throw new Error(`Erforderliche Umgebungsvariable fehlt: ${name}.`);
  return value;
}

function outputLine(name, value) {
  const text = String(value ?? "");
  if (/\r|\n/u.test(text)) throw new Error(`Workflow-Ausgabe ${name} ist keine sichere Einzelzeile.`);
  return `${name}=${text}\n`;
}

export async function resolveWorkflowImportState(environment = process.env) {
  const plan = {
    artifactId: requireEnvironment(environment, "ARTIFACT_ID"),
    branch: requireEnvironment(environment, "BRANCH"),
    issueNumber: Number(requireEnvironment(environment, "ISSUE_NUMBER")),
    payloadSha256: requireEnvironment(environment, "PAYLOAD_SHA256")
  };
  if (!Number.isSafeInteger(plan.issueNumber) || plan.issueNumber <= 0) {
    throw new Error("Importplan-Umgebung ist unvollständig.");
  }

  const branchLines = (await readFile(requireEnvironment(environment, "BRANCHES_PATH"), "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean);
  const branchNames = branchLines.map((line) => line.trim().split(/\s+/u).at(-1)?.replace("refs/heads/", ""));
  const pullRequests = JSON.parse(
    await readFile(requireEnvironment(environment, "PULL_REQUESTS_PATH"), "utf8")
  );
  const result = resolveImportState(plan, {
    branchNames,
    pullRequests,
    mainArtifactExists: environment.MAIN_ARTIFACT_EXISTS === "true"
  });

  await appendFile(
    requireEnvironment(environment, "GITHUB_OUTPUT"),
    [
      outputLine("mode", result.mode),
      outputLine("pr_number", result.prNumber ?? ""),
      outputLine("pr_url", result.prUrl ?? ""),
      outputLine("previous_hash", result.previousHash ?? "")
    ].join(""),
    "utf8"
  );
  return result;
}

async function main() {
  try {
    console.log(JSON.stringify(await resolveWorkflowImportState(), null, 2));
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "RESOLVE_IMPORT_STATE_FAILED";
    console.error(`${code}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
