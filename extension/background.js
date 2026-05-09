const DEFAULT_SETTINGS = {
  connectionMode: "extension",
  openaiApiKey: "",
  openaiOrganization: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  translationModel: "gpt-realtime-translate",
  // Text mode (cheap pipeline) models. Whisper for streaming
  // transcription + a small chat model for the translation pass.
  transcriptionModel: "gpt-realtime-whisper",
  textTranslationModel: "gpt-4o-mini",
  backendUrl: "http://127.0.0.1:8799",
  bridgeToken: "",
  sourceLanguage: "auto",
  targetLanguage: "en",
  translationVoice: "marin",
  translationMode: "sync",
  originalVolume: 18,
  translationVolume: 100,
  showSource: false,
  // When true, on Stop the bar generates a .txt of source + target
  // transcript and triggers a browser download to Downloads. Off by
  // default — opt-in via the settings panel toggle.
  autoSaveTranscript: false,
  // Pipeline: "voice" (realtime audio) or "text" (captions only).
  mode: "voice"
};

const LANGUAGE_NAMES = {
  af: "Afrikaans",
  ar: "Arabic",
  az: "Azerbaijani",
  be: "Belarusian",
  bg: "Bulgarian",
  bs: "Bosnian",
  ca: "Catalan",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  el: "Greek",
  en: "English",
  et: "Estonian",
  fa: "Persian",
  fi: "Finnish",
  de: "German",
  es: "Spanish",
  fr: "French",
  gl: "Galician",
  he: "Hebrew",
  hi: "Hindi",
  hr: "Croatian",
  hu: "Hungarian",
  hy: "Armenian",
  id: "Indonesian",
  is: "Icelandic",
  it: "Italian",
  ja: "Japanese",
  kk: "Kazakh",
  kn: "Kannada",
  ko: "Korean",
  lt: "Lithuanian",
  lv: "Latvian",
  mi: "Maori",
  mk: "Macedonian",
  mr: "Marathi",
  ms: "Malay",
  ne: "Nepali",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sl: "Slovenian",
  sr: "Serbian",
  sv: "Swedish",
  sw: "Swahili",
  ta: "Tamil",
  th: "Thai",
  tl: "Tagalog",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  vi: "Vietnamese",
  zh: "Chinese"
};
void chrome.storage.local
  .setAccessLevel?.({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
  .catch(() => {});

const state = {
  running: false,
  connecting: false,
  tabId: null,
  status: "Ready",
  sourceText: "",
  targetText: "",
  history: [],
  ...DEFAULT_SETTINGS
};

let startInFlight = false;
const CLIENT_SECRET_MIN_TTL_MS = 30_000;
const clientSecretCache = new Map();
const clientSecretPreparations = new Map();

function clearClientSecretCaches() {
  clientSecretCache.clear();
  clientSecretPreparations.clear();
}

function bridgeHeaders(settings = state, headers = {}) {
  const token = String(settings.bridgeToken || "").trim();
  return token ? { ...headers, "X-Sotto-Bridge-Token": token } : headers;
}

function openAIHeaders(settings = {}, headers = {}) {
  const apiKey = String(settings.openaiApiKey || "").trim();
  const organization = String(settings.openaiOrganization || "").trim();
  return {
    ...headers,
    Authorization: `Bearer ${apiKey}`,
    ...(organization ? { "OpenAI-Organization": organization } : {})
  };
}

function trace(type, details = {}) {
  const backendUrl = String(state.backendUrl || DEFAULT_SETTINGS.backendUrl).replace(/\/$/, "");
  void fetch(`${backendUrl}/api/realtime/translations/trace`, {
    method: "POST",
    headers: bridgeHeaders(state, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      source: "background",
      type,
      running: state.running,
      connecting: state.connecting,
      tabId: state.tabId,
      targetLanguage: state.targetLanguage,
      translationVoice: state.translationVoice,
      ...details
    })
  }).catch(() => {});
}

async function openDirectTranslationSdp({ offerSdp, settings }) {
  if (!offerSdp || typeof offerSdp !== "string") {
    throw new Error("Missing SDP offer.");
  }

  const nextSettings = cleanSettings({ ...state, ...settings });
  trace("direct_sdp.client_secret_requested", {
    targetLanguage: nextSettings.targetLanguage,
    translationVoice: nextSettings.translationVoice,
    translationMode: nextSettings.translationMode,
    offerChars: offerSdp.length
  });

  const secretPayload = await getTranslationClientSecret(nextSettings);
  trace("direct_sdp.client_secret_ready", {
    targetLanguage: secretPayload.targetLanguage || nextSettings.targetLanguage,
    translationVoice: secretPayload.voice || nextSettings.translationVoice,
    cacheHit: Boolean(secretPayload.cacheHit),
    clientSecretRequestId: secretPayload.clientSecretRequestId || null
  });

  let sdpResponse;
  try {
    sdpResponse = await fetch(secretPayload.callsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretPayload.clientSecret}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp"
      },
      body: offerSdp
    });
  } catch (error) {
    throw new Error(
      error?.message || "Could not reach the realtime translation endpoint."
    );
  }
  const answerSdp = await sdpResponse.text();
  let errorPreview = null;
  if (!sdpResponse.ok) {
    errorPreview = answerSdp.slice(0, 700);
  }
  trace("direct_sdp.answer", {
    status: sdpResponse.status,
    ok: sdpResponse.ok,
    targetLanguage: secretPayload.targetLanguage || nextSettings.targetLanguage,
    translationVoice: secretPayload.voice || nextSettings.translationVoice,
    callsUrl: secretPayload.callsUrl,
    answerChars: answerSdp.length,
    errorPreview,
    clientSecretRequestId: secretPayload.clientSecretRequestId || null
  });

  if (!sdpResponse.ok) {
    let errorPayload = {};
    try {
      errorPayload = answerSdp ? JSON.parse(answerSdp) : {};
    } catch {
      errorPayload = {};
    }
    throw new Error(
      errorPayload.error?.message ||
        errorPayload.message ||
        answerSdp ||
        "Could not open realtime translation."
    );
  }

  return {
    answerSdp,
    targetLanguage: secretPayload.targetLanguage || nextSettings.targetLanguage,
    translationVoice: secretPayload.voice || nextSettings.translationVoice,
    model: secretPayload.model,
    clientSecretRequestId: secretPayload.clientSecretRequestId || null
  };
}

// ===========================================================
// Text-mode pipeline (cheap):
//   1. Streaming transcription via gpt-realtime-whisper (WebRTC,
//      same SDP shape as the translate flow but with a transcription
//      session config).
//   2. Per-segment translation via gpt-4o-mini chat completions.
//
// Voice-mode machinery above is left untouched — text-mode just
// branches around it.
// ===========================================================

function buildTranscriptionSessionConfig(settings = {}) {
  const { sourceLanguage } = normalizeTranslationLanguages(settings);
  const transcriptionModel =
    settings.transcriptionModel || DEFAULT_SETTINGS.transcriptionModel;
  const transcription = { model: transcriptionModel };
  // Only pass a language hint when the user picked a real source
  // language; "auto" lets Whisper detect.
  if (sourceLanguage && sourceLanguage !== "auto") {
    transcription.language = sourceLanguage;
  }
  // gpt-realtime-whisper rejects turn_detection — segment boundaries
  // are decided by the model itself.
  return {
    type: "transcription",
    audio: {
      input: {
        transcription
      }
    }
  };
}

async function fetchTranscriptionClientSecret(settings) {
  const nextSettings = cleanSettings(settings);
  if (!nextSettings.openaiApiKey) {
    throw new Error("Add your OpenAI API key in SaySame settings before starting.");
  }
  const baseUrl = nextSettings.openaiBaseUrl.replace(/\/$/, "");
  const sessionConfig = buildTranscriptionSessionConfig(nextSettings);

  let secretResponse;
  try {
    secretResponse = await fetch(`${baseUrl}/realtime/client_secrets`, {
      method: "POST",
      headers: openAIHeaders(nextSettings, {
        "Content-Type": "application/json",
        Accept: "application/json"
      }),
      body: JSON.stringify({ session: sessionConfig })
    });
  } catch {
    throw new Error("Could not reach OpenAI to create a transcription session.");
  }

  const { text, payload } = await parseJsonResponse(secretResponse);
  if (!secretResponse.ok) {
    throw new Error(
      payload.error?.message ||
        payload.message ||
        text ||
        "Could not create an OpenAI transcription client secret."
    );
  }
  // The Realtime ephemeral-secret response shape uses `value` for
  // the secret (same as the translate endpoint).
  const clientSecret =
    payload?.value || payload?.client_secret?.value || payload?.client_secret;
  if (!clientSecret) {
    throw new Error("OpenAI transcription client secret response was incomplete.");
  }

  return {
    clientSecret,
    callsUrl: `${baseUrl}/realtime/calls`,
    transcriptionModel: nextSettings.transcriptionModel,
    clientSecretRequestId: secretResponse.headers.get("x-request-id")
  };
}

async function openTranscriptionSdp({ offerSdp, settings }) {
  if (!offerSdp || typeof offerSdp !== "string") {
    throw new Error("Missing transcription SDP offer.");
  }
  const nextSettings = cleanSettings({ ...state, ...settings });
  trace("text_mode.client_secret_requested", {
    sourceLanguage: nextSettings.sourceLanguage,
    targetLanguage: nextSettings.targetLanguage,
    transcriptionModel: nextSettings.transcriptionModel,
    offerChars: offerSdp.length
  });

  const secretPayload = await fetchTranscriptionClientSecret(nextSettings);
  trace("text_mode.client_secret_ready", {
    transcriptionModel: secretPayload.transcriptionModel,
    clientSecretRequestId: secretPayload.clientSecretRequestId || null
  });

  let sdpResponse;
  try {
    sdpResponse = await fetch(secretPayload.callsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretPayload.clientSecret}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp"
      },
      body: offerSdp
    });
  } catch (error) {
    throw new Error(
      error?.message || "Could not reach the realtime transcription endpoint."
    );
  }

  const answerSdp = await sdpResponse.text();
  trace("text_mode.sdp_answer", {
    status: sdpResponse.status,
    ok: sdpResponse.ok,
    answerChars: answerSdp.length,
    errorPreview: sdpResponse.ok ? null : answerSdp.slice(0, 700),
    clientSecretRequestId: secretPayload.clientSecretRequestId || null
  });

  if (!sdpResponse.ok) {
    let errorPayload = {};
    try { errorPayload = answerSdp ? JSON.parse(answerSdp) : {}; } catch {}
    throw new Error(
      errorPayload.error?.message ||
        errorPayload.message ||
        answerSdp ||
        "Could not open transcription session."
    );
  }

  return {
    answerSdp,
    transcriptionModel: secretPayload.transcriptionModel,
    clientSecretRequestId: secretPayload.clientSecretRequestId || null
  };
}

async function translateTextSegment({
  segment,
  sourceLanguage,
  targetLanguage,
  settings
}) {
  const nextSettings = cleanSettings({ ...state, ...settings });
  if (!nextSettings.openaiApiKey) {
    throw new Error("Add your OpenAI API key in SaySame settings before starting.");
  }
  const trimmed = String(segment || "").trim();
  if (!trimmed) {
    return { translatedText: "" };
  }

  const baseUrl = nextSettings.openaiBaseUrl.replace(/\/$/, "");
  const sourceName =
    sourceLanguage && sourceLanguage !== "auto"
      ? LANGUAGE_NAMES[sourceLanguage] || sourceLanguage
      : "the detected source language";
  const targetName =
    LANGUAGE_NAMES[targetLanguage] ||
    targetLanguage ||
    LANGUAGE_NAMES[DEFAULT_SETTINGS.targetLanguage];
  const model = nextSettings.textTranslationModel || DEFAULT_SETTINGS.textTranslationModel;

  trace("text_mode.translate_request", {
    model,
    sourceLanguage: sourceLanguage || "auto",
    targetLanguage,
    segmentChars: trimmed.length
  });

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: openAIHeaders(nextSettings, {
        "Content-Type": "application/json",
        Accept: "application/json"
      }),
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a real-time translator for live video subtitles. Translate the user's input from " +
              sourceName +
              " into " +
              targetName +
              ". Output ONLY the translated sentence — no preamble, no quotes, no explanation. Keep it natural and concise."
          },
          { role: "user", content: trimmed }
        ]
      })
    });
  } catch {
    throw new Error("Could not reach OpenAI to translate the segment.");
  }

  const { text, payload } = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        payload.message ||
        text ||
        "Translation request failed."
    );
  }
  const translatedText =
    payload?.choices?.[0]?.message?.content?.trim?.() || "";

  trace("text_mode.translate_response", {
    model,
    targetLanguage,
    translatedChars: translatedText.length
  });

  return { translatedText };
}

function clientSecretCacheKey(settings = {}) {
  const nextSettings = cleanSettings(settings);
  return [
    nextSettings.connectionMode,
    nextSettings.backendUrl,
    nextSettings.openaiApiKey ? "extension-key-present" : "extension-key-missing",
    nextSettings.openaiOrganization ? "org-present" : "org-missing",
    nextSettings.bridgeToken ? "bridge-token-present" : "bridge-token-missing",
    nextSettings.sourceLanguage,
    nextSettings.targetLanguage,
    nextSettings.translationVoice,
    nextSettings.translationMode
  ].join("|");
}

function expiresAtMs(expiresAt) {
  if (!expiresAt) return Date.now() + 120_000;
  if (typeof expiresAt === "number") {
    return expiresAt > 1_000_000_000_000 ? expiresAt : expiresAt * 1000;
  }
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) ? parsed : Date.now() + 120_000;
}

function cachedSecretIsFresh(entry) {
  return Boolean(
    entry?.clientSecret &&
      entry?.callsUrl &&
      entry.expiresAtMs - Date.now() > CLIENT_SECRET_MIN_TTL_MS
  );
}

function normalizeLanguage(value, fallbackCode) {
  if (!value || typeof value !== "string") return fallbackCode;
  const normalized = value.trim().toLowerCase();
  if (normalized === "detect" || normalized === "automatic") return "auto";
  return normalized === "auto" || LANGUAGE_NAMES[normalized]
    ? normalized
    : value.trim();
}

function normalizeTranslationLanguages(settings = {}) {
  return {
    sourceLanguage: normalizeLanguage(settings.sourceLanguage, "auto"),
    targetLanguage: normalizeLanguage(
      settings.targetLanguage,
      DEFAULT_SETTINGS.targetLanguage
    )
  };
}

function buildTranslationSessionConfig(settings = {}) {
  const { targetLanguage } = normalizeTranslationLanguages(settings);
  return {
    model: settings.translationModel || DEFAULT_SETTINGS.translationModel,
    audio: {
      output: {
        language: targetLanguage
      }
    }
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return {
      text,
      payload: text ? JSON.parse(text) : {}
    };
  } catch {
    return { text, payload: {} };
  }
}

async function fetchTranslationClientSecretFromExtension(settings, reason = "sdp") {
  const nextSettings = cleanSettings(settings);
  if (!nextSettings.openaiApiKey) {
    throw new Error("Add your OpenAI API key in SaySame settings before starting.");
  }

  const baseUrl = nextSettings.openaiBaseUrl.replace(/\/$/, "");
  const secretPath = "/realtime/translations/client_secrets";
  const sessionConfig = buildTranslationSessionConfig(nextSettings);

  let secretResponse;
  try {
    secretResponse = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: openAIHeaders(nextSettings, {
        "Content-Type": "application/json",
        Accept: "application/json"
      }),
      body: JSON.stringify({
        session: sessionConfig
      })
    });
  } catch {
    throw new Error("Could not reach OpenAI to create a realtime session.");
  }

  const { text, payload } = await parseJsonResponse(secretResponse);
  if (!secretResponse.ok) {
    throw new Error(
      payload.error?.message ||
        payload.message ||
        text ||
        "Could not create an OpenAI realtime client secret."
    );
  }
  if (!payload?.value) {
    throw new Error("OpenAI realtime client secret response was incomplete.");
  }

  const { sourceLanguage, targetLanguage } =
    normalizeTranslationLanguages(nextSettings);
  const callsPath = "/realtime/translations/calls";

  return {
    clientSecret: payload.value,
    expiresAt: payload.expires_at,
    model: nextSettings.translationModel,
    callsUrl: `${baseUrl}${callsPath}`,
    sourceLanguage,
    targetLanguage,
    voice: nextSettings.translationVoice,
    upstream: callsPath,
    clientSecretRequestId: secretResponse.headers.get("x-request-id"),
    reason,
    expiresAtMs: expiresAtMs(payload.expires_at)
  };
}

async function fetchTranslationClientSecretFromBridge(settings, reason = "sdp") {
  const nextSettings = cleanSettings(settings);
  const backendUrl = String(nextSettings.backendUrl || DEFAULT_SETTINGS.backendUrl).replace(/\/$/, "");

  let secretResponse;
  try {
    secretResponse = await fetch(
      `${backendUrl}/api/realtime/translations/client-secret`,
      {
        method: "POST",
        headers: bridgeHeaders(nextSettings, {
          "Content-Type": "application/json",
          Accept: "application/json"
        }),
        body: JSON.stringify({
          sourceLanguage: nextSettings.sourceLanguage,
          targetLanguage: nextSettings.targetLanguage,
          translationVoice: nextSettings.translationVoice
        })
      }
    );
  } catch (error) {
    throw new Error(
      `SaySame bridge is not reachable at ${backendUrl}. Start the local server, then try again.`
    );
  }
  const secretText = await secretResponse.text();
  let secretPayload = {};
  try {
    secretPayload = secretText ? JSON.parse(secretText) : {};
  } catch {
    secretPayload = {};
  }

  if (!secretResponse.ok) {
    throw new Error(
      secretPayload.error?.message ||
        secretPayload.message ||
        secretText ||
        "Could not create translation client secret."
    );
  }
  if (!secretPayload.clientSecret || !secretPayload.callsUrl) {
    throw new Error("Translation client secret response was incomplete.");
  }

  return {
    ...secretPayload,
    reason,
    expiresAtMs: expiresAtMs(secretPayload.expiresAt)
  };
}

async function fetchTranslationClientSecret(settings, reason = "sdp") {
  const nextSettings = cleanSettings(settings);
  return nextSettings.connectionMode === "bridge"
    ? fetchTranslationClientSecretFromBridge(nextSettings, reason)
    : fetchTranslationClientSecretFromExtension(nextSettings, reason);
}

async function getTranslationClientSecret(settings) {
  const key = clientSecretCacheKey(settings);
  const cached = clientSecretCache.get(key);
  if (cachedSecretIsFresh(cached)) {
    clientSecretCache.delete(key);
    trace("client_secret.cache_hit", {
      targetLanguage: cached.targetLanguage,
      translationVoice: cached.voice || settings.translationVoice || null,
      clientSecretRequestId: cached.clientSecretRequestId || null
    });
    return { ...cached, cacheHit: true };
  }
  clientSecretCache.delete(key);

  const pending = clientSecretPreparations.get(key);
  if (pending) {
    const prepared = await pending;
    if (cachedSecretIsFresh(prepared)) {
      clientSecretCache.delete(key);
      trace("client_secret.warm_wait_hit", {
        targetLanguage: prepared.targetLanguage,
        translationVoice: prepared.voice || settings.translationVoice || null,
        clientSecretRequestId: prepared.clientSecretRequestId || null
      });
      return { ...prepared, cacheHit: true };
    }
  }

  return {
    ...(await fetchTranslationClientSecret(settings, "sdp")),
    cacheHit: false
  };
}

async function prepareTranslationLanguage(settings, targetLanguage, reason = "warm") {
  if (!targetLanguage) return null;
  const nextSettings = cleanSettings({ ...settings, targetLanguage });
  const key = clientSecretCacheKey(nextSettings);
  const cached = clientSecretCache.get(key);
  if (cachedSecretIsFresh(cached)) return cached;
  if (clientSecretPreparations.has(key)) return clientSecretPreparations.get(key);

  const preparation = fetchTranslationClientSecret(nextSettings, reason)
    .then((secretPayload) => {
      clientSecretCache.set(key, secretPayload);
      trace("client_secret.prepared", {
        targetLanguage: secretPayload.targetLanguage || nextSettings.targetLanguage,
        translationVoice: secretPayload.voice || nextSettings.translationVoice,
        reason,
        clientSecretRequestId: secretPayload.clientSecretRequestId || null
      });
      return secretPayload;
    })
    .catch((error) => {
      trace("client_secret.prepare_error", {
        targetLanguage: nextSettings.targetLanguage,
        translationVoice: nextSettings.translationVoice,
        reason,
        errorMessage: error?.message || "Could not prepare language"
      });
      throw error;
    })
    .finally(() => {
      clientSecretPreparations.delete(key);
    });

  clientSecretPreparations.set(key, preparation);
  return preparation;
}

async function prepareTranslationLanguages(settings = {}, targetLanguages = [], reason = "warm") {
  const nextSettings = cleanSettings({ ...state, ...settings });
  const uniqueLanguages = [...new Set(targetLanguages)]
    .filter(Boolean)
    .filter((language) => language !== nextSettings.targetLanguage);
  await Promise.allSettled(
    uniqueLanguages.map((targetLanguage) =>
      prepareTranslationLanguage(nextSettings, targetLanguage, reason)
    )
  );
  return {
    prepared: uniqueLanguages
  };
}

function cleanSettings(settings = {}) {
  const connectionMode =
    settings.connectionMode === "bridge" ? "bridge" : "extension";
  return {
    connectionMode,
    openaiApiKey: String(settings.openaiApiKey || "").trim(),
    openaiOrganization: String(settings.openaiOrganization || "").trim(),
    openaiBaseUrl: String(
      settings.openaiBaseUrl || DEFAULT_SETTINGS.openaiBaseUrl
    ).replace(/\/$/, ""),
    translationModel: String(
      settings.translationModel || DEFAULT_SETTINGS.translationModel
    ).trim(),
    transcriptionModel: String(
      settings.transcriptionModel || DEFAULT_SETTINGS.transcriptionModel
    ).trim(),
    textTranslationModel: String(
      settings.textTranslationModel || DEFAULT_SETTINGS.textTranslationModel
    ).trim(),
    backendUrl: String(settings.backendUrl || DEFAULT_SETTINGS.backendUrl).replace(/\/$/, ""),
    bridgeToken: String(settings.bridgeToken || "").trim(),
    sourceLanguage: settings.sourceLanguage || DEFAULT_SETTINGS.sourceLanguage,
    targetLanguage: settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage,
    translationVoice: cleanVoice(
      settings.translationVoice || settings.voice,
      DEFAULT_SETTINGS.translationVoice
    ),
    translationMode: settings.translationMode === "turns" ? "turns" : "sync",
    // Pipeline mode: "voice" = realtime translate (audio out) /
    // "text" = whisper transcription + chat translation (captions only).
    // Must round-trip through background or the content script
    // silently falls back to voice mode and plays audio.
    mode: settings.mode === "text" ? "text" : "voice",
    originalVolume: clampVolume(settings.originalVolume, DEFAULT_SETTINGS.originalVolume),
    translationVolume: clampVolume(
      settings.translationVolume,
      DEFAULT_SETTINGS.translationVolume
    ),
    showSource: Boolean(settings.showSource)
  };
}

function contentSettings(settings = {}) {
  const safeSettings = { ...settings };
  delete safeSettings.openaiApiKey;
  delete safeSettings.openaiOrganization;
  delete safeSettings.bridgeToken;
  return safeSettings;
}

function cleanVoice(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  return value.trim().toLowerCase() || fallback;
}

function clampVolume(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function replyWith(promise, sendResponse) {
  promise
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      const message = error?.message || "Something went wrong.";
      state.connecting = false;
      state.status = message;
      notifyPopup();
      sendResponse({ ok: false, error: message, state: snapshot() });
    });
  return true;
}

function snapshot() {
  return {
    running: state.running,
    connecting: state.connecting,
    tabId: state.tabId,
    status: state.status,
    sourceText: state.sourceText,
    targetText: state.targetText,
    history: state.history,
    connectionMode: state.connectionMode,
    apiKeyConfigured: Boolean(state.openaiApiKey),
    backendUrl: state.backendUrl,
    sourceLanguage: state.sourceLanguage,
    targetLanguage: state.targetLanguage,
    translationVoice: state.translationVoice,
    translationMode: state.translationMode,
    originalVolume: state.originalVolume,
    translationVolume: state.translationVolume,
    showSource: state.showSource
  };
}

const SUPPORTED_HOST_PATTERN = /^https:\/\/([^/]+\.)?(youtube\.com|xiaohongshu\.com|xhslink\.com|bilibili\.com|douyin\.com|tiktok\.com|twitter\.com|x\.com|vimeo\.com|twitch\.tv|weibo\.com)\//i;

function supportedUrl(url = "") {
  return SUPPORTED_HOST_PATTERN.test(url);
}

function tabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

async function firstSupportedTab() {
  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
  const currentWindowMatch = currentWindowTabs.find((tab) => supportedUrl(tab.url));
  if (currentWindowMatch?.id) return currentWindowMatch;

  const supportedTabs = await chrome.tabs.query({
    url: [
      "https://*.youtube.com/*",
      "https://youtube.com/*",
      "https://*.xiaohongshu.com/*",
      "https://xiaohongshu.com/*",
      "https://*.xhslink.com/*",
      "https://*.bilibili.com/*",
      "https://bilibili.com/*",
      "https://*.douyin.com/*",
      "https://douyin.com/*",
      "https://*.tiktok.com/*",
      "https://tiktok.com/*",
      "https://*.twitter.com/*",
      "https://twitter.com/*",
      "https://*.x.com/*",
      "https://x.com/*",
      "https://*.vimeo.com/*",
      "https://vimeo.com/*",
      "https://*.twitch.tv/*",
      "https://twitch.tv/*",
      "https://*.weibo.com/*",
      "https://weibo.com/*"
    ]
  });
  return supportedTabs.find((tab) => supportedUrl(tab.url)) || null;
}

async function sessionTab() {
  if (!state.tabId) return null;
  try {
    return await chrome.tabs.get(state.tabId);
  } catch {
    return null;
  }
}

async function resolveStartTab(preferredTab) {
  if (preferredTab?.id && supportedUrl(preferredTab.url)) return preferredTab;
  const existingTab = await sessionTab();
  if (existingTab?.id && supportedUrl(existingTab.url)) return existingTab;
  const active = await activeTab().catch(() => null);
  if (active?.id && supportedUrl(active.url)) return active;
  const supportedTab = await firstSupportedTab();
  if (supportedTab?.id) return supportedTab;
  throw new Error("Open a supported video tab (YouTube, Xiaohongshu, Bilibili, Douyin, TikTok, X, Vimeo, Twitch, Weibo) before starting live translation.");
}

async function ensureContentScript(tabId) {
  try {
    await tabMessage(tabId, { type: "CONTENT_PING" });
    return;
  } catch {
    // Content scripts are not guaranteed to be loaded when the popup opens.
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"]
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["text-mode.js", "content.js"]
  });
}

async function relayOverlay() {
  if (!state.tabId) return;
  try {
    await tabMessage(state.tabId, {
      type: "CONTENT_UPDATE",
      state: snapshot()
    });
  } catch {
    // The active page may have navigated away; the popup still reflects state.
  }
}

function notifyPopup() {
  void chrome.runtime.sendMessage({
    type: "BACKGROUND_STATE_UPDATE",
    state: snapshot()
  }).catch(() => {});
}

async function publishState() {
  await relayOverlay();
  notifyPopup();
}

async function startTranslation(settings, preferredTab) {
  if (startInFlight) return { state: snapshot() };
  startInFlight = true;

  try {
    const tab = await resolveStartTab(preferredTab);
    trace("start.requested", {
      preferredTabId: preferredTab?.id || null,
      resolvedTabId: tab.id || null,
      resolvedUrl: tab.url || null,
      requestedTargetLanguage: settings?.targetLanguage || null,
      requestedTranslationVoice: settings?.translationVoice || null
    });
    if (!supportedUrl(tab.url)) {
      throw new Error("Open a supported video tab (YouTube, Xiaohongshu, Bilibili, Douyin, TikTok, X, Vimeo, Twitch, Weibo) before starting live translation.");
    }

    const nextSettings = cleanSettings(settings);
    await chrome.storage.local.set(nextSettings);
    await ensureContentScript(tab.id);

    state.running = false;
    state.connecting = true;
    state.tabId = tab.id;
    state.status = "Starting SaySame";
    state.sourceText = "";
    state.targetText = "";
    state.history = [];
    Object.assign(state, nextSettings);
    await publishState();

    const response = await tabMessage(tab.id, {
      type: "CONTENT_START_PAGE_TRANSLATION",
      settings: contentSettings(nextSettings)
    });

    if (!response?.ok) {
      throw new Error(response?.error || "The page translation session did not start.");
    }

    Object.assign(state, response.state || {});
    state.running = response.state?.running ?? true;
    state.connecting = false;
    state.status = response.state?.status || "Listening";
    notifyPopup();
    return { state: snapshot() };
  } finally {
    startInFlight = false;
  }
}

async function stopTranslation() {
  trace("stop.requested");
  const tabId = state.tabId;
  if (tabId) {
    await tabMessage(tabId, {
      type: "CONTENT_STOP_PAGE_TRANSLATION"
    }).catch(() => {});
  }
  state.running = false;
  state.connecting = false;
  state.tabId = null;
  state.status = "Ready";
  state.sourceText = "";
  state.targetText = "";
  notifyPopup();
  return { state: snapshot() };
}

async function updateSettings(settings, preferredTab) {
  const previousTargetLanguage = state.targetLanguage;
  const previousTranslationVoice = state.translationVoice;
  const previousTranslationMode = state.translationMode;
  const previousConnectionMode = state.connectionMode;
  const previousOpenAIKey = state.openaiApiKey;
  const previousOpenAIOrganization = state.openaiOrganization;
  const previousBridgeToken = state.bridgeToken;
  const preferredTabCanUpdate = Boolean(preferredTab?.id && supportedUrl(preferredTab.url));
  const shouldUpdateLivePage = state.running || state.connecting || preferredTabCanUpdate;
  const nextSettings = cleanSettings({ ...state, ...settings });
  const languageChanged =
    Boolean(settings.targetLanguage) && settings.targetLanguage !== previousTargetLanguage;
  const voiceChanged =
    Boolean(settings.translationVoice || settings.voice) &&
    nextSettings.translationVoice !== previousTranslationVoice;
  const modeChanged =
    Boolean(settings.translationMode) && settings.translationMode !== previousTranslationMode;
  const credentialChanged =
    nextSettings.connectionMode !== previousConnectionMode ||
    nextSettings.openaiApiKey !== previousOpenAIKey ||
    nextSettings.openaiOrganization !== previousOpenAIOrganization ||
    nextSettings.bridgeToken !== previousBridgeToken;
  if (credentialChanged) clearClientSecretCaches();
  Object.assign(state, nextSettings);
  await chrome.storage.local.set(nextSettings);

  if (shouldUpdateLivePage && (languageChanged || voiceChanged || modeChanged)) {
    trace("settings.session_restart", {
      oldTargetLanguage: previousTargetLanguage,
      nextTargetLanguage: nextSettings.targetLanguage,
      oldTranslationVoice: previousTranslationVoice,
      nextTranslationVoice: nextSettings.translationVoice,
      oldTranslationMode: previousTranslationMode,
      nextTranslationMode: nextSettings.translationMode,
      preferredTabId: preferredTab?.id || null
    });
    state.connecting = true;
    state.status = languageChanged
      ? `Switching to ${LANGUAGE_NAMES[nextSettings.targetLanguage] || nextSettings.targetLanguage}`
      : "Switching voice";
    notifyPopup();
  }

  if (shouldUpdateLivePage) {
    const tab = preferredTabCanUpdate ? preferredTab : await resolveStartTab(preferredTab);
    state.tabId = tab.id;
    const response = await tabMessage(tab.id, {
      type: "CONTENT_UPDATE_SETTINGS",
      settings: contentSettings(nextSettings)
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not update translation settings.");
    }
    Object.assign(state, response.state || {});
    notifyPopup();
    return { state: snapshot() };
  }

  await publishState();
  return { state: snapshot() };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return false;

  if (message.type === "GET_STATE") {
    sendResponse({ ok: true, state: snapshot() });
    return false;
  }

  if (message.type === "START_TRANSLATION") {
    trace("message.start_translation", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null,
      requestedTargetLanguage: message.settings?.targetLanguage || null,
      requestedTranslationVoice: message.settings?.translationVoice || null
    });
    return replyWith(startTranslation(message.settings, sender.tab), sendResponse);
  }

  if (message.type === "STOP_TRANSLATION") {
    trace("message.stop_translation", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null
    });
    return replyWith(stopTranslation(), sendResponse);
  }

  if (message.type === "UPDATE_SETTINGS") {
    trace("message.update_settings", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null,
      requestedTargetLanguage: message.settings?.targetLanguage || null,
      requestedTranslationVoice: message.settings?.translationVoice || null
    });
    return replyWith(updateSettings(message.settings, sender.tab), sendResponse);
  }

  if (message.type === "PREPARE_TRANSLATION_LANGUAGES") {
    trace("message.prepare_translation_languages", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null,
      requestedTargetLanguages: message.targetLanguages || [],
      requestedTranslationVoice: message.settings?.translationVoice || null,
      reason: message.reason || "warm"
    });
    return replyWith(
      prepareTranslationLanguages(
        message.settings,
        Array.isArray(message.targetLanguages) ? message.targetLanguages : [],
        message.reason || "warm"
      ),
      sendResponse
    );
  }

  if (message.type === "OPENAI_TRANSCRIPTION_SDP") {
    trace("message.openai_transcription_sdp", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null,
      offerChars: message.offerSdp?.length || 0
    });
    return replyWith(
      openTranscriptionSdp({
        offerSdp: message.offerSdp,
        settings: message.settings
      }),
      sendResponse
    );
  }

  if (message.type === "TRANSLATE_TEXT_SEGMENT") {
    trace("message.translate_text_segment", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null,
      sourceLanguage: message.sourceLanguage || null,
      targetLanguage: message.targetLanguage || null,
      segmentChars: message.segment?.length || 0
    });
    return replyWith(
      translateTextSegment({
        segment: message.segment,
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage,
        settings: message.settings
      }),
      sendResponse
    );
  }

  if (message.type === "OPENAI_TRANSLATION_SDP") {
    trace("message.openai_translation_sdp", {
      senderTabId: sender.tab?.id || null,
      senderUrl: sender.tab?.url || null,
      requestedTargetLanguage: message.settings?.targetLanguage || null,
      requestedTranslationVoice: message.settings?.translationVoice || null,
      offerChars: message.offerSdp?.length || 0
    });
    return replyWith(
      openDirectTranslationSdp({
        offerSdp: message.offerSdp,
        settings: message.settings
      }),
      sendResponse
    );
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== state.tabId) return;
  trace("tab.removed", { removedTabId: tabId });
  void stopTranslation();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== state.tabId || !changeInfo.url) return;
  trace("tab.navigated", {
    tabId,
    nextUrl: changeInfo.url
  });
  void stopTranslation();
});

async function showUnsupportedNotice(tab) {
  if (!tab?.id) {
    return;
  }
  // The tab may be a chrome:// or other restricted URL where scripting isn't allowed.
  // Try to inject a transient toast; if blocked, fall back to a chrome notification.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById("__sotto-toast");
        if (existing) existing.remove();
        const toast = document.createElement("div");
        toast.id = "__sotto-toast";
        toast.textContent =
          "SaySame works on YouTube, Bilibili, TikTok, X, Vimeo, Twitch, Xiaohongshu, Douyin and Weibo. Open one of those to start.";
        Object.assign(toast.style, {
          position: "fixed",
          left: "50%",
          bottom: "32px",
          transform: "translateX(-50%)",
          zIndex: "2147483647",
          maxWidth: "520px",
          padding: "14px 22px",
          borderRadius: "12px",
          background: "rgba(11,12,10,0.94)",
          color: "#F4F1E8",
          font: "500 14px/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          opacity: "0",
          transition: "opacity 200ms ease-out",
          pointerEvents: "none"
        });
        document.documentElement.append(toast);
        requestAnimationFrame(() => {
          toast.style.opacity = "1";
        });
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 220);
        }, 4200);
      }
    });
  } catch (error) {
    trace("action.unsupported_notice_failed", {
      tabId: tab.id,
      url: tab.url,
      errorMessage: error?.message || null
    });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  trace("action.icon_clicked", {
    tabId: tab?.id || null,
    url: tab?.url || null
  });

  if (!tab?.id || !supportedUrl(tab.url)) {
    await showUnsupportedNotice(tab);
    return;
  }

  try {
    await ensureContentScript(tab.id);
    await tabMessage(tab.id, { type: "TOGGLE_BAR" });
  } catch (error) {
    trace("action.toggle_failed", {
      tabId: tab.id,
      errorMessage: error?.message || null
    });
  }
});
