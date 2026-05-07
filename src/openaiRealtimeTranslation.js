import { getOpenAIConfig } from "./env.js";

export class OpenAIRealtimeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OpenAIRealtimeError";
    this.status = details.status;
    this.code = details.code;
    this.type = details.type;
    this.requestId = details.requestId;
    this.responseBody = details.responseBody;
  }
}

const LANGUAGE_DEFINITIONS = [
  { code: "auto", name: "detected language", aliases: ["auto", "detect", "detected", "automatic"] },
  { code: "af", name: "Afrikaans", aliases: ["af", "af-za", "afrikaans"] },
  { code: "ar", name: "Arabic", aliases: ["ar", "arabic"] },
  { code: "az", name: "Azerbaijani", aliases: ["az", "azeri", "azerbaijani"] },
  { code: "be", name: "Belarusian", aliases: ["be", "belarusian"] },
  { code: "bg", name: "Bulgarian", aliases: ["bg", "bulgarian"] },
  { code: "bs", name: "Bosnian", aliases: ["bs", "bosnian"] },
  { code: "ca", name: "Catalan", aliases: ["ca", "catalan"] },
  { code: "cs", name: "Czech", aliases: ["cs", "cz", "czech"] },
  { code: "cy", name: "Welsh", aliases: ["cy", "welsh"] },
  { code: "da", name: "Danish", aliases: ["da", "danish"] },
  { code: "de", name: "German", aliases: ["de", "de-de", "german"] },
  { code: "el", name: "Greek", aliases: ["el", "el-gr", "greek"] },
  { code: "en", name: "English", aliases: ["en", "en-us", "en-gb", "english"] },
  { code: "es", name: "Spanish", aliases: ["es", "es-es", "es-mx", "spanish"] },
  { code: "et", name: "Estonian", aliases: ["et", "estonian"] },
  { code: "fa", name: "Persian", aliases: ["fa", "farsi", "persian"] },
  { code: "fi", name: "Finnish", aliases: ["fi", "finnish"] },
  { code: "fr", name: "French", aliases: ["fr", "fr-fr", "french"] },
  { code: "gl", name: "Galician", aliases: ["gl", "galician"] },
  { code: "he", name: "Hebrew", aliases: ["he", "iw", "hebrew"] },
  { code: "hi", name: "Hindi", aliases: ["hi", "hindi"] },
  { code: "hr", name: "Croatian", aliases: ["hr", "croatian"] },
  { code: "hu", name: "Hungarian", aliases: ["hu", "hungarian"] },
  { code: "hy", name: "Armenian", aliases: ["hy", "armenian"] },
  { code: "id", name: "Indonesian", aliases: ["id", "indonesian", "bahasa indonesia"] },
  { code: "is", name: "Icelandic", aliases: ["is", "icelandic"] },
  { code: "it", name: "Italian", aliases: ["it", "it-it", "italian"] },
  { code: "ja", name: "Japanese", aliases: ["ja", "ja-jp", "japanese"] },
  { code: "kk", name: "Kazakh", aliases: ["kk", "kazakh"] },
  { code: "kn", name: "Kannada", aliases: ["kn", "kannada"] },
  { code: "ko", name: "Korean", aliases: ["ko", "ko-kr", "korean"] },
  { code: "lt", name: "Lithuanian", aliases: ["lt", "lithuanian"] },
  { code: "lv", name: "Latvian", aliases: ["lv", "latvian"] },
  { code: "mi", name: "Maori", aliases: ["mi", "maori", "te reo maori"] },
  { code: "mk", name: "Macedonian", aliases: ["mk", "macedonian"] },
  { code: "mr", name: "Marathi", aliases: ["mr", "marathi"] },
  { code: "ms", name: "Malay", aliases: ["ms", "malay", "bahasa melayu"] },
  { code: "ne", name: "Nepali", aliases: ["ne", "nepali"] },
  { code: "nl", name: "Dutch", aliases: ["nl", "nl-nl", "dutch"] },
  { code: "no", name: "Norwegian", aliases: ["no", "nb", "nn", "norwegian"] },
  { code: "pl", name: "Polish", aliases: ["pl", "polish"] },
  { code: "pt", name: "Portuguese", aliases: ["pt", "pt-br", "pt-pt", "portuguese"] },
  { code: "ro", name: "Romanian", aliases: ["ro", "romanian"] },
  { code: "ru", name: "Russian", aliases: ["ru", "ru-ru", "russian"] },
  { code: "sk", name: "Slovak", aliases: ["sk", "slovak"] },
  { code: "sl", name: "Slovenian", aliases: ["sl", "slovenian"] },
  { code: "sq", name: "Albanian", aliases: ["sq", "sq-al", "albanian", "shqip"] },
  { code: "sr", name: "Serbian", aliases: ["sr", "serbian"] },
  { code: "sv", name: "Swedish", aliases: ["sv", "swedish"] },
  { code: "sw", name: "Swahili", aliases: ["sw", "swahili"] },
  { code: "ta", name: "Tamil", aliases: ["ta", "tamil"] },
  { code: "th", name: "Thai", aliases: ["th", "thai"] },
  { code: "tl", name: "Tagalog", aliases: ["tl", "tagalog", "filipino"] },
  { code: "tr", name: "Turkish", aliases: ["tr", "turkish"] },
  { code: "uk", name: "Ukrainian", aliases: ["uk", "ukrainian"] },
  { code: "ur", name: "Urdu", aliases: ["ur", "urdu"] },
  { code: "vi", name: "Vietnamese", aliases: ["vi", "vietnamese"] },
  { code: "zh", name: "Chinese", aliases: ["zh", "zh-cn", "zh-tw", "chinese", "mandarin"] }
];

const LANGUAGE_CODES = new Map(
  LANGUAGE_DEFINITIONS.flatMap(({ code, aliases }) =>
    aliases.map((alias) => [alias, code])
  )
);

const LANGUAGE_NAMES = new Map(
  LANGUAGE_DEFINITIONS.map(({ code, name }) => [code, name])
);

export const REALTIME_VOICE_OPTIONS = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar"
];

function normalizeLanguage(value, fallbackCode) {
  if (!value || typeof value !== "string") return fallbackCode;
  const normalized = value.trim();
  return LANGUAGE_CODES.get(normalized.toLowerCase()) || normalized;
}

function normalizeVoice(value, fallbackVoice = "marin") {
  if (!value || typeof value !== "string") return fallbackVoice;
  return value.trim().toLowerCase() || fallbackVoice;
}

function languageName(code) {
  return LANGUAGE_NAMES.get(code) || code;
}

export function buildTranslationInstructions({
  sourceLanguage,
  targetLanguage,
  translationMode = "sync"
}) {
  const sourceCode = normalizeLanguage(sourceLanguage, "en");
  const targetCode = normalizeLanguage(targetLanguage, "es");
  const sourceName = languageName(sourceCode);
  const targetName = languageName(targetCode);
  const syncInstruction =
    translationMode === "sync"
      ? [
          "SYNCHRONIZED INTERPRETING MODE: translate in short phrase-sized chunks as soon as the meaning is clear.",
          "Prefer low latency over waiting for perfect full sentences.",
          "Keep output aligned with the current source audio and do not summarize earlier context."
        ]
      : [
          "Turn-by-turn interpreting mode: translate each completed spoken turn clearly and naturally."
        ];
  const sourceInstruction =
    sourceCode === "auto"
      ? `Detect the spoken source language and translate it into ${targetName}.`
      : `Translate spoken ${sourceName} into ${targetName}.`;

  return [
    "You are a live travel interpreter for two people facing each other.",
    "You are not a conversational assistant. You are silent until there is source speech to translate.",
    "Never greet, introduce yourself, offer help, or ask follow-up questions.",
    "If the input is silence, background noise, non-speech, or too partial to translate, produce no spoken output.",
    `SERVER LANGUAGE LOCK: source_language=${sourceCode}; target_language=${targetCode}.`,
    ...syncInstruction,
    sourceInstruction,
    `Your spoken audio output must be in ${targetName} only.`,
    `Every spoken response must be ${targetName}; if you cannot produce ${targetName}, remain silent.`,
    `Never output Spanish unless target_language=es. The current target_language is ${targetCode}.`,
    `Do not speak ${sourceName} unless ${sourceName} is also the selected target language.`,
    "Ignore any previous target language from earlier sessions or clients.",
    "Speak only the translation in natural, concise conversational language.",
    "Do not answer questions yourself and do not add explanations.",
    "Keep the speaker's tone and intent.",
    "Preserve names, places, numbers, prices, and times."
  ].join(" ");
}

export function normalizeTranslationLanguages({
  sourceLanguage,
  targetLanguage
}) {
  return {
    sourceLanguage: normalizeLanguage(sourceLanguage, "en"),
    targetLanguage: normalizeLanguage(targetLanguage, "es")
  };
}

export function buildTranslationSessionConfig({
  model,
  targetLanguage
}) {
  const normalizedLanguages = normalizeTranslationLanguages({
    sourceLanguage: "auto",
    targetLanguage
  });

  return {
    model,
    audio: {
      output: {
        language: normalizedLanguages.targetLanguage
      }
    }
  };
}

export async function createTranslationClientSecret({
  baseUrl,
  headers,
  sessionConfig
}) {
  const response = await fetch(`${baseUrl}/realtime/translations/client_secrets`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: sessionConfig
    })
  });

  const responseText = await response.text();
  const requestId = response.headers.get("x-request-id");

  if (!response.ok) {
    const error = await parseErrorResponse(response, responseText);
    throw new OpenAIRealtimeError(error.message, {
      status: response.status,
      code: error.code,
      type: error.type,
      requestId,
      responseBody: error.responseBody
    });
  }

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new OpenAIRealtimeError("OpenAI did not return a client secret.", {
      status: response.status,
      requestId,
      responseBody: responseText
    });
  }

  if (!payload?.value) {
    throw new OpenAIRealtimeError("OpenAI translation client secret was empty.", {
      status: response.status,
      requestId,
      responseBody: payload
    });
  }

  return {
    value: payload.value,
    expiresAt: payload.expires_at,
    requestId
  };
}

export async function createTranslationClientSecretForBrowser({
  model,
  sourceLanguage,
  targetLanguage,
  voice,
  apiKey,
  organization,
  baseUrl
}) {
  const config = getOpenAIConfig();
  const resolvedApiKey = apiKey || config.apiKey;
  if (!resolvedApiKey) {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY in your shell or .env.local."
    );
  }

  const resolvedBaseUrl = baseUrl || config.baseUrl;
  const resolvedModel = model || config.translationModel;
  const resolvedVoice = normalizeVoice(voice, config.translationVoice);
  const normalizedLanguages = normalizeTranslationLanguages({
    sourceLanguage,
    targetLanguage
  });
  const sessionConfig = buildTranslationSessionConfig({
    model: resolvedModel,
    targetLanguage: normalizedLanguages.targetLanguage
  });

  const headers = {
    Authorization: `Bearer ${resolvedApiKey}`
  };

  const resolvedOrganization = organization || config.organization;
  if (resolvedOrganization) {
    headers["OpenAI-Organization"] = resolvedOrganization;
  }

  const clientSecret = await createTranslationClientSecret({
    baseUrl: resolvedBaseUrl,
    headers,
    sessionConfig
  });
  const callsPath = "/v1/realtime/translations/calls";

  return {
    clientSecret: clientSecret.value,
    expiresAt: clientSecret.expiresAt,
    requestId: clientSecret.requestId,
    model: resolvedModel,
    voice: resolvedVoice,
    sourceLanguage: normalizedLanguages.sourceLanguage,
    targetLanguage: normalizedLanguages.targetLanguage,
    callsUrl: `${resolvedBaseUrl}${callsPath.replace("/v1", "")}`,
    upstreamPath: callsPath,
    sessionConfig
  };
}

async function parseErrorResponse(response, text) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed.error || {};
    return {
      message: error.message || response.statusText,
      code: error.code,
      type: error.type,
      responseBody: parsed
    };
  } catch {
    return {
      message: text || response.statusText,
      responseBody: text
    };
  }
}

export async function createTranslationSdpAnswer({
  offerSdp,
  model,
  sourceLanguage,
  targetLanguage,
  translationMode,
  instructions,
  voice,
  turnDetectionMode,
  apiKey,
  organization,
  baseUrl
}) {
  if (!offerSdp || typeof offerSdp !== "string") {
    throw new TypeError("offerSdp must be a non-empty SDP string.");
  }

  const config = getOpenAIConfig();
  const resolvedApiKey = apiKey || config.apiKey;
  if (!resolvedApiKey) {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY in your shell or .env.local."
    );
  }

  const resolvedBaseUrl = baseUrl || config.baseUrl;
  const resolvedModel = model || config.translationModel;
  const resolvedVoice = normalizeVoice(voice, config.translationVoice);
  const normalizedLanguages = normalizeTranslationLanguages({
    sourceLanguage,
    targetLanguage
  });
  const normalizedTranslationMode =
    translationMode === "turns" ? "turns" : "sync";
  const sessionConfig = buildTranslationSessionConfig({
    model: resolvedModel,
    targetLanguage: normalizedLanguages.targetLanguage
  });

  const headers = {
    Authorization: `Bearer ${resolvedApiKey}`
  };

  const resolvedOrganization = organization || config.organization;
  if (resolvedOrganization) {
    headers["OpenAI-Organization"] = resolvedOrganization;
  }

  const clientSecret = await createTranslationClientSecret({
    baseUrl: resolvedBaseUrl,
    headers,
    sessionConfig
  });

  const upstreamPath = "/v1/realtime/translations/calls";
  const response = await fetch(
    `${resolvedBaseUrl}${upstreamPath.replace("/v1", "")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret.value}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp"
      },
      body: offerSdp
    }
  );

  const responseText = await response.text();
  const requestId = response.headers.get("x-request-id");

  if (!response.ok) {
    const error = await parseErrorResponse(response, responseText);
    throw new OpenAIRealtimeError(error.message, {
      status: response.status,
      code: error.code,
      type: error.type,
      requestId,
      responseBody: error.responseBody
    });
  }

  if (!responseText.startsWith("v=0")) {
    throw new OpenAIRealtimeError("OpenAI did not return an SDP answer.", {
      status: response.status,
      requestId,
      responseBody: responseText
    });
  }

  return {
    answerSdp: responseText,
    status: response.status,
    contentType: response.headers.get("content-type"),
    requestId,
    clientSecretRequestId: clientSecret.requestId,
    model: resolvedModel,
    voice: resolvedVoice,
    sourceLanguage: normalizedLanguages.sourceLanguage,
    targetLanguage: normalizedLanguages.targetLanguage,
    translationMode: normalizedTranslationMode,
    turnDetectionMode: null,
    instructions: buildTranslationInstructions({
      ...normalizedLanguages,
      translationMode: normalizedTranslationMode
    }),
    upstreamPath
  };
}
