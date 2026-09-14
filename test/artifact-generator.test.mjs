import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import {
  buildFiles,
  generateArtifact,
  GeneratorError,
  readGeneratedFiles
} from "../src/artifact-generator.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.resolve(testDirectory, "..", "fixtures");
const validatorDirectory = path.resolve(testDirectory, "..", "tools", "validators");
const execFileAsync = promisify(execFile);

const EXPECTED_FILES = Object.freeze({
  prompt: [
    "README.md",
    "evaluation.md",
    "examples/input-01.md",
    "examples/output-01.md",
    "failure-modes.md",
    "metadata.yml",
    "prompt.md"
  ],
  dataset: [
    "README.md",
    "license.md",
    "metadata.yml",
    "sources.md",
    "usage.md"
  ],
  industry: [
    "README.md",
    "application-guide.md",
    "examples/example-01.md",
    "failure-modes.md",
    "metadata.yml",
    "model.md",
    "sources.md"
  ]
});

async function loadFixture(name) {
  return JSON.parse(await readFile(path.join(fixtureDirectory, `${name}.json`), "utf8"));
}

async function withTemporaryRepositories(callback) {
  const base = await mkdtemp(path.join(tmpdir(), "kitomat-ap14-generator-"));
  try {
    return await callback(base);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

async function listRelativeFiles(root) {
  const files = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else files.push(relative);
    }
  }
  await walk(root);
  return files.sort();
}

function assertGeneratorError(expectedCode, operation) {
  return assert.rejects(operation, (error) => {
    assert.ok(error instanceof GeneratorError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

for (const fixtureName of ["prompt", "dataset", "industry"]) {
  test(`${fixtureName}: buildFiles liefert die isomorphe AP14-Schnittstelle`, async () => {
    const payload = await loadFixture(fixtureName);
    const files = buildFiles(payload);
    const root = {
      prompt: "prompts",
      dataset: "datasets",
      industry: "models"
    }[fixtureName];
    const prefix = `${root}/${payload.answers.id}/`;

    assert.deepEqual(
      files.map((file) => file.path.slice(prefix.length)).sort(),
      EXPECTED_FILES[fixtureName]
    );
    assert.ok(files.every((file) => file.path.startsWith(prefix)));
    assert.ok(files.every((file) => file.binary === false));
    assert.ok(files.every((file) => typeof file.content === "string"));
  });

  test(`${fixtureName}: nur erwartete Pflichtdateien werden erzeugt`, async () => {
    await withTemporaryRepositories(async (base) => {
      const repositoryRoot = path.join(base, "repository");
      const result = await generateArtifact(await loadFixture(fixtureName), { repositoryRoot });
      const files = await listRelativeFiles(result.targetDirectory);

      assert.deepEqual(files, EXPECTED_FILES[fixtureName]);
      assert.equal(result.fileCount, EXPECTED_FILES[fixtureName].length);
      assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
    });
  });

  test(`${fixtureName}: Ausgabe ist bytegenau deterministisch`, async () => {
    await withTemporaryRepositories(async (base) => {
      const payload = await loadFixture(fixtureName);
      const first = await generateArtifact(payload, { repositoryRoot: path.join(base, "one") });
      const second = await generateArtifact(payload, { repositoryRoot: path.join(base, "two") });
      const paths = EXPECTED_FILES[fixtureName];
      const firstFiles = await readGeneratedFiles(base + "/one", first.relativeDirectory, paths);
      const secondFiles = await readGeneratedFiles(base + "/two", second.relativeDirectory, paths);

      assert.equal(first.manifestSha256, second.manifestSha256);
      assert.deepEqual([...firstFiles], [...secondFiles]);
    });
  });
}

test("Generator normalisiert CRLF und CR auf LF", async () => {
  const payload = await loadFixture("prompt");
  payload.answers.prompt_text = "erste\r\nzweite\rdritte\n";
  const promptFile = buildFiles(payload).find((file) => file.path.endsWith("/prompt.md"));

  assert.equal(promptFile.content.includes("\r"), false);
  assert.ok(promptFile.content.includes("erste\nzweite\ndritte\n"));
});

test("YAML bleibt mit #, Doppelpunkten, Quotes, Umlauten, Listen, Booleans und Leerstrings PyYAML-kompatibel", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("dataset");
    payload.answers.title = "Prüfung #1: ein \"Zitat\" mit Umlauten äöü";
    payload.answers.usage_scope = "Erste Zeile\nZweite Zeile: # sicher";
    payload.answers.linked_artifacts = ["prompt:beispiel#1", "Zitat \"sicher\""];
    const result = await generateArtifact(payload, { repositoryRoot });
    const metadataPath = path.join(result.targetDirectory, "metadata.yml");
    const python = [
      "import json, sys, yaml",
      "with open(sys.argv[1], encoding='utf-8') as handle:",
      "    print(json.dumps(yaml.safe_load(handle), ensure_ascii=False))"
    ].join("\n");
    const { stdout } = await execFileAsync("python3", ["-c", python, metadataPath], {
      encoding: "utf8"
    });
    const metadata = JSON.parse(stdout);

    assert.equal(metadata.title, payload.answers.title);
    assert.equal(metadata.usage_scope, payload.answers.usage_scope);
    assert.deepEqual(metadata.linked_artifacts, payload.answers.linked_artifacts);
    assert.equal(metadata.release_asset_required, false);
    assert.equal(metadata.release_asset_name, "");
  });
});

test("alle drei Fixtures bestehen die lokalen Workflow-Validatoren", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    for (const fixtureName of ["prompt", "dataset", "industry"]) {
      await generateArtifact(await loadFixture(fixtureName), { repositoryRoot });
    }

    const environment = {
      ...process.env,
      KITOMAT_REPOSITORY_ROOT: repositoryRoot
    };
    const results = [];
    for (const scriptName of [
      "validate_metadata.py",
      "validate_completeness.py",
      "pii_heuristic.py"
    ]) {
      results.push(
        await execFileAsync("python3", [path.join(validatorDirectory, scriptName)], {
          encoding: "utf8",
          env: environment
        })
      );
    }

    assert.match(results[0].stdout, /passed for 3 files/);
    assert.match(results[1].stdout, /passed for 3 artifact dirs/);
    assert.match(results[2].stdout, /passed without warnings/);
  });
});

test("zweite Generierung derselben Artefakt-ID wird abgewiesen", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("prompt");
    await generateArtifact(payload, { repositoryRoot });
    await assertGeneratorError("ARTIFACT_ID_COLLISION", () =>
      generateArtifact(payload, { repositoryRoot })
    );
  });
});

test("gleiche Artefakt-ID in einem anderen Typ wird global abgewiesen", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const prompt = await loadFixture("prompt");
    const dataset = await loadFixture("dataset");
    dataset.answers.id = prompt.answers.id;
    await generateArtifact(prompt, { repositoryRoot });
    await assertGeneratorError("ARTIFACT_ID_COLLISION", () =>
      generateArtifact(dataset, { repositoryRoot })
    );
  });
});

test("parallele Generierung derselben ID erzeugt genau ein Artefakt", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("prompt");
    const results = await Promise.allSettled([
      generateArtifact(payload, { repositoryRoot }),
      generateArtifact(payload, { repositoryRoot })
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, "ARTIFACT_ID_COLLISION");
    assert.deepEqual(
      await listRelativeFiles(fulfilled[0].value.targetDirectory),
      EXPECTED_FILES.prompt
    );
  });
});

test("Quellenobjekte werden unabhängig von ihrer Schlüsselreihenfolge deterministisch", async () => {
  await withTemporaryRepositories(async (base) => {
    const firstPayload = await loadFixture("dataset");
    const secondPayload = structuredClone(firstPayload);
    firstPayload.answers.sources = [{ b: "zwei", a: "eins" }];
    secondPayload.answers.sources = [{ a: "eins", b: "zwei" }];
    firstPayload.answers.sources_status = "provided";
    secondPayload.answers.sources_status = "provided";

    const first = await generateArtifact(firstPayload, { repositoryRoot: path.join(base, "one") });
    const second = await generateArtifact(secondPayload, { repositoryRoot: path.join(base, "two") });
    assert.equal(first.manifestSha256, second.manifestSha256);
  });
});

for (const [maliciousId, expectedCode] of [
  ["../../.github/workflows/x.yml", "INVALID_ID"],
  ["/tmp/absolute", "INVALID_ID"],
  [".github", "INVALID_ID"],
  ["replace-with-artifact-id", "PLACEHOLDER_ID"],
  ["a".repeat(81), "INVALID_ID"],
  ["slug\u0000ende", "INVALID_ID"]
]) {
  test(`manipulierte Artefakt-ID wird abgewiesen: ${JSON.stringify(maliciousId)}`, async () => {
    await withTemporaryRepositories(async (repositoryRoot) => {
      const payload = await loadFixture("prompt");
      payload.answers.id = maliciousId;
      await assertGeneratorError(expectedCode, () => generateArtifact(payload, { repositoryRoot }));
      assert.deepEqual(await readdir(repositoryRoot).catch(() => []), []);
    });
  });
}

test("Maintainer-Platzhalter pXX wird abgewiesen", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("prompt");
    payload.answers.maintainer = "pXX";
    await assertGeneratorError("INVALID_MAINTAINER", () =>
      generateArtifact(payload, { repositoryRoot })
    );
  });
});

test("manipuliertes data_risk wird abgewiesen", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("prompt");
    payload.answers.data_risk = "safe";
    await assertGeneratorError("INVALID_POLICY_VALUE", () =>
      generateArtifact(payload, { repositoryRoot })
    );
  });
});

test("NUL- und Steuerzeichen im Inhalt werden abgewiesen", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("prompt");
    payload.answers.prompt_text += "\u0000";
    await assertGeneratorError("CONTROL_CHARACTER", () =>
      generateArtifact(payload, { repositoryRoot })
    );
  });
});

test("Shell- und Workflow-Zeichen bleiben reiner Dateiinhalt", async () => {
  await withTemporaryRepositories(async (repositoryRoot) => {
    const payload = await loadFixture("prompt");
    const literal = "$(touch owned) ${{ github.token }}; `uname`";
    payload.answers.title = literal;
    const result = await generateArtifact(payload, { repositoryRoot });
    const readme = await readFile(path.join(result.targetDirectory, "README.md"), "utf8");

    assert.ok(readme.includes(literal));
    assert.equal(await readFile(path.join(repositoryRoot, "owned")).catch(() => null), null);
  });
});

test("symbolischer Root für den Zieltyp wird abgewiesen", async () => {
  await withTemporaryRepositories(async (base) => {
    const repositoryRoot = path.join(base, "repository");
    const outside = path.join(base, "outside");
    await symlink(outside, path.join(repositoryRoot, "prompts")).catch(async (error) => {
      if (error.code !== "ENOENT") throw error;
      const { mkdir } = await import("node:fs/promises");
      await mkdir(repositoryRoot);
      await mkdir(outside);
      await symlink(outside, path.join(repositoryRoot, "prompts"));
    });

    const payload = await loadFixture("prompt");

    await assertGeneratorError("UNSAFE_OUTPUT_ROOT", () =>
      generateArtifact(payload, { repositoryRoot })
    );
    assert.deepEqual(await readdir(outside), []);
  });
});
