import { buildBrowserIssueDraft, copyIssueBody } from "../src/browser-handoff.mjs";

const REPOSITORY_URL = "https://github.com/ki-tomat/kitomat-ap14-gate";
const fixture = document.querySelector("#fixture");
const issueBody = document.querySelector("#issue-body");
const status = document.querySelector("#status");
const manualHelp = document.querySelector("#manual-help");
const openUrl = document.querySelector("#open-url");
let currentDraft;

async function render() {
  status.textContent = "Testbeitrag wird geladen …";
  manualHelp.hidden = true;
  const response = await fetch(`../fixtures/${fixture.value}.json`);
  if (!response.ok) throw new Error(`Fixture konnte nicht geladen werden (${response.status}).`);
  currentDraft = buildBrowserIssueDraft(await response.json(), REPOSITORY_URL);
  issueBody.value = currentDraft.body;
  document.querySelector("#bytes").textContent = `${currentDraft.bytes} Bytes`;
  document.querySelector("#body-length").textContent = `${currentDraft.body.length} Zeichen`;
  document.querySelector("#url-length").textContent = `${currentDraft.url.length} Zeichen`;
  document.querySelector("#url-state").textContent = currentDraft.urlAllowed
    ? "zulässig (≤ 1.500)"
    : "gesperrt (> 1.500)";
  openUrl.hidden = !currentDraft.urlAllowed;
  openUrl.href = currentDraft.urlAllowed ? currentDraft.url : "#";
  status.textContent = "Testbeitrag bereit. Es wurde nichts veröffentlicht.";
}

fixture.addEventListener("change", () => render().catch(showError));
document.querySelector("#copy").addEventListener("click", async () => {
  const copied = await copyIssueBody(currentDraft.body, navigator.clipboard);
  if (copied) {
    status.textContent = "Issue-Text vollständig in die Zwischenablage kopiert.";
    manualHelp.hidden = true;
  } else {
    issueBody.focus();
    issueBody.select();
    status.textContent = "Automatisches Kopieren ist in diesem Browser nicht verfügbar.";
    manualHelp.hidden = false;
  }
});

function showError(error) {
  status.textContent = `Fehler: ${error.message}`;
}

render().catch(showError);
