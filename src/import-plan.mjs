import { decodePayloadFromIssueBody, PayloadError } from "./payload-codec.mjs";

export const IMPORT_LABEL = "webui-import";

const LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const BRANCH_PREFIX = Object.freeze({
  prompt: "prompt",
  dataset: "dataset",
  industry: "model"
});

export class ImportPlanError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ImportPlanError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ImportPlanError(code, message);
}

function assertLogin(value, field) {
  if (typeof value !== "string" || !LOGIN_PATTERN.test(value)) {
    fail("INVALID_EVENT_LOGIN", `${field} enthält keinen gültigen GitHub-Login.`);
  }
}

export function prepareImportPlan(event, { expectedRepository } = {}) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    fail("INVALID_EVENT", "GitHub-Ereignis muss ein Objekt sein.");
  }
  if (event.action !== "labeled") {
    fail("INVALID_EVENT_ACTION", "Nur das Ereignis issues.labeled ist zulässig.");
  }
  if (event.label?.name !== IMPORT_LABEL) {
    fail("INVALID_IMPORT_LABEL", `Nur das Label ${IMPORT_LABEL} darf den Import auslösen.`);
  }
  if (!Number.isSafeInteger(event.issue?.number) || event.issue.number <= 0) {
    fail("INVALID_ISSUE_NUMBER", "Issue-Nummer fehlt oder ist ungültig.");
  }
  if (event.issue?.state !== "open") {
    fail("ISSUE_NOT_OPEN", "Nur ein offenes Issue darf einen Import auslösen.");
  }
  if (typeof event.issue?.body !== "string") {
    fail("INVALID_ISSUE_BODY", "Issue-Body fehlt im Label-Ereignis.");
  }
  if (typeof event.repository?.full_name !== "string") {
    fail("INVALID_EVENT_REPOSITORY", "Repository fehlt im GitHub-Ereignis.");
  }
  if (expectedRepository && event.repository.full_name !== expectedRepository) {
    fail("REPOSITORY_MISMATCH", "GitHub-Ereignis gehört nicht zum erwarteten Repository.");
  }

  assertLogin(event.sender?.login, "sender.login");
  assertLogin(event.issue?.user?.login, "issue.user.login");

  let decoded;
  try {
    decoded = decodePayloadFromIssueBody(event.issue.body);
  } catch (error) {
    if (error instanceof PayloadError) {
      fail(`PAYLOAD_${error.code}`, error.message);
    }
    throw error;
  }

  const payload = decoded.payload;
  const issueNumber = event.issue.number;
  const artifactPath = {
    prompt: "prompts",
    dataset: "datasets",
    industry: "models"
  }[payload.type];
  const relativeDirectory = `${artifactPath}/${payload.answers.id}`;
  const branchFamily = `${BRANCH_PREFIX[payload.type]}/${payload.answers.id}-i`;
  const branch = `${branchFamily}${issueNumber}`;

  return {
    payload,
    issueNumber,
    issueUrl: event.issue.html_url ?? "",
    issueAuthor: event.issue.user.login,
    labelActor: event.sender.login,
    repository: event.repository.full_name,
    payloadSha256: decoded.sha256,
    type: payload.type,
    dataRisk: payload.answers.data_risk,
    artifactId: payload.answers.id,
    selfReportedMaintainer: payload.answers.maintainer,
    relativeDirectory,
    branchFamily,
    branch,
    pullRequestTitle: `AP14 import: ${payload.answers.id}`
  };
}

export function buildPullRequestBody(plan) {
  return [
    `Closes #${plan.issueNumber}`,
    "",
    "## Automatisch vorbereiteter AP14-Beitrag",
    "",
    `- Issue-Autor: @${plan.issueAuthor}`,
    `- Label vergeben von: @${plan.labelActor}`,
    `- Eingetragener Maintainer (Selbstauskunft): ${plan.selfReportedMaintainer}`,
    `- Typ: ${plan.type}`,
    `- Zielpfad: \`${plan.relativeDirectory}/\``,
    "- Status: `draft`",
    `- Datenrisiko: \`${plan.dataRisk}\``,
    `- Payload-SHA-256: \`${plan.payloadSha256}\``,
    "",
    `<!-- kitomat:payload-sha256:${plan.payloadSha256} -->`,
    `<!-- kitomat:issue:${plan.issueNumber} -->`,
    `<!-- kitomat:artifact-id:${plan.artifactId} -->`,
    "",
    "## Menschliche Prüfung",
    "",
    "- [ ] Inhalt fachlich geprüft",
    "- [ ] Trust- und Datenschutzprüfung abgeschlossen",
    "- [ ] Lizenz- und Quellenstatus geprüft",
    "",
    "Diese Checkboxen werden bewusst nicht automatisch abgehakt.",
    ""
  ].join("\n");
}
