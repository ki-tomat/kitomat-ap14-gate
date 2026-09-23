import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateArtifact } from "../src/artifact-generator.mjs";
import { prepareImportPlan } from "../src/import-plan.mjs";

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Erforderliche Umgebungsvariable fehlt: ${name}.`);
  return value;
}

async function main() {
  try {
    const event = JSON.parse(await readFile(requireEnvironment("GITHUB_EVENT_PATH"), "utf8"));
    const plan = prepareImportPlan(event, {
      expectedRepository: requireEnvironment("GITHUB_REPOSITORY")
    });
    const generated = await generateArtifact(plan.payload, {
      repositoryRoot: requireEnvironment("GITHUB_WORKSPACE")
    });
    console.log(
      JSON.stringify(
        {
          artifactPath: plan.relativeDirectory,
          manifestSha256: generated.manifestSha256,
          fileCount: generated.fileCount
        },
        null,
        2
      )
    );
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "GENERATE_IMPORT_FAILED";
    console.error(`${code}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
