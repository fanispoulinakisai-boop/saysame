const DEFAULT_SETTINGS = {
  connectionMode: "extension",
  openaiApiKey: "",
  openaiOrganization: "",
  backendUrl: "http://127.0.0.1:8799",
  bridgeToken: "",
  sourceLanguage: "auto",
  targetLanguage: "de",
  translationVoice: "marin",
  translationMode: "sync",
  originalVolume: 18,
  translationVolume: 100,
  showSource: false
};

const LANGUAGE_OPTIONS = [
  { code: "en", name: "English", common: true },
  { code: "es", name: "Spanish", common: true },
  { code: "fr", name: "French", common: true },
  { code: "de", name: "German", common: true },
  { code: "it", name: "Italian", common: true },
  { code: "ja", name: "Japanese", common: true },
  { code: "ru", name: "Russian", common: true },
  { code: "zh", name: "Chinese", common: true },
  { code: "pt", name: "Portuguese", common: true },
  { code: "ko", name: "Korean", common: true },
  { code: "ar", name: "Arabic", common: true },
  { code: "af", name: "Afrikaans" },
  { code: "az", name: "Azerbaijani" },
  { code: "be", name: "Belarusian" },
  { code: "bg", name: "Bulgarian" },
  { code: "bs", name: "Bosnian" },
  { code: "ca", name: "Catalan" },
  { code: "cs", name: "Czech" },
  { code: "cy", name: "Welsh" },
  { code: "da", name: "Danish" },
  { code: "el", name: "Greek" },
  { code: "et", name: "Estonian" },
  { code: "fa", name: "Persian" },
  { code: "fi", name: "Finnish" },
  { code: "gl", name: "Galician" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "hy", name: "Armenian" },
  { code: "id", name: "Indonesian" },
  { code: "is", name: "Icelandic" },
  { code: "kk", name: "Kazakh" },
  { code: "kn", name: "Kannada" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "mi", name: "Maori" },
  { code: "mk", name: "Macedonian" },
  { code: "mr", name: "Marathi" },
  { code: "ms", name: "Malay" },
  { code: "ne", name: "Nepali" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "ro", name: "Romanian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sr", name: "Serbian" },
  { code: "sv", name: "Swedish" },
  { code: "sw", name: "Swahili" },
  { code: "ta", name: "Tamil" },
  { code: "th", name: "Thai" },
  { code: "tl", name: "Tagalog" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" }
];
const WARM_LANGUAGE_CODES = LANGUAGE_OPTIONS
  .filter(({ common }) => common)
  .map(({ code }) => code);
const VOICE_OPTIONS = [
  { id: "marin", name: "Marin", preferred: true },
  { id: "cedar", name: "Cedar", preferred: true },
  { id: "alloy", name: "Alloy" },
  { id: "ash", name: "Ash" },
  { id: "ballad", name: "Ballad" },
  { id: "coral", name: "Coral" },
  { id: "echo", name: "Echo" },
  { id: "sage", name: "Sage" },
  { id: "shimmer", name: "Shimmer" },
  { id: "verse", name: "Verse" }
];

const elements = {
  targetLanguage: document.querySelector("[data-target-language]"),
  translationVoice: document.querySelector("[data-translation-voice]"),
  openaiApiKey: document.querySelector("[data-openai-api-key]"),
  bridgeMode: document.querySelector("[data-bridge-mode]"),
  bridgeToken: document.querySelector("[data-bridge-token]"),
  startStop: document.querySelector("[data-start-stop]"),
  startLabel: document.querySelector("[data-start-label]"),
  originalVolume: document.querySelector("[data-original-volume]"),
  originalOutput: document.querySelector("[data-original-output]"),
  translationVolume: document.querySelector("[data-translation-volume]"),
  translationOutput: document.querySelector("[data-translation-output]"),
  showSource: document.querySelector("[data-source-visible]"),
  status: document.querySelector("[data-status]"),
  statusDot: document.querySelector("[data-status-dot]")
};

void chrome.storage.local
  .setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" })
  .catch(() => {});

let currentState = {
  running: false,
  connecting: false,
  status: "Ready",
  ...DEFAULT_SETTINGS
};

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function readSettings() {
  const connectionMode = elements.bridgeMode.checked ? "bridge" : "extension";
  return {
    connectionMode,
    openaiApiKey: elements.openaiApiKey.value.trim(),
    openaiOrganization: DEFAULT_SETTINGS.openaiOrganization,
    backendUrl: DEFAULT_SETTINGS.backendUrl,
    bridgeToken: elements.bridgeToken.value.trim(),
    sourceLanguage: DEFAULT_SETTINGS.sourceLanguage,
    targetLanguage: elements.targetLanguage.value,
    translationVoice: elements.translationVoice.value,
    translationMode: "sync",
    originalVolume: Number(elements.originalVolume.value),
    translationVolume: Number(elements.translationVolume.value),
    showSource: elements.showSource.checked
  };
}

function populateLanguages() {
  const commonGroup = document.createElement("optgroup");
  commonGroup.label = "Common";
  const moreGroup = document.createElement("optgroup");
  moreGroup.label = "More languages";

  for (const { code, name, common } of LANGUAGE_OPTIONS) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    (common ? commonGroup : moreGroup).append(option);
  }
  elements.targetLanguage.replaceChildren(commonGroup, moreGroup);
}

function populateVoices() {
  const preferredGroup = document.createElement("optgroup");
  preferredGroup.label = "Best quality";
  const moreGroup = document.createElement("optgroup");
  moreGroup.label = "More voices";

  for (const { id, name, preferred } of VOICE_OPTIONS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    (preferred ? preferredGroup : moreGroup).append(option);
  }
  elements.translationVoice.replaceChildren(preferredGroup, moreGroup);
}

function prepareLanguages(reason = "popup", preferredLanguage, activeLanguage) {
  const settings = readSettings();
  const currentLanguage = activeLanguage || settings.targetLanguage;
  const targetLanguages = [
    preferredLanguage,
    ...WARM_LANGUAGE_CODES
  ].filter(
    (language, index, languages) =>
      language &&
      language !== currentLanguage &&
      languages.indexOf(language) === index
  );
  if (!targetLanguages.length) return;

  void sendMessage({
    type: "PREPARE_TRANSLATION_LANGUAGES",
    settings,
    targetLanguages,
    reason
  }).catch(() => {});
}

function applySettings(settings) {
  elements.bridgeMode.checked =
    (settings.connectionMode || DEFAULT_SETTINGS.connectionMode) === "bridge";
  elements.openaiApiKey.value =
    settings.openaiApiKey || DEFAULT_SETTINGS.openaiApiKey;
  elements.targetLanguage.value = settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage;
  const voice = settings.translationVoice || DEFAULT_SETTINGS.translationVoice;
  elements.translationVoice.value = VOICE_OPTIONS.some(({ id }) => id === voice)
    ? voice
    : DEFAULT_SETTINGS.translationVoice;
  elements.originalVolume.value = settings.originalVolume ?? DEFAULT_SETTINGS.originalVolume;
  elements.translationVolume.value =
    settings.translationVolume ?? DEFAULT_SETTINGS.translationVolume;
  elements.showSource.checked = Boolean(settings.showSource);
  elements.bridgeToken.value = settings.bridgeToken || DEFAULT_SETTINGS.bridgeToken;
  elements.originalOutput.textContent = elements.originalVolume.value;
  elements.translationOutput.textContent = elements.translationVolume.value;
}

function render() {
  elements.startLabel.textContent =
    currentState.running || currentState.connecting ? "Stop" : "Start";
  elements.startStop.classList.toggle("is-live", currentState.running);
  elements.startStop.disabled = currentState.connecting;
  const missingExtensionKey =
    !elements.bridgeMode.checked && !elements.openaiApiKey.value.trim();
  const missingBridgeToken =
    elements.bridgeMode.checked && !elements.bridgeToken.value.trim();
  const idleStatus =
    missingExtensionKey
      ? "Add an OpenAI key to start"
      : missingBridgeToken
        ? "Add a bridge token to start"
        : "Ready";
  elements.status.textContent =
    currentState.status && currentState.status !== "Ready"
      ? currentState.status
      : idleStatus;
  elements.statusDot.dataset.state = currentState.running
    ? "live"
    : currentState.connecting
      ? "connecting"
      : "idle";
}

async function persistAndUpdate() {
  const settings = readSettings();
  await chrome.storage.local.set(settings);
  currentState = { ...currentState, ...settings };

  if (currentState.running || currentState.connecting) {
    const response = await sendMessage({
      type: "UPDATE_SETTINGS",
      settings
    });
    if (response?.state) currentState = { ...currentState, ...response.state };
  }

  render();
}

async function initialize() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  applySettings(stored);

  const response = await sendMessage({ type: "GET_STATE" }).catch(() => null);
  if (response?.state) {
    currentState = { ...currentState, ...stored, ...response.state };
    applySettings(currentState);
  } else {
    currentState = { ...currentState, ...stored };
  }

  render();
}

elements.startStop.addEventListener("click", async () => {
  elements.startStop.disabled = true;
  elements.status.textContent = currentState.running ? "Stopping" : "Starting";

  try {
    const response = await sendMessage({
      type: currentState.running || currentState.connecting
        ? "STOP_TRANSLATION"
        : "START_TRANSLATION",
      settings: readSettings()
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not update live translation.");
    }
    currentState = { ...currentState, ...response.state };
  } catch (error) {
    currentState = {
      ...currentState,
      connecting: false,
      status: error.message || "Could not update live translation."
    };
  }

  render();
});

for (const eventName of ["pointerdown", "focus", "mouseenter"]) {
  elements.targetLanguage.addEventListener(eventName, () => {
    prepareLanguages(`popup_language_${eventName}`);
  });
}

elements.targetLanguage.addEventListener("change", () => {
  prepareLanguages(
    "popup_language_change",
    elements.targetLanguage.value,
    currentState.targetLanguage || DEFAULT_SETTINGS.targetLanguage
  );
  void persistAndUpdate();
});

elements.translationVoice.addEventListener("change", () => {
  void persistAndUpdate();
});

elements.showSource.addEventListener("change", () => {
  void persistAndUpdate();
});

elements.openaiApiKey.addEventListener("change", () => {
  void persistAndUpdate();
});

elements.bridgeMode.addEventListener("change", () => {
  void persistAndUpdate();
});

elements.bridgeToken.addEventListener("change", () => {
  void persistAndUpdate();
});

for (const slider of [elements.originalVolume, elements.translationVolume]) {
  slider.addEventListener("input", () => {
    elements.originalOutput.textContent = elements.originalVolume.value;
    elements.translationOutput.textContent = elements.translationVolume.value;
    void persistAndUpdate();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "BACKGROUND_STATE_UPDATE") return;
  currentState = { ...currentState, ...message.state };
  applySettings(currentState);
  render();
});

populateLanguages();
populateVoices();
void initialize();
