const LANGUAGES = {
  en: {
    label: "English",
    apiCode: "en",
    apiLanguage: "English",
    recognitionCode: "en-US"
  },
  sq: {
    label: "Albanian",
    apiCode: "sq",
    apiLanguage: "Albanian",
    recognitionCode: "sq-AL"
  },
  es: {
    label: "Spanish",
    apiCode: "es",
    apiLanguage: "Spanish",
    recognitionCode: "es-ES"
  },
  fr: {
    label: "French",
    apiCode: "fr",
    apiLanguage: "French",
    recognitionCode: "fr-FR"
  },
  de: {
    label: "German",
    apiCode: "de",
    apiLanguage: "German",
    recognitionCode: "de-DE"
  },
  it: {
    label: "Italian",
    apiCode: "it",
    apiLanguage: "Italian",
    recognitionCode: "it-IT"
  },
  ja: {
    label: "Japanese",
    apiCode: "ja",
    apiLanguage: "Japanese",
    recognitionCode: "ja-JP"
  },
  ru: {
    label: "Russian",
    apiCode: "ru",
    apiLanguage: "Russian",
    recognitionCode: "ru-RU"
  }
};

const SOURCE_TURN_LIMIT = 170;
const TRANSLATION_TURN_LIMIT = 235;

const state = {
  sourceLanguage: "en",
  targetLanguage: "es",
  sourceText: "Your words will appear here.",
  sourceTranscript: "",
  translation: "Translation will appear here.",
  targetTranscript: "",
  heldTranslation: "",
  streamingTranslation: "",
  phase: "idle",
  isConnecting: false,
  isConnected: false,
  isSpeaking: false,
  isMuted: false,
  peerConnection: undefined,
  dataChannel: undefined,
  localStream: undefined,
  remoteAudio: undefined,
  speechRecognition: undefined,
  speechRecognitionRestartTimer: undefined,
  sourceCaptionsUnavailable: false,
  wakeLock: undefined,
  disconnectTimer: undefined,
  sessionToken: 0
};

const elements = {
  source: document.querySelector("[data-source]"),
  translation: document.querySelector("[data-translation]"),
  recipientPanel: document.querySelector(".recipient-panel"),
  shell: document.querySelector(".app-shell"),
  sourceRegion: document.querySelector(".source-region"),
  sourceLanguage: document.querySelector('[data-action="source-language"]'),
  sourceLanguageLabel: document.querySelector("[data-source-language-label]"),
  targetLanguage: document.querySelector('[data-action="target-language"]'),
  targetLanguageLabel: document.querySelector("[data-target-language-label]"),
  mic: document.querySelector('[data-action="mic"]'),
  micLabel: document.querySelector("[data-mic-label]"),
  status: document.querySelector("[data-status]"),
  outStatus: document.querySelector("[data-out-status]"),
  audioStatus: document.querySelector(".audio-status"),
  orientationToggle: document.querySelector('[data-action="toggle-recipient-orientation"]'),
  pauseMic: document.querySelector('[data-action="pause-mic"]'),
  pauseLabel: document.querySelector("[data-pause-label]"),
  clear: document.querySelector('[data-action="clear"]'),
  languageTemplate: document.querySelector("#languageMenuTemplate")
};

let fitFrame = undefined;
let recipientFacesUser = false;

function language(code) {
  return LANGUAGES[code] || LANGUAGES.en;
}

function apiLanguage(code) {
  return language(code).apiLanguage;
}

function apiLanguageCode(code) {
  return language(code).apiCode;
}

function recognitionLanguageCode(code) {
  return language(code).recognitionCode || "en-US";
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function normalizeTurnText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function readableTurnPreview(text, maxChars) {
  const normalized = normalizeTurnText(text);
  if (normalized.length <= maxChars) return normalized;

  const slice = normalized.slice(-maxChars);
  const boundary = slice.search(/[\s,.;:!?]/);
  const clipped =
    boundary > 18 && boundary < slice.length - 30
      ? slice.slice(boundary + 1)
      : slice;
  return `…${clipped.trimStart()}`;
}

function sourcePreview(text) {
  return readableTurnPreview(text, SOURCE_TURN_LIMIT);
}

function translationPreview(text) {
  return readableTurnPreview(text, TRANSLATION_TURN_LIMIT);
}

function activeTranslationText() {
  return (
    state.streamingTranslation ||
    state.heldTranslation ||
    state.translation ||
    "Translation will appear here."
  );
}

function beginTranslationTurn() {
  state.streamingTranslation = "";
  state.targetTranscript = "";
  state.translation = state.heldTranslation ? "" : "Translating…";
}

function appendTranslationDelta(delta) {
  if (!state.streamingTranslation && state.phase !== "speaking") {
    beginTranslationTurn();
  }
  state.streamingTranslation = `${state.streamingTranslation}${delta}`;
  state.targetTranscript = state.streamingTranslation;
}

function holdTranslation(text) {
  const normalized = normalizeTurnText(text || state.streamingTranslation);
  if (normalized) {
    state.heldTranslation = normalized;
  }
  state.streamingTranslation = "";
  state.targetTranscript = "";
}

function setStatus(message, { error = false } = {}) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", error);
}

function formatStartupErrorMessage(rawMessage) {
  if (!rawMessage) return "Could not start live translation.";

  try {
    const payload = JSON.parse(rawMessage);
    const message = payload?.error?.message || payload?.message;
    if (message) return `Translation stream failed: ${message}`;
  } catch {
    // Keep the original message when it is not JSON from the local bridge.
  }

  return rawMessage;
}

function shellWidth() {
  return elements.shell?.clientWidth || window.innerWidth;
}

function shellHeight() {
  return elements.shell?.clientHeight || window.innerHeight;
}

function fitTextInside(element, container, { max, min }) {
  if (!element || !container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  if (!containerWidth || !containerHeight) return;

  let size = Math.round(max);
  element.style.fontSize = `${size}px`;
  if (element instanceof HTMLTextAreaElement) {
    element.style.height = "auto";
  }

  while (
    size > min &&
    (element.scrollHeight > containerHeight + 1 ||
      element.scrollWidth > containerWidth + 1)
  ) {
    size -= 2;
    element.style.fontSize = `${size}px`;
    if (element instanceof HTMLTextAreaElement) {
      element.style.height = "auto";
    }
  }

  if (element instanceof HTMLTextAreaElement) {
    element.style.height = `${Math.min(element.scrollHeight, containerHeight)}px`;
  }
}

function fitVisualText() {
  const compactHeight = shellHeight() <= 760;
  const translationMax = compactHeight
    ? Math.min(40, shellWidth() * 0.102)
    : Math.min(48, shellWidth() * 0.112);
  const sourceMax = compactHeight
    ? Math.min(32, shellWidth() * 0.083)
    : Math.min(38, shellWidth() * 0.09);

  fitTextInside(elements.translation, elements.translation.parentElement, {
    max: translationMax,
    min: 19
  });
  fitTextInside(elements.source, elements.sourceRegion, {
    max: sourceMax,
    min: 18
  });
}

function scheduleTextFit() {
  if (fitFrame) window.cancelAnimationFrame(fitFrame);
  fitFrame = window.requestAnimationFrame(() => {
    fitFrame = undefined;
    fitVisualText();
  });
}

function render() {
  elements.source.value = state.sourceText;
  const shownTranslation = activeTranslationText();
  elements.translation.textContent = translationPreview(shownTranslation);
  if (elements.sourceLanguageLabel) {
    elements.sourceLanguageLabel.textContent = language(state.sourceLanguage).label;
  } else {
    elements.sourceLanguage.textContent = language(state.sourceLanguage).label;
  }
  if (elements.targetLanguageLabel) {
    elements.targetLanguageLabel.textContent = language(state.targetLanguage).label;
  } else {
    elements.targetLanguage.textContent = language(state.targetLanguage).label;
  }
  elements.mic.classList.toggle("is-listening", state.isConnected);
  elements.mic.classList.toggle("is-connecting", state.isConnecting);
  elements.mic.classList.toggle("is-muted", state.isMuted);
  elements.audioStatus.dataset.speaking = String(state.isSpeaking);
  elements.audioStatus.dataset.phase = state.phase;
  elements.translation.parentElement.dataset.displayState = state.phase;
  elements.translation.parentElement.dataset.heldTurn = String(
    !state.streamingTranslation && Boolean(state.heldTranslation)
  );
  elements.recipientPanel.classList.toggle("is-self-facing", recipientFacesUser);

  if (elements.orientationToggle) {
    elements.orientationToggle.setAttribute("aria-pressed", String(recipientFacesUser));
    elements.orientationToggle.setAttribute(
      "aria-label",
      recipientFacesUser
        ? "Show companion panel upside down"
        : "Show companion panel facing you"
    );
    elements.orientationToggle.title = recipientFacesUser
      ? "Face this side toward my companion"
      : "Face this side toward me";
  }

  if (elements.pauseMic) {
    elements.pauseMic.setAttribute("aria-pressed", String(state.isMuted));
    elements.pauseMic.disabled = !state.isConnected;
    elements.pauseMic.setAttribute(
      "aria-label",
      state.isMuted ? "Resume microphone" : "Pause microphone"
    );
  }

  if (elements.pauseLabel) {
    elements.pauseLabel.textContent = state.isMuted ? "Resume" : "Pause";
  }

  if (state.isConnecting) {
    elements.micLabel.textContent = "Opening";
  } else if (state.isConnected && state.isMuted) {
    elements.micLabel.textContent = "End";
  } else if (state.isConnected) {
    elements.micLabel.textContent = "End";
  } else {
    elements.micLabel.textContent = "Start";
  }

  elements.mic.setAttribute(
    "aria-label",
    state.isConnected || state.isConnecting
      ? "End live translation"
      : "Start live translation"
  );

  if (state.isSpeaking) {
    elements.outStatus.textContent = "Speaking";
  } else if (state.isConnecting) {
    elements.outStatus.textContent = "Connecting";
  } else if (state.isConnected && state.isMuted) {
    elements.outStatus.textContent = "Paused";
  } else if (state.isConnected) {
    elements.outStatus.textContent =
      state.phase === "translating" ? "Translating" : "Listening";
  } else {
    elements.outStatus.textContent = "Ready";
  }

  scheduleTextFit();
}

async function requestWakeLock() {
  if (!navigator.wakeLock || state.wakeLock) return;

  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = undefined;
    });
  } catch {
    state.wakeLock = undefined;
  }
}

function releaseWakeLock() {
  const wakeLock = state.wakeLock;
  state.wakeLock = undefined;
  void wakeLock?.release?.().catch(() => {});
}

function ensureRemoteAudio() {
  if (state.remoteAudio) return state.remoteAudio;

  const audio = new Audio();
  audio.autoplay = true;
  audio.playsInline = true;
  audio.addEventListener("playing", () => {
    state.isSpeaking = true;
    render();
  });
  audio.addEventListener("pause", () => {
    state.isSpeaking = false;
    render();
  });
  audio.addEventListener("ended", () => {
    state.isSpeaking = false;
    render();
  });
  document.body.append(audio);
  state.remoteAudio = audio;
  return audio;
}

function waitForIceGatheringComplete(peerConnection, timeoutMs = 5000) {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(done, timeoutMs);

    function done() {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }

    function onChange() {
      if (peerConnection.iceGatheringState === "complete") done();
    }

    peerConnection.addEventListener("icegatheringstatechange", onChange);
  });
}

function applyMicMute() {
  state.localStream?.getAudioTracks().forEach((track) => {
    track.enabled = !state.isMuted;
  });
}

function stopSourceCaptions({ reset = false } = {}) {
  if (state.speechRecognitionRestartTimer) {
    window.clearTimeout(state.speechRecognitionRestartTimer);
    state.speechRecognitionRestartTimer = undefined;
  }

  const recognition = state.speechRecognition;
  state.speechRecognition = undefined;

  if (recognition) {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // Some Web Speech implementations throw when stopped twice.
      }
    }
  }

  if (reset) {
    state.sourceTranscript = "";
    state.sourceCaptionsUnavailable = false;
  }
}

function scheduleSourceCaptionRestart() {
  if (
    state.speechRecognitionRestartTimer ||
    !state.isConnected ||
    state.isMuted ||
    state.sourceCaptionsUnavailable
  ) {
    return;
  }

  state.speechRecognitionRestartTimer = window.setTimeout(() => {
    state.speechRecognitionRestartTimer = undefined;
    startSourceCaptions();
  }, 250);
}

function updateSourceTranscript(transcript) {
  const normalizedTranscript = normalizeTurnText(transcript);
  if (!normalizedTranscript) return;

  state.sourceTranscript = normalizedTranscript;
  state.sourceText = sourcePreview(normalizedTranscript);
  render();
}

function startSourceCaptions() {
  if (
    state.speechRecognition ||
    !state.isConnected ||
    state.isMuted ||
    state.sourceCaptionsUnavailable
  ) {
    return false;
  }

  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    state.sourceCaptionsUnavailable = true;
    state.sourceText = "Speak normally. Source captions are unavailable here.";
    render();
    return false;
  }

  const recognition = new SpeechRecognition();
  const baseTranscript = state.sourceTranscript;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = recognitionLanguageCode(state.sourceLanguage);

  recognition.onresult = (event) => {
    let sessionTranscript = "";

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result[0]?.transcript) continue;
      sessionTranscript = `${sessionTranscript} ${result[0].transcript}`;
    }

    updateSourceTranscript(`${baseTranscript} ${sessionTranscript}`);
  };

  recognition.onerror = (event) => {
    if (!state.isConnected || state.isMuted) return;

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.sourceCaptionsUnavailable = true;
      state.sourceText = "Speak normally. Live captions are unavailable here.";
      setStatus("Translation is live. Source captions are unavailable in this browser.");
      render();
      stopSourceCaptions();
      return;
    }

    if (event.error !== "no-speech" && event.error !== "aborted") {
      setStatus("Translation is live. Source captions may lag in this browser.");
    }
  };

  recognition.onend = () => {
    if (state.speechRecognition === recognition) {
      state.speechRecognition = undefined;
    }
    scheduleSourceCaptionRestart();
  };

  state.speechRecognition = recognition;

  try {
    recognition.start();
    return true;
  } catch {
    state.speechRecognition = undefined;
    state.sourceCaptionsUnavailable = true;
    state.sourceText = "Speak normally. Source captions are unavailable here.";
    return false;
  }
}

function stopLiveTranslation({ silent = false } = {}) {
  state.sessionToken += 1;
  const dataChannel = state.dataChannel;
  const peerConnection = state.peerConnection;
  const localStream = state.localStream;

  stopSourceCaptions({ reset: true });

  if (state.disconnectTimer) {
    window.clearTimeout(state.disconnectTimer);
    state.disconnectTimer = undefined;
  }

  if (state.remoteAudio) {
    state.remoteAudio.pause();
    state.remoteAudio.srcObject = null;
    state.remoteAudio.load();
  }

  state.dataChannel = undefined;
  state.peerConnection = undefined;
  state.localStream = undefined;
  state.isConnecting = false;
  state.isConnected = false;
  state.isSpeaking = false;
  state.isMuted = false;
  state.phase = "idle";
  state.sourceText = "Your words will appear here.";
  state.sourceTranscript = "";
  state.translation = "Translation will appear here.";
  state.targetTranscript = "";
  state.heldTranslation = "";
  state.streamingTranslation = "";

  releaseWakeLock();
  dataChannel?.close();
  peerConnection?.close();
  localStream?.getTracks().forEach((track) => track.stop());

  if (!silent) {
    setStatus("Live translation stopped.");
  }
  render();
}

function handleRealtimeEvent(rawMessage, sessionToken) {
  if (sessionToken !== state.sessionToken) return;

  let event;
  try {
    event = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (
    (event.type === "response.audio_transcript.delta" ||
      event.type === "response.output_audio_transcript.delta") &&
    event.delta
  ) {
    state.phase = "speaking";
    state.isSpeaking = true;
    appendTranslationDelta(event.delta);
    render();
    return;
  }

  if (
    (event.type === "response.audio_transcript.done" ||
      event.type === "response.output_audio_transcript.done") &&
    event.transcript
  ) {
    state.phase = state.isMuted ? "muted" : "listening";
    state.isSpeaking = false;
    holdTranslation(event.transcript);
    render();
    return;
  }

  if (event.type?.includes("speech_started")) {
    state.phase = "listening";
    state.isSpeaking = false;
    if (state.streamingTranslation) {
      holdTranslation(state.streamingTranslation);
    }
    state.translation = state.heldTranslation ? "" : "Listening…";
    state.sourceTranscript = "";
    state.sourceText = state.sourceTranscript || "Listening…";
    render();
    return;
  }

  if (event.type?.includes("speech_stopped")) {
    state.phase = "translating";
    state.translation = "Translating…";
    render();
    return;
  }

  if (
    event.type === "response.created" ||
    event.type === "response.output_item.added" ||
    event.type === "response.content_part.added"
  ) {
    state.phase = "translating";
    beginTranslationTurn();
    render();
    return;
  }

  if (
    event.type === "response.output_audio.done" ||
    event.type === "response.audio.done" ||
    event.type === "response.output_item.done" ||
    event.type === "response.content_part.done" ||
    event.type === "response.cancelled" ||
    event.type === "response.done"
  ) {
    state.isSpeaking = false;
    state.phase = state.isMuted ? "muted" : "listening";
    if (state.streamingTranslation) {
      holdTranslation(state.streamingTranslation);
    }
    if (!state.heldTranslation) {
      state.translation = "Listening…";
    }
    render();
    return;
  }

  const sourceTranscript =
    event.transcript ||
    event.item?.content?.find?.((content) => content.transcript)?.transcript;

  if (
    sourceTranscript &&
    (event.type?.includes("input_audio_transcription") ||
      event.type?.includes("transcription"))
  ) {
    updateSourceTranscript(sourceTranscript);
  }
}

function handlePeerState(peerConnection, sessionToken, sourceLanguage) {
  if (sessionToken !== state.sessionToken) return;

  const stateName = peerConnection.connectionState;
  if (stateName === "connected") {
    if (state.disconnectTimer) {
      window.clearTimeout(state.disconnectTimer);
      state.disconnectTimer = undefined;
    }
    state.isConnecting = false;
    state.isConnected = true;
    state.phase = state.isMuted ? "muted" : "listening";
    state.sourceText = state.sourceTranscript || "Listening…";
    state.translation = "Waiting for translation…";
    startSourceCaptions();
    setStatus("Live Translator open. Speak naturally.");
    render();
  }

  if (stateName === "disconnected") {
    state.phase = "connecting";
    setStatus("Connection interrupted. Trying to stay live...");
    render();

    if (!state.disconnectTimer) {
      state.disconnectTimer = window.setTimeout(() => {
        if (
          sessionToken === state.sessionToken &&
          peerConnection.connectionState === "disconnected"
        ) {
          stopLiveTranslation({ silent: true });
          setStatus("Live connection dropped. Start again when ready.", {
            error: true
          });
        }
      }, 5000);
    }
  }

  if (stateName === "failed" || stateName === "closed") {
    stopLiveTranslation({ silent: true });
    setStatus("Live connection dropped. Start again when ready.", { error: true });
  }
}

async function startLiveTranslation() {
  if (state.isConnecting || state.isConnected) return;

  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    setStatus("This browser cannot start a WebRTC microphone session here.", {
      error: true
    });
    return;
  }

  state.sessionToken += 1;
  const sessionToken = state.sessionToken;
  const sourceLanguage = state.sourceLanguage;
  const targetLanguage = state.targetLanguage;

  state.isConnecting = true;
  state.phase = "connecting";
  state.translation = "Opening live interpreter…";
  state.targetTranscript = "";
  state.heldTranslation = "";
  state.streamingTranslation = "";
  state.sourceTranscript = "";
  state.sourceCaptionsUnavailable = false;
  state.sourceText = "Requesting microphone…";
  setStatus("Requesting microphone…");
  render();

  try {
    const peerConnection = new RTCPeerConnection();
    const dataChannel = peerConnection.createDataChannel("oai-events");
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    if (sessionToken !== state.sessionToken) {
      localStream.getTracks().forEach((track) => track.stop());
      peerConnection.close();
      return;
    }

    state.peerConnection = peerConnection;
    state.dataChannel = dataChannel;
    state.localStream = localStream;
    void requestWakeLock();
    applyMicMute();

    dataChannel.addEventListener("open", () => {
      if (sessionToken !== state.sessionToken) return;
      state.phase = state.isMuted ? "muted" : "listening";
      setStatus("Live Translator open. Speak naturally.");
      render();
    });

    dataChannel.addEventListener("message", (event) => {
      handleRealtimeEvent(event.data, sessionToken);
    });

    dataChannel.addEventListener("close", () => {
      if (sessionToken !== state.sessionToken) return;
      if (state.isConnected || state.isConnecting) {
        stopLiveTranslation({ silent: true });
        setStatus("Live translation ended.", { error: true });
      }
    });

    dataChannel.addEventListener("error", () => {
      if (sessionToken !== state.sessionToken) return;
      setStatus("Realtime event channel reported an error.", { error: true });
    });

    peerConnection.addEventListener("connectionstatechange", () => {
      handlePeerState(peerConnection, sessionToken, sourceLanguage);
    });

    peerConnection.addEventListener("track", (event) => {
      if (sessionToken !== state.sessionToken) return;
      const audio = ensureRemoteAudio();
      audio.srcObject = event.streams[0] || new MediaStream([event.track]);
      void audio.play().catch(() => {
        setStatus("Tap Start again if audio playback was blocked.", { error: true });
      });
    });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    setStatus("Opening OpenAI translation stream…");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(peerConnection);

    const url = new URL("/api/realtime/translations/sdp", window.location.origin);
    url.searchParams.set("source_language", apiLanguageCode(sourceLanguage));
    url.searchParams.set("target_language", apiLanguageCode(targetLanguage));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Accept: "application/sdp"
      },
      body: peerConnection.localDescription.sdp
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      throw new Error(
        formatStartupErrorMessage(answerSdp || "OpenAI translation stream failed.")
      );
    }

    if (sessionToken !== state.sessionToken) {
      peerConnection.close();
      localStream.getTracks().forEach((track) => track.stop());
      return;
    }

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: answerSdp
    });

    if (sessionToken !== state.sessionToken) {
      peerConnection.close();
      localStream.getTracks().forEach((track) => track.stop());
      return;
    }

    state.isConnecting = false;
    state.isConnected = true;
    state.phase = state.isMuted ? "muted" : "listening";
    state.sourceText = state.sourceTranscript || "Listening…";
    state.translation = "Waiting for translation…";
    startSourceCaptions();
    setStatus("Live Translator open. Speak naturally.");
    render();
  } catch (error) {
    if (sessionToken !== state.sessionToken) return;
    stopLiveTranslation({ silent: true });
    setStatus(formatStartupErrorMessage(error.message), { error: true });
  }
}

function toggleLiveTranslation() {
  if (state.isConnected || state.isConnecting) {
    stopLiveTranslation();
  } else {
    void startLiveTranslation();
  }
}

function toggleMute() {
  if (!state.isConnected) {
    setStatus("Start live translation before muting the microphone.");
    return;
  }

  state.isMuted = !state.isMuted;
  state.phase = state.isMuted ? "muted" : "listening";
  state.translation = state.isMuted ? "Mic paused." : "Waiting for translation…";
  applyMicMute();
  if (state.isMuted) {
    stopSourceCaptions();
    state.sourceText = state.sourceTranscript || "Mic paused.";
  } else {
    state.sourceText = state.sourceTranscript || "Listening…";
    startSourceCaptions();
  }
  setStatus(state.isMuted ? "Mic paused. Tap Resume to continue." : "Mic live again.");
  render();
}

function toggleRecipientOrientation() {
  recipientFacesUser = !recipientFacesUser;
  render();
}

function clearConversation() {
  const shouldRestartCaptions = state.isConnected && !state.isMuted;
  stopSourceCaptions({ reset: true });
  state.sourceText = state.isConnected ? "Listening…" : "Your words will appear here.";
  state.translation = state.isConnected
    ? "Waiting for translation…"
    : "Translation will appear here.";
  state.targetTranscript = "";
  state.heldTranslation = "";
  state.streamingTranslation = "";
  setStatus(state.isConnected ? "Cleared. Still listening." : "Cleared.");
  if (shouldRestartCaptions) startSourceCaptions();
  render();
}

async function restartIfLive() {
  const wasLive = state.isConnected || state.isConnecting;
  if (!wasLive) return;

  stopLiveTranslation({ silent: true });
  state.sourceText = "Reopening live interpreter…";
  state.translation = "Opening live interpreter…";
  state.phase = "connecting";
  render();
  await startLiveTranslation();
}

function swapLanguages() {
  const oldSource = state.sourceLanguage;
  state.sourceLanguage = state.targetLanguage;
  state.targetLanguage = oldSource;
  state.sourceText = state.isConnected ? "Reopening live interpreter…" : "Your words will appear here.";
  state.translation = state.isConnected ? "Reopening live interpreter…" : "Translation will appear here.";
  state.sourceTranscript = "";
  state.targetTranscript = "";
  state.heldTranslation = "";
  state.streamingTranslation = "";
  state.phase = state.isConnected || state.isConnecting ? "connecting" : "idle";
  setStatus("Language direction swapped.");
  render();
  void restartIfLive();
}

function openLanguageMenu(kind) {
  document.querySelector(".language-menu")?.remove();

  const menu = elements.languageTemplate.content.firstElementChild.cloneNode(true);
  document.body.append(menu);
  menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    const selected = button.dataset.lang;
    if (kind === "source") {
      state.sourceLanguage = selected;
      if (state.sourceLanguage === state.targetLanguage) {
        state.targetLanguage = selected === "en" ? "es" : "en";
      }
    } else {
      state.targetLanguage = selected;
      if (state.sourceLanguage === state.targetLanguage) {
        state.sourceLanguage = selected === "en" ? "es" : "en";
      }
    }
    menu.remove();
    state.sourceText = state.isConnected ? "Reopening live interpreter…" : "Your words will appear here.";
    state.translation = state.isConnected ? "Reopening live interpreter…" : "Translation will appear here.";
    state.sourceTranscript = "";
    state.targetTranscript = "";
    state.heldTranslation = "";
    state.streamingTranslation = "";
    state.phase = state.isConnected || state.isConnecting ? "connecting" : "idle";
    setStatus(
      kind === "source"
        ? `Listening for ${language(state.sourceLanguage).label}. They still hear ${language(state.targetLanguage).label}.`
        : `They will hear ${language(state.targetLanguage).label}.`
    );
    render();
    void restartIfLive();
  });
}

function wireEvents() {
  elements.source.readOnly = true;

  elements.mic.addEventListener("click", toggleLiveTranslation);
  elements.orientationToggle?.addEventListener("click", toggleRecipientOrientation);
  elements.pauseMic?.addEventListener("click", toggleMute);
  elements.clear?.addEventListener("click", clearConversation);

  document.querySelector('[data-action="swap"]').addEventListener("click", swapLanguages);

  elements.sourceLanguage.addEventListener("click", () => openLanguageMenu("source"));
  elements.targetLanguage.addEventListener("click", () => openLanguageMenu("target"));

  document.addEventListener("click", (event) => {
    const menu = document.querySelector(".language-menu");
    if (!menu) return;
    if (
      menu.contains(event.target) ||
      event.target.closest("[data-action='source-language'], [data-action='target-language']")
    ) {
      return;
    }
    menu.remove();
  });
}

wireEvents();
setStatus("Tap Start, then speak normally.");
render();
window.addEventListener("resize", scheduleTextFit);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.isConnected) {
    void requestWakeLock();
  }
});
