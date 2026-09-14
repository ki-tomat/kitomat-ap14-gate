import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildIssueDraft } from "../src/payload-codec.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const fixtureDirectory = path.join(repositoryRoot, "fixtures");
const repositoryUrl = "https://github.com/ki-tomat/kitomat-ap14-gate";

const fixtureFiles = (await readdir(fixtureDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();

console.log(
  "| Typ | JSON UTF-8 | Base64 | Zusammenfassung | Issue-Body | vollständige URL | URL zulässig? |"
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: | --- |");

for (const fixtureFile of fixtureFiles) {
  const fixturePath = path.join(fixtureDirectory, fixtureFile);
  const payload = JSON.parse(await readFile(fixturePath, "utf8"));
  const draft = buildIssueDraft(payload, repositoryUrl);
  const typeLabel = {
    dataset: "Dataset",
    industry: "Branchenmodell",
    prompt: "Prompt"
  }[payload.type];

  console.log(
    `| ${typeLabel} | ${draft.bytes} B | ${draft.base64.length} Zeichen | ${draft.summary.length} Zeichen | ${draft.body.length} Zeichen | ${draft.url.length} Zeichen | ${draft.urlAllowed ? "ja" : "nein"} |`
  );
}
