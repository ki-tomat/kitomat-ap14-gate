import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { validatePayload } from "./payload-codec.mjs";

const ARTIFACT_SPECS = Object.freeze({
  prompt: Object.freeze({
    root: "prompts",
    artifactType: "prompt_package",
    legalDisclaimer:
      "Arbeits- und Orientierungshilfe. Keine Rechtsberatung, kein Audit, kein produktives Entscheidungswerkzeug."
  }),
  dataset: Object.freeze({
    root: "datasets",
    artifactType: "dataset_package",
    legalDisclaimer:
      "Synthetisches oder quellenbasiertes Kontextpaket. Nutzung, Lizenz und Aktualität müssen im eigenen Kontext geprüft werden."
  }),
  industry: Object.freeze({
    root: "models",
    artifactType: "model",
    legalDisclaimer:
      "Orientierungshilfe. Keine Rechtsberatung, kein Audit, kein produktives Entscheidungswerkzeug."
  })
});

const ROOT_NAMES = Object.freeze(Object.values(ARTIFACT_SPECS).map((spec) => spec.root));
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAINTAINER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,38}$/;
const MAX_ID_LENGTH = 80;
const POLICY_VALUES = Object.freeze({
  license_status: ["declared", "unclear", "not_applicable"],
  data_risk: ["green", "yellow", "red"],
  ai_act_proximity: [
    "none",
    "transparency",
    "high_risk_adjacent",
    "prohibited_check",
    "unclear"
  ],
  sources_status: ["not_required", "missing", "provided", "checked", "unverified"]
});

export class GeneratorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GeneratorError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeneratorError(code, message);
}

function markdownList(values, emptyText = "Keine Angaben.") {
  if (values.length === 0) return `- ${emptyText}`;
  return values.map((value) => `- ${value}`).join("\n");
}

function fenced(value, language = "text") {
  const longestRun = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}

function yamlScalar(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

function yamlDocument(entries) {
  const lines = [];
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const entry of value) lines.push(`  - ${yamlScalar(entry)}`);
      }
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sourceDocument(sources, sourcesStatus) {
  if (sources.length === 0) {
    return [
      "# Quellen",
      "",
      sourcesStatus === "not_required"
        ? "Für diesen synthetischen Gate-Test sind keine externen Quellen erforderlich."
        : "Für diesen Entwurf wurden noch keine Quellen eingetragen.",
      ""
    ].join("\n");
  }

  return [
    "# Quellen",
    "",
    "Die folgenden Angaben stammen unverändert aus dem geprüften Payload:",
    "",
    fenced(stableJson(sources), "json"),
    ""
  ].join("\n");
}

function failureModesDocument(failureModes) {
  return ["# Failure Modes", "", markdownList(failureModes), ""].join("\n");
}

function metadataEntries(payload, spec) {
  const answers = payload.answers;
  const common = [
    ["id", answers.id],
    ["artifact_type", spec.artifactType],
    ["title", answers.title],
    ["category", answers.category],
    ["status", "draft"],
    ["language", answers.language],
    ["version", "0.1.0"],
    ["maintainer", answers.maintainer],
    ["license", answers.license],
    ["license_status", answers.license_status],
    ["data_risk", answers.data_risk],
    ["human_review_required", true],
    ["ai_act_proximity", answers.ai_act_proximity],
    ["legal_disclaimer", spec.legalDisclaimer],
    ["sources_status", answers.sources_status]
  ];

  if (payload.type === "prompt") {
    return [
      ...common,
      ["target_users", answers.target_users],
      ["use_case", answers.use_case],
      ["required_inputs", answers.required_inputs],
      ["output_format", answers.output_format],
      ["personal_data_possible", answers.personal_data_possible],
      ["evaluation_criteria", answers.evaluation_criteria]
    ];
  }
  if (payload.type === "dataset") {
    return [
      ...common,
      ["linked_artifacts", answers.linked_artifacts],
      ["data_origin", answers.data_origin],
      ["contains_personal_data", answers.contains_personal_data],
      ["contains_sensitive_data", answers.contains_sensitive_data],
      ["sources_date", answers.sources_date],
      ["usage_scope", answers.usage_scope],
      ["release_asset_required", answers.release_asset_required],
      ["release_asset_name", answers.release_asset_name],
      ["release_asset_version", answers.release_asset_version],
      ["release_asset_size_mb", answers.release_asset_size_mb],
      ["release_asset_sha256", answers.release_asset_sha256],
      ["release_asset_url", answers.release_asset_url]
    ];
  }
  return [
    ...common,
    ["model_type", answers.model_type],
    ["target_users", answers.target_users],
    ["use_case", answers.use_case],
    ["required_inputs", answers.required_inputs],
    ["output_format", answers.output_format],
    ["application_scope", answers.application_scope],
    ["framework_references", answers.framework_references],
    ["required_review_level", answers.required_review_level]
  ];
}

function renderPrompt(payload, spec) {
  const a = payload.answers;
  return new Map([
    ["metadata.yml", yamlDocument(metadataEntries(payload, spec))],
    [
      "README.md",
      [
        `# Prompt-Paket: ${a.title}`,
        "",
        "## Zweck",
        "",
        a.use_case,
        "",
        "## Zielgruppe",
        "",
        markdownList(a.target_users),
        "",
        "## Szenario-Triade",
        "",
        "### Positiv",
        "",
        a.scenario_positive,
        "",
        "### Nachbearbeitbar",
        "",
        a.scenario_rework,
        "",
        "### Negativ",
        "",
        a.scenario_negative,
        "",
        "## Trust-Hinweis",
        "",
        "Entwurf mit verpflichtender menschlicher Prüfung; keine automatische fachliche Freigabe.",
        ""
      ].join("\n")
    ],
    ["prompt.md", ["# Prompt", "", fenced(a.prompt_text), ""].join("\n")],
    [
      "evaluation.md",
      [
        "# Evaluation",
        "",
        "## Qualitätskriterien",
        "",
        a.evaluation_criteria,
        "",
        "## Prüfschritte",
        "",
        "- [ ] Ausgabeformat eingehalten",
        "- [ ] Annahmen und Unsicherheiten sichtbar",
        "- [ ] Keine echten personenbezogenen Daten",
        "- [ ] Menschliche Prüfung dokumentiert",
        ""
      ].join("\n")
    ],
    ["failure-modes.md", failureModesDocument(a.failure_modes)],
    ["examples/input-01.md", ["# Beispielinput 01", "", fenced(a.sample_input), ""].join("\n")],
    ["examples/output-01.md", ["# Beispieloutput 01", "", fenced(a.sample_output, "markdown"), ""].join("\n")]
  ]);
}

function renderDataset(payload, spec) {
  const a = payload.answers;
  return new Map([
    ["metadata.yml", yamlDocument(metadataEntries(payload, spec))],
    [
      "README.md",
      [
        `# Datensatz-/Quellenpaket: ${a.title}`,
        "",
        "## Zweck und Material",
        "",
        a.dataset_description,
        "",
        "## Szenario-Triade",
        "",
        "### Positiv",
        "",
        a.scenario_positive,
        "",
        "### Nachbearbeitbar",
        "",
        a.scenario_rework,
        "",
        "### Negativ",
        "",
        a.scenario_negative,
        ""
      ].join("\n")
    ],
    ["sources.md", sourceDocument(a.sources, a.sources_status)],
    [
      "license.md",
      [
        "# Lizenz",
        "",
        `Deklarierte Lizenz: ${a.license}`,
        "",
        "Externe Quellen werden nicht automatisch re-lizenziert. Unklare Lizenzen blockieren Review und Freigabe.",
        ""
      ].join("\n")
    ],
    [
      "usage.md",
      [
        "# Nutzung",
        "",
        "## Geltungsbereich",
        "",
        a.usage_scope,
        "",
        "## Sicherheitsgrenzen",
        "",
        "- Keine echten personenbezogenen oder vertraulichen Daten",
        "- Ergebnisse vor Verwendung menschlich prüfen",
        "- Große Binärdateien ausschließlich über den Release-Asset-Prozess behandeln",
        ""
      ].join("\n")
    ]
  ]);
}

function renderIndustry(payload, spec) {
  const a = payload.answers;
  return new Map([
    ["metadata.yml", yamlDocument(metadataEntries(payload, spec))],
    [
      "README.md",
      [
        `# Modell: ${a.title}`,
        "",
        "## Zweck",
        "",
        a.use_case,
        "",
        "## Zielgruppe",
        "",
        markdownList(a.target_users),
        "",
        "## Ergebnis",
        "",
        a.output_format,
        "",
        "## Grenzen",
        "",
        "Orientierungshilfe mit verpflichtender menschlicher Prüfung; keine automatische Entscheidung über Menschen.",
        ""
      ].join("\n")
    ],
    [
      "model.md",
      [
        "# Model",
        "",
        "## Kurzbeschreibung",
        "",
        a.model_description,
        "",
        "## Erforderliche Eingaben",
        "",
        markdownList(a.required_inputs),
        "",
        "## Anwendungsbereich",
        "",
        a.application_scope,
        ""
      ].join("\n")
    ],
    ["application-guide.md", ["# Application Guide", "", a.application_guide, ""].join("\n")],
    [
      "examples/example-01.md",
      [
        "# Beispielanwendung 01",
        "",
        a.sample_case,
        "",
        "## Positives Szenario",
        "",
        a.scenario_positive,
        "",
        "## Nachbearbeitbares Szenario",
        "",
        a.scenario_rework,
        "",
        "## Negatives Szenario",
        "",
        a.scenario_negative,
        ""
      ].join("\n")
    ],
    ["sources.md", sourceDocument(a.sources, a.sources_status)],
    ["failure-modes.md", failureModesDocument(a.failure_modes)]
  ]);
}

function renderFiles(payload, spec) {
  if (payload.type === "prompt") return renderPrompt(payload, spec);
  if (payload.type === "dataset") return renderDataset(payload, spec);
  return renderIndustry(payload, spec);
}

function assertNoUnsafeControlCharacters(value, location = "payload") {
  if (typeof value === "string" && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    fail("CONTROL_CHARACTER", `${location} enthält ein unzulässiges Steuerzeichen.`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUnsafeControlCharacters(entry, `${location}[${index}]`));
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertNoUnsafeControlCharacters(entry, `${location}.${key}`);
    }
  }
}

function assertGeneratorPolicy(payload) {
  const a = payload.answers;
  if (a.id.length > MAX_ID_LENGTH || !ID_PATTERN.test(a.id)) {
    fail("INVALID_ID", "Artefakt-ID muss ein kleingeschriebener, maximal 80 Zeichen langer Slug sein.");
  }
  if (a.id.includes("replace-with")) {
    fail("PLACEHOLDER_ID", "Artefakt-ID darf keinen Template-Platzhalter enthalten.");
  }
  if (!MAINTAINER_PATTERN.test(a.maintainer) || /^p(?:xx|\d{2})$/i.test(a.maintainer)) {
    fail("INVALID_MAINTAINER", "Maintainer ist ungültig oder noch ein Template-Platzhalter.");
  }
  for (const [field, allowed] of Object.entries(POLICY_VALUES)) {
    if (!allowed.includes(a[field])) {
      fail("INVALID_POLICY_VALUE", `${field} enthält keinen erlaubten Wert.`);
    }
  }

  for (const field of ["title", "category", "language", "maintainer", "license"]) {
    if (/[\r\n]/u.test(a[field])) {
      fail("MULTILINE_STRUCTURAL_FIELD", `${field} darf keinen Zeilenumbruch enthalten.`);
    }
  }
  assertNoUnsafeControlCharacters(payload);
}

function manifestHash(files) {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path, "utf8");
    hash.update("\0");
    hash.update(file.content, "utf8");
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function statIfPresent(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function ensureSafeTypeRoot(repositoryRoot, rootName) {
  const typeRoot = path.join(repositoryRoot, rootName);
  await mkdir(typeRoot, { recursive: true });
  const current = await lstat(typeRoot);
  if (!current.isDirectory() || current.isSymbolicLink()) {
    fail("UNSAFE_OUTPUT_ROOT", `${rootName} muss ein echtes Verzeichnis innerhalb des Repositorys sein.`);
  }

  const resolved = await realpath(typeRoot);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("UNSAFE_OUTPUT_ROOT", `${rootName} verweist außerhalb des Repositorys.`);
  }
  return typeRoot;
}

async function assertNoIdCollision(repositoryRoot, id) {
  for (const rootName of ROOT_NAMES) {
    const candidate = path.join(repositoryRoot, rootName, id);
    if (await statIfPresent(candidate)) {
      fail("ARTIFACT_ID_COLLISION", `Artefakt-ID ${id} existiert bereits unter ${rootName}.`);
    }
  }
}

export function buildFiles(payload) {
  validatePayload(payload);
  assertGeneratorPolicy(payload);
  const spec = ARTIFACT_SPECS[payload.type];
  const relativeDirectory = `${spec.root}/${payload.answers.id}`;

  return [...renderFiles(payload, spec)].map(([relativePath, content]) => ({
    path: `${relativeDirectory}/${relativePath}`,
    content: content.replace(/\r\n?/gu, "\n"),
    binary: false
  }));
}

export function planArtifact(payload) {
  const files = buildFiles(payload);
  const spec = ARTIFACT_SPECS[payload.type];
  const relativeDirectory = `${spec.root}/${payload.answers.id}`;

  return {
    artifactType: spec.artifactType,
    relativeDirectory,
    files,
    manifestSha256: manifestHash(files)
  };
}

export async function generateArtifact(payload, { repositoryRoot }) {
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    fail("INVALID_REPOSITORY_ROOT", "repositoryRoot muss explizit angegeben werden.");
  }

  const plan = planArtifact(payload);
  await mkdir(repositoryRoot, { recursive: true });
  const safeRepositoryRoot = await realpath(repositoryRoot);
  const rootName = plan.relativeDirectory.split("/", 1)[0];
  const typeRoot = await ensureSafeTypeRoot(safeRepositoryRoot, rootName);
  await assertNoIdCollision(safeRepositoryRoot, payload.answers.id);

  const temporaryDirectory = await mkdtemp(path.join(typeRoot, `.kitomat-${payload.answers.id}-`));
  const targetDirectory = path.join(safeRepositoryRoot, plan.relativeDirectory);

  try {
    for (const file of plan.files) {
      const relativePath = path.posix.relative(plan.relativeDirectory, file.path);
      const destination = path.join(temporaryDirectory, relativePath);
      const relative = path.relative(temporaryDirectory, destination);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        fail("UNSAFE_GENERATED_PATH", `Generatorpfad ist nicht erlaubt: ${relativePath}.`);
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.content, { encoding: "utf8", flag: "wx" });
    }
    await rename(temporaryDirectory, targetDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    if (error.code === "EEXIST" || error.code === "ENOTEMPTY") {
      fail("ARTIFACT_ID_COLLISION", `Artefakt-ID ${payload.answers.id} existiert bereits.`);
    }
    throw error;
  }

  return {
    ...plan,
    targetDirectory,
    fileCount: plan.files.length
  };
}

export async function readGeneratedFiles(repositoryRoot, relativeDirectory, relativePaths) {
  const result = new Map();
  for (const relativePath of relativePaths) {
    result.set(
      relativePath,
      await readFile(path.join(repositoryRoot, relativeDirectory, relativePath), "utf8")
    );
  }
  return result;
}
