import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildIssueDraft,
  canonicalStringify,
  decodePayloadFromIssueBody,
  encodePayload,
  PayloadError
} from "../src/payload-codec.mjs";
import {
  END_MARKER,
  MAX_ISSUE_BODY_CHARS,
  MAX_PAYLOAD_BYTES,
  START_MARKER
} from "../src/payload-contract.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(repositoryRoot, "fixtures");

async function loadFixture(name = "prompt") {
  return JSON.parse(await readFile(path.join(fixtureDirectory, `${name}.json`), "utf8"));
}

function bodyFromBytes(bytes) {
  return `${START_MARKER}\n${Buffer.from(bytes).toString("base64")}\n${END_MARKER}`;
}

function bodyFromObject(value) {
  return bodyFromBytes(Buffer.from(JSON.stringify(value), "utf8"));
}

function assertPayloadError(expectedCode, operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof PayloadError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

for (const fixtureName of ["prompt", "dataset", "industry"]) {
  test(`${fixtureName}: kanonischer Encode/Decode-Roundtrip`, async () => {
    const payload = await loadFixture(fixtureName);
    const encoded = encodePayload(payload);
    const decoded = decodePayloadFromIssueBody(encoded.block);

    assert.deepEqual(decoded.payload, payload);
    assert.equal(decoded.json, encoded.json);
    assert.equal(decoded.sha256, encoded.sha256);
    assert.ok(decoded.bytes <= MAX_PAYLOAD_BYTES);
  });
}

test("Umlaute, Emoji, Backticks, Codefence, CRLF und LF bleiben erhalten", async () => {
  const payload = await loadFixture();
  const specialText = "äöüß 🍅 `inline`\n```text\nLF\r\nCRLF\n```";
  payload.answers.prompt_text = specialText;

  const decoded = decodePayloadFromIssueBody(encodePayload(payload).block);
  assert.equal(decoded.payload.answers.prompt_text, specialText);
});

test("Issue-Draft blendet eine zu lange Pre-fill-URL aus", async () => {
  const draft = buildIssueDraft(
    await loadFixture(),
    "https://github.com/ki-tomat/kitomat-ap14-gate"
  );
  assert.equal(draft.urlAllowed, false);
  assert.ok(draft.body.includes(START_MARKER));
});

test("Issue-Draft erlaubt eine nachweislich kurze Pre-fill-URL", async () => {
  const payload = await loadFixture();
  for (const [field, value] of Object.entries(payload.answers)) {
    if (typeof value === "string") payload.answers[field] = "x";
    if (Array.isArray(value)) payload.answers[field] = [];
  }

  const draft = buildIssueDraft(
    payload,
    "https://github.com/ki-tomat/kitomat-ap14-gate"
  );
  assert.equal(draft.urlAllowed, true);
  assert.ok(draft.url.length <= 1_500);
});

test("fehlender Startmarker wird abgewiesen", () => {
  assertPayloadError("INVALID_MARKERS", () =>
    decodePayloadFromIssueBody(`AAAA\n${END_MARKER}`)
  );
});

test("fehlender Endmarker wird abgewiesen", () => {
  assertPayloadError("INVALID_MARKERS", () =>
    decodePayloadFromIssueBody(`${START_MARKER}\nAAAA`)
  );
});

test("zwei Markerpaare werden abgewiesen", async () => {
  const block = encodePayload(await loadFixture()).block;
  assertPayloadError("INVALID_MARKERS", () =>
    decodePayloadFromIssueBody(`${block}\n${block}`)
  );
});

test("ungültiges Base64 wird abgewiesen", () => {
  assertPayloadError("INVALID_BASE64", () =>
    decodePayloadFromIssueBody(`${START_MARKER}\n%%%?\n${END_MARKER}`)
  );
});

test("Base64 mit Zeilenumbruch wird abgewiesen", () => {
  assertPayloadError("INVALID_BASE64", () =>
    decodePayloadFromIssueBody(`${START_MARKER}\nQUJD\nREVG\n${END_MARKER}`)
  );
});

test("ungültiges UTF-8 wird abgewiesen", () => {
  assertPayloadError("INVALID_UTF8", () =>
    decodePayloadFromIssueBody(bodyFromBytes(Buffer.from([0xc3, 0x28])))
  );
});

test("ungültiges JSON wird abgewiesen", () => {
  assertPayloadError("INVALID_JSON", () =>
    decodePayloadFromIssueBody(bodyFromBytes(Buffer.from("{", "utf8")))
  );
});

test("unbekannte Version wird abgewiesen", async () => {
  const payload = await loadFixture();
  payload.v = 2;
  assertPayloadError("UNSUPPORTED_VERSION", () =>
    decodePayloadFromIssueBody(bodyFromObject(payload))
  );
});

test("unbekanntes Top-Level-Feld wird abgewiesen", async () => {
  const payload = await loadFixture();
  payload.unexpected = true;
  assertPayloadError("UNKNOWN_FIELD", () =>
    decodePayloadFromIssueBody(bodyFromObject(payload))
  );
});

test("unbekanntes Antwortfeld wird abgewiesen", async () => {
  const payload = await loadFixture();
  payload.answers.unexpected = true;
  assertPayloadError("UNKNOWN_FIELD", () =>
    decodePayloadFromIssueBody(bodyFromObject(payload))
  );
});

test("fehlendes Pflichtfeld wird abgewiesen", async () => {
  const payload = await loadFixture();
  delete payload.answers.title;
  assertPayloadError("MISSING_FIELD", () =>
    decodePayloadFromIssueBody(bodyFromObject(payload))
  );
});

test("falscher Datentyp wird abgewiesen", async () => {
  const payload = await loadFixture();
  payload.answers.id = 42;
  assertPayloadError("INVALID_FIELD_TYPE", () =>
    decodePayloadFromIssueBody(bodyFromObject(payload))
  );
});

test("fehlende Bestätigung wird abgewiesen", async () => {
  const payload = await loadFixture();
  payload.acknowledgements.public_content_confirmed = false;
  assertPayloadError("ACKNOWLEDGEMENT_REQUIRED", () =>
    decodePayloadFromIssueBody(bodyFromObject(payload))
  );
});

test("Payload über 32 KiB wird vor JSON-Parsing abgewiesen", () => {
  const oversized = Buffer.alloc(MAX_PAYLOAD_BYTES + 1, 0x61);
  assertPayloadError("PAYLOAD_TOO_LARGE", () =>
    decodePayloadFromIssueBody(bodyFromBytes(oversized))
  );
});

test("gültiger Payload mit exakt 32 KiB wird akzeptiert", async () => {
  const payload = await loadFixture();
  payload.answers.prompt_text = "";
  const baseBytes = Buffer.byteLength(canonicalStringify(payload), "utf8");
  payload.answers.prompt_text = "a".repeat(MAX_PAYLOAD_BYTES - baseBytes);

  const encoded = encodePayload(payload);
  assert.equal(encoded.bytes, MAX_PAYLOAD_BYTES);
  assert.equal(decodePayloadFromIssueBody(encoded.block).bytes, MAX_PAYLOAD_BYTES);
});

test("gültig aufgebauter Payload über 32 KiB wird beim Kodieren abgewiesen", async () => {
  const payload = await loadFixture();
  payload.answers.prompt_text = "";
  const baseBytes = Buffer.byteLength(canonicalStringify(payload), "utf8");
  payload.answers.prompt_text = "a".repeat(MAX_PAYLOAD_BYTES - baseBytes + 1);

  assertPayloadError("PAYLOAD_TOO_LARGE", () => encodePayload(payload));
});

test("Issue-Body mit exakt 55.000 Zeichen wird akzeptiert", async () => {
  const block = encodePayload(await loadFixture()).block;
  const body = `${"x".repeat(MAX_ISSUE_BODY_CHARS - block.length)}${block}`;

  assert.equal(body.length, MAX_ISSUE_BODY_CHARS);
  assert.equal(decodePayloadFromIssueBody(body).payload.type, "prompt");
});

test("Issue-Body über 55.000 Zeichen wird abgewiesen", async () => {
  const block = encodePayload(await loadFixture()).block;
  const body = `${"x".repeat(MAX_ISSUE_BODY_CHARS - block.length + 1)}${block}`;

  assertPayloadError("ISSUE_BODY_TOO_LARGE", () => decodePayloadFromIssueBody(body));
});
