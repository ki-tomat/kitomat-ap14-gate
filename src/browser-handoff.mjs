import {
  END_MARKER,
  MAX_ISSUE_BODY_CHARS,
  MAX_PAYLOAD_BYTES,
  MAX_PREFILL_URL_CHARS,
  MAX_SUMMARY_CHARS,
  START_MARKER
} from "./payload-contract.mjs";

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildBrowserIssueDraft(payload, repositoryUrl) {
  const json = canonicalize(payload);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`Payload überschreitet ${MAX_PAYLOAD_BYTES} UTF-8-Bytes.`);
  }

  const summary = [
    `KItomat AP14 Gate: ${payload.answers.title}`,
    "",
    `Typ: ${payload.type}`,
    `Rolle: ${payload.role}`,
    `ID: ${payload.answers.id}`
  ].join("\n");
  if (summary.length > MAX_SUMMARY_CHARS) throw new Error("Zusammenfassung ist zu lang.");

  const base64 = bytesToBase64(bytes);
  const block = `${START_MARKER}\n${base64}\n${END_MARKER}`;
  const body = `${summary}\n\n${block}`;
  if (body.length > MAX_ISSUE_BODY_CHARS) throw new Error("Issue-Body ist zu lang.");

  const title = `AP14 Gate: ${payload.answers.title}`;
  const url = `${repositoryUrl.replace(/\/$/u, "")}/issues/new?${new URLSearchParams({ title, body })}`;
  return {
    json,
    bytes: bytes.byteLength,
    base64,
    block,
    title,
    summary,
    body,
    url,
    urlAllowed: url.length <= MAX_PREFILL_URL_CHARS
  };
}

export async function copyIssueBody(body, clipboard) {
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(body);
    return true;
  } catch {
    return false;
  }
}
