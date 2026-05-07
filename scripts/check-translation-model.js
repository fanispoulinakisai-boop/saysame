import { requireOpenAIConfig } from "../src/env.js";

const config = requireOpenAIConfig();
const targetLanguage = process.argv[2] || "de";

function openAIHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    ...(config.organization
      ? { "OpenAI-Organization": config.organization }
      : {}),
    ...extra
  };
}

async function readResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function summarizeError(payload) {
  if (typeof payload === "string") return payload.slice(0, 300);
  return payload.error?.message || JSON.stringify(payload).slice(0, 300);
}

const response = await fetch(
  `${config.baseUrl}/realtime/translations/client_secrets`,
  {
    method: "POST",
    headers: openAIHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      session: {
        model: config.translationModel,
        audio: {
          output: {
            language: targetLanguage
          }
        }
      }
    })
  }
);

const payload = await readResponse(response);
const ok = response.ok && Boolean(payload.value);
const status = ok ? "PASS" : "FAIL";
const detail = ok
  ? "received translation client secret"
  : summarizeError(payload);

console.log(
  `${status} ${config.translationModel} via /v1/realtime/translations/client_secrets ` +
    `(${response.status}) - ${detail}`
);

if (!ok) process.exitCode = 1;
