import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateArtifact } from "../src/artifact-generator.mjs";

const allowedFixtures = new Set(["prompt", "dataset", "industry"]);
const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsByName.set(process.argv[index], process.argv[index + 1]);
}

const fixtureName = argumentsByName.get("--fixture");
const repositoryRootArgument = argumentsByName.get("--repository-root");
if (!allowedFixtures.has(fixtureName) || !repositoryRootArgument) {
  console.error(
    "Nutzung: node scripts/generate-fixture.mjs --fixture prompt|dataset|industry --repository-root <Testverzeichnis>"
  );
  process.exitCode = 2;
} else {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.join(scriptDirectory, "..", "fixtures", `${fixtureName}.json`);
  const payload = JSON.parse(await readFile(fixturePath, "utf8"));
  const result = await generateArtifact(payload, {
    repositoryRoot: path.resolve(repositoryRootArgument)
  });
  console.log(
    JSON.stringify(
      {
        relativeDirectory: result.relativeDirectory,
        fileCount: result.fileCount,
        manifestSha256: result.manifestSha256
      },
      null,
      2
    )
  );
}
