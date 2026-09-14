import { createHash } from "node:crypto";
import {
  ACKNOWLEDGEMENT_FIELDS,
  ANSWER_TYPES,
  END_MARKER,
  MAX_ISSUE_BODY_CHARS,
  MAX_PAYLOAD_BYTES,
  MAX_PREFILL_URL_CHARS,
  MAX_SUMMARY_CHARS,
  PAYLOAD_ROLES,
  PAYLOAD_TYPES,
  PAYLOAD_VERSION,
  START_MARKER,
  TOP_LEVEL_FIELDS
} from "./payload-contract.mjs";

export class PayloadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PayloadError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new PayloadError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactFields(value, expectedFields, context) {
  if (!isPlainObject(value)) {
    fail("INVALID_OBJECT", `${context} muss ein Objekt sein.`);
  }

  const actual = Object.keys(value).sort();
  const expected = [...expectedFields].sort();
  const unknown = actual.filter((field) => !expected.includes(field));
  const missing = expected.filter((field) => !actual.includes(field));

  if (unknown.length > 0) {
    fail("UNKNOWN_FIELD", `${context} enthält unbekannte Felder: ${unknown.join(", ")}.`);
  }
  if (missing.length > 0) {
    fail("MISSING_FIELD", `${context} enthält nicht alle Pflichtfelder: ${missing.join(", ")}.`);
  }
}

function assertType(value, expectedType, field) {
  if (expectedType === "array" && !Array.isArray(value)) {
    fail("INVALID_FIELD_TYPE", `${field} muss ein Array sein.`);
  }
  if (
    expectedType === "stringArray" &&
    (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))
  ) {
    fail("INVALID_FIELD_TYPE", `${field} muss ein Array aus Zeichenketten sein.`);
  }
  if (
    expectedType !== "array" &&
    expectedType !== "stringArray" &&
    typeof value !== expectedType
  ) {
    fail("INVALID_FIELD_TYPE", `${field} muss den Typ ${expectedType} haben.`);
  }
}

export function validatePayload(payload) {
  assertExactFields(payload, TOP_LEVEL_FIELDS, "Payload");

  if (payload.v !== PAYLOAD_VERSION) {
    fail("UNSUPPORTED_VERSION", `Payload-Version ${payload.v} wird nicht unterstützt.`);
  }
  if (!PAYLOAD_TYPES.includes(payload.type)) {
    fail("INVALID_TYPE", `Unbekannter Payload-Typ: ${payload.type}.`);
  }
  if (!PAYLOAD_ROLES.includes(payload.role)) {
    fail("INVALID_ROLE", `Unbekannte Rolle: ${payload.role}.`);
  }

  const answerTypes = ANSWER_TYPES[payload.type];
  assertExactFields(payload.answers, Object.keys(answerTypes), "answers");
  for (const [field, expectedType] of Object.entries(answerTypes)) {
    assertType(payload.answers[field], expectedType, `answers.${field}`);
  }

  assertExactFields(
    payload.acknowledgements,
    ACKNOWLEDGEMENT_FIELDS,
    "acknowledgements"
  );
  for (const field of ACKNOWLEDGEMENT_FIELDS) {
    if (payload.acknowledgements[field] !== true) {
      fail("ACKNOWLEDGEMENT_REQUIRED", `acknowledgements.${field} muss true sein.`);
    }
  }

  return payload;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalStringify(payload) {
  validatePayload(payload);
  return canonicalize(payload);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function encodePayload(payload) {
  const json = canonicalStringify(payload);
  const bytes = Buffer.from(json, "utf8");

  if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
    fail(
      "PAYLOAD_TOO_LARGE",
      `Payload hat ${bytes.byteLength} UTF-8-Bytes; erlaubt sind ${MAX_PAYLOAD_BYTES}.`
    );
  }

  const base64 = bytes.toString("base64");
  return {
    json,
    bytes: bytes.byteLength,
    base64,
    block: `${START_MARKER}\n${base64}\n${END_MARKER}`,
    sha256: sha256(bytes)
  };
}

function countOccurrences(text, marker) {
  return text.split(marker).length - 1;
}

function decodeStrictBase64(encoded) {
  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!encoded || encoded.length % 4 !== 0 || !base64Pattern.test(encoded)) {
    fail("INVALID_BASE64", "Payload ist kein gültiges Base64 ohne Zeilenumbruch.");
  }

  const maximumEncodedLength = Math.ceil(MAX_PAYLOAD_BYTES / 3) * 4;
  if (encoded.length > maximumEncodedLength) {
    fail("PAYLOAD_TOO_LARGE", "Base64-Payload überschreitet die 32-KiB-Grenze.");
  }

  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) {
    fail("INVALID_BASE64", "Payload ist nicht kanonisch Base64-kodiert.");
  }
  return bytes;
}

export function decodePayloadFromIssueBody(issueBody) {
  if (typeof issueBody !== "string") {
    fail("INVALID_ISSUE_BODY", "Issue-Body muss eine Zeichenkette sein.");
  }
  if (issueBody.length > MAX_ISSUE_BODY_CHARS) {
    fail(
      "ISSUE_BODY_TOO_LARGE",
      `Issue-Body hat ${issueBody.length} Zeichen; erlaubt sind ${MAX_ISSUE_BODY_CHARS}.`
    );
  }

  const startCount = countOccurrences(issueBody, START_MARKER);
  const endCount = countOccurrences(issueBody, END_MARKER);
  if (startCount !== 1 || endCount !== 1) {
    fail("INVALID_MARKERS", "Issue-Body muss genau ein vollständiges Markerpaar enthalten.");
  }

  const start = issueBody.indexOf(START_MARKER) + START_MARKER.length;
  const end = issueBody.indexOf(END_MARKER);
  if (end <= start) {
    fail("INVALID_MARKERS", "Der Endmarker muss nach dem Startmarker stehen.");
  }

  const encoded = issueBody.slice(start, end).trim();
  if (/\s/.test(encoded)) {
    fail("INVALID_BASE64", "Base64-Payload darf keinen Zeilenumbruch enthalten.");
  }

  const bytes = decodeStrictBase64(encoded);
  if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
    fail(
      "PAYLOAD_TOO_LARGE",
      `Payload hat ${bytes.byteLength} UTF-8-Bytes; erlaubt sind ${MAX_PAYLOAD_BYTES}.`
    );
  }

  let json;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("INVALID_UTF8", "Dekodierter Payload ist kein gültiges UTF-8.");
  }

  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    fail("INVALID_JSON", "Dekodierter Payload ist kein gültiges JSON.");
  }

  validatePayload(payload);
  return {
    payload,
    json,
    bytes: bytes.byteLength,
    base64: encoded,
    sha256: sha256(bytes)
  };
}

export function buildReadableSummary(payload) {
  validatePayload(payload);
  const summary = [
    `KItomat AP14 Gate: ${payload.answers.title}`,
    "",
    `Typ: ${payload.type}`,
    `Rolle: ${payload.role}`,
    `ID: ${payload.answers.id}`
  ].join("\n");

  if (summary.length > MAX_SUMMARY_CHARS) {
    fail(
      "SUMMARY_TOO_LARGE",
      `Zusammenfassung hat ${summary.length} Zeichen; erlaubt sind ${MAX_SUMMARY_CHARS}.`
    );
  }
  return summary;
}

export function buildIssueDraft(payload, repositoryUrl) {
  const encoded = encodePayload(payload);
  const summary = buildReadableSummary(payload);
  const body = `${summary}\n\n${encoded.block}`;

  if (body.length > MAX_ISSUE_BODY_CHARS) {
    fail(
      "ISSUE_BODY_TOO_LARGE",
      `Issue-Body hat ${body.length} Zeichen; erlaubt sind ${MAX_ISSUE_BODY_CHARS}.`
    );
  }

  const title = `AP14 Gate: ${payload.answers.title}`;
  const base = repositoryUrl.replace(/\/$/, "");
  const url = `${base}/issues/new?${new URLSearchParams({ title, body }).toString()}`;

  return {
    ...encoded,
    title,
    summary,
    body,
    url,
    urlAllowed: url.length <= MAX_PREFILL_URL_CHARS
  };
}
