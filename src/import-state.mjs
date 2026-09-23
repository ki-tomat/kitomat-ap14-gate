export class ImportStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ImportStateError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ImportStateError(code, message);
}

function marker(name, value) {
  return `<!-- kitomat:${name}:${value} -->`;
}

function hasMarker(body, name, value) {
  return typeof body === "string" && body.includes(marker(name, value));
}

function payloadHash(body) {
  const matches = [
    ...(typeof body === "string" ? body.matchAll(/<!-- kitomat:payload-sha256:([a-f0-9]{64}) -->/gu) : [])
  ];
  if (matches.length !== 1) {
    fail("INVALID_PR_MARKERS", "Zugeordneter Pull Request enthält keinen eindeutigen Payload-Hash.");
  }
  return matches[0][1];
}

function normalizePullRequest(pullRequest) {
  if (
    pullRequest === null ||
    typeof pullRequest !== "object" ||
    !Number.isSafeInteger(pullRequest.number) ||
    typeof pullRequest.state !== "string" ||
    typeof pullRequest.headRefName !== "string" ||
    typeof pullRequest.url !== "string"
  ) {
    fail("INVALID_PR_DATA", "Pull-Request-Daten sind unvollständig.");
  }
  return pullRequest;
}

export function resolveImportState(plan, { branchNames = [], pullRequests = [], mainArtifactExists = false } = {}) {
  if (!plan || typeof plan !== "object") fail("INVALID_PLAN", "Importplan fehlt.");
  if (!Array.isArray(branchNames) || !Array.isArray(pullRequests)) {
    fail("INVALID_REMOTE_STATE", "Remote-Zustand ist ungültig.");
  }

  const prs = pullRequests.map(normalizePullRequest);
  const artifactPrs = prs.filter((pr) => hasMarker(pr.body, "artifact-id", plan.artifactId));
  const issuePrs = artifactPrs.filter((pr) => hasMarker(pr.body, "issue", plan.issueNumber));

  if (issuePrs.length > 1) {
    fail("AMBIGUOUS_ISSUE_PR", "Für dieses Issue existieren mehrere zugeordnete Pull Requests.");
  }

  if (issuePrs.length === 1) {
    const pr = issuePrs[0];
    if (pr.headRefName !== plan.branch) {
      fail("FOREIGN_PR_BRANCH", "Der zugeordnete Pull Request verwendet eine unerwartete Branch.");
    }
    if (pr.mergedAt) {
      return { mode: "merged", prNumber: pr.number, prUrl: pr.url };
    }
    if (pr.state.toUpperCase() === "CLOSED") {
      return { mode: "closed", prNumber: pr.number, prUrl: pr.url };
    }
    if (pr.state.toUpperCase() !== "OPEN") {
      fail("INVALID_PR_STATE", `Unbekannter Pull-Request-Status: ${pr.state}.`);
    }
    if (!branchNames.includes(plan.branch)) {
      fail("MISSING_OWNED_BRANCH", "Die eindeutig zugeordnete offene Import-Branch fehlt.");
    }

    const previousHash = payloadHash(pr.body);
    if (previousHash === plan.payloadSha256) {
      return { mode: "noop", prNumber: pr.number, prUrl: pr.url, previousHash };
    }
    return { mode: "update", prNumber: pr.number, prUrl: pr.url, previousHash };
  }

  if (mainArtifactExists) return { mode: "main_exists" };
  if (artifactPrs.length > 0) return { mode: "collision" };
  if (branchNames.length === 1 && branchNames[0] === plan.branch) return { mode: "recover" };
  if (branchNames.length > 0) return { mode: "collision" };
  return { mode: "create" };
}
