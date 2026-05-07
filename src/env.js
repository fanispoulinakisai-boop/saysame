import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

const DEFAULT_ENV_FILES = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env")
];

function truthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

if (truthyEnv(process.env.SOTTO_LOAD_PERSONAL_ENV)) {
  DEFAULT_ENV_FILES.unshift(join(homedir(), ".openai", "personal.env"));
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadEnvFiles(paths = DEFAULT_ENV_FILES) {
  for (const path of paths) {
    if (!existsSync(path)) continue;

    const content = readFileSync(path, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
      const equalsIndex = normalized.indexOf("=");
      if (equalsIndex === -1) continue;

      const key = normalized.slice(0, equalsIndex).trim();
      const value = unquote(normalized.slice(equalsIndex + 1));
      if (!key || process.env[key]) continue;

      process.env[key] = value;
    }
  }
}

export function getOpenAIConfig() {
  loadEnvFiles();

  const allowPersonalEnv = truthyEnv(process.env.SOTTO_LOAD_PERSONAL_ENV);
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (allowPersonalEnv ? process.env.OPENAI_PERSONAL_API_KEY : undefined);

  const organization =
    process.env.OPENAI_ORG_ID ||
    process.env.OPENAI_ORGANIZATION ||
    (allowPersonalEnv ? process.env.OPENAI_PERSONAL_ORG_ID : undefined);

  return {
    apiKey,
    organization,
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    translationModel:
      process.env.OPENAI_REALTIME_TRANSLATION_MODEL ||
      process.env.OPENAI_REALTIME_MODEL ||
      "gpt-realtime-translate",
    translationVoice:
      process.env.OPENAI_REALTIME_VOICE ||
      process.env.OPENAI_REALTIME_TRANSLATION_VOICE ||
      "marin"
  };
}

export function requireOpenAIConfig() {
  const config = getOpenAIConfig();
  if (!config.apiKey) {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY in your shell or .env.local."
    );
  }
  return config;
}
