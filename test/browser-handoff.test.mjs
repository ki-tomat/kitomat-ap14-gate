import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildBrowserIssueDraft, copyIssueBody } from "../src/browser-handoff.mjs";
import { buildIssueDraft } from "../src/payload-codec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryUrl = "https://github.com/ki-tomat/kitomat-ap14-gate";

for (const name of ["prompt", "dataset", "industry"]) {
  test(`${name}: Browser-Handoff entspricht bytegenau dem Node-Codec`, async () => {
    const payload = JSON.parse(await readFile(path.join(root, "fixtures", `${name}.json`), "utf8"));
    const browserDraft = buildBrowserIssueDraft(payload, repositoryUrl);
    const nodeDraft = buildIssueDraft(payload, repositoryUrl);
    assert.equal(browserDraft.json, nodeDraft.json);
    assert.equal(browserDraft.base64, nodeDraft.base64);
    assert.equal(browserDraft.body, nodeDraft.body);
    assert.equal(browserDraft.url, nodeDraft.url);
    assert.equal(browserDraft.urlAllowed, nodeDraft.urlAllowed);
  });
}

test("Clipboard-Erfolg wird gemeldet", async () => {
  let copied = "";
  assert.equal(
    await copyIssueBody("Umlaute äöü, Emoji 🍅 und ```Code```", {
      async writeText(value) { copied = value; }
    }),
    true
  );
  assert.equal(copied, "Umlaute äöü, Emoji 🍅 und ```Code```");
});

test("verweigerter Clipboard-Zugriff aktiviert den manuellen Fallback", async () => {
  assert.equal(
    await copyIssueBody("test", { async writeText() { throw new Error("denied"); } }),
    false
  );
  assert.equal(await copyIssueBody("test", undefined), false);
});
