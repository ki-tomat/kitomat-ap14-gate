import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateArtifact } from "../src/artifact-generator.mjs";
import { buildPullRequestBody, prepareImportPlan } from "../src/import-plan.mjs";

function requireEnvironment(environment, name) {
  const value = environment[name];
  if (!value) throw new Error(`Erforderliche Umgebungsvariable fehlt: ${name}.`);
  return value;
}

function outputLine(name, value) {
  if (typeof value !== "string" || /[\r\n]/u.test(value)) {
    throw new Error(`Workflow-Ausgabe ${name} ist keine sichere Einzelzeile.`);
  }
  return `${name}=${value}\n`;
}

export async function prepareImport(environment = process.env) {
  const eventPath = requireEnvironment(environment, "GITHUB_EVENT_PATH");
  const repository = requireEnvironment(environment, "GITHUB_REPOSITORY");
  const outputPath = requireEnvironment(environment, "GITHUB_OUTPUT");
  const runnerTemp = requireEnvironment(environment, "RUNNER_TEMP");
  const repositoryRoot = environment.GITHUB_WORKSPACE || process.cwd();
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const plan = prepareImportPlan(event, { expectedRepository: repository });
  const generated = await generateArtifact(plan.payload, { repositoryRoot });
  const pullRequestBodyPath = path.join(runnerTemp, `kitomat-pr-body-${plan.issueNumber}.md`);
  await writeFile(pullRequestBodyPath, buildPullRequestBody(plan), {
    encoding: "utf8",
    flag: "wx"
  });

  const outputs = {
    artifact_id: plan.artifactId,
    artifact_path: plan.relativeDirectory,
    branch: plan.branch,
    branch_family: plan.branchFamily,
    data_risk: plan.dataRisk,
    issue_author: plan.issueAuthor,
    issue_number: String(plan.issueNumber),
    label_actor: plan.labelActor,
    manifest_sha256: generated.manifestSha256,
    payload_sha256: plan.payloadSha256,
    pr_body_path: pullRequestBodyPath,
    pr_title: plan.pullRequestTitle,
    type: plan.type
  };
  await appendFile(
    outputPath,
    Object.entries(outputs).map(([name, value]) => outputLine(name, value)).join(""),
    "utf8"
  );
  return {
    issue: plan.issueNumber,
    branch: plan.branch,
    artifactPath: plan.relativeDirectory,
    payloadSha256: plan.payloadSha256,
    manifestSha256: generated.manifestSha256,
    fileCount: generated.fileCount
  };
}

async function main() {
  try {
    console.log(JSON.stringify(await prepareImport(), null, 2));
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "PREPARE_IMPORT_FAILED";
    console.error(`${code}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
