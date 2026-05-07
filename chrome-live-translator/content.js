(() => {
  const OVERLAY_VERSION = "0.1.26";
  if (window.__liveTranslateOverlayVersion === OVERLAY_VERSION) return;
  window.__liveTranslateOverlayVersion = OVERLAY_VERSION;
  document.querySelectorAll(".lt-root").forEach((element) => element.remove());

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
  const LANGUAGE_NAMES = {
    ...Object.fromEntries(LANGUAGE_OPTIONS.map(({ code, name }) => [code, name])),
    auto: "Detected"
  };
  const LANGUAGE_NATIVE_NAMES = {
    ar: "العربية",
    de: "Deutsch",
    en: "English",
    es: "Español",
    fa: "فارسی",
    fr: "Français",
    he: "עברית",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    pt: "Português",
    ru: "Русский",
    ur: "اردو",
    zh: "中文"
  };
  const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);
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
  const STORAGE_KEY = "liveTranslateOverlayLayout";
  const DEFAULT_LAYOUT = {
    left: null,
    top: null,
    width: null,
    height: null,
    sideCollapsed: false
  };

  let root;
  let elements;
  let currentState = {};
  let layout = loadLayout();
  let lastPointer;
  let dragMode;
  let overlayActivated = false;
  let pageSession;
  let pageToken = 0;
  let currentTargetText = "";
  let currentSourceText = "";
  let pageHistory = [];
  let activeTargetLanguage;
  let activeTranslationVoice;
  let activeTranslationMode;
  let requestedTargetLanguage;
  let requestedTranslationVoice;
  let lastWarmAt = 0;
  let captionPollTimer;
  let lastCaptionText = "";

  function volumePercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(100, Math.max(0, number));
  }

  function originalVolumeValue(value) {
    const percent = volumePercent(value);
    if (percent <= 1) return 0;
    return Math.pow(percent / 100, 1.15);
  }

  function translationVolumeValue(value) {
    const percent = volumePercent(value);
    if (percent <= 2) return 0;
    return Math.pow(percent / 100, 1.25);
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function trimDisplay(text, maxLength = 260) {
    const normalized = normalizeText(text);
    if (normalized.length <= maxLength) return normalized;
    return `...${normalized.slice(-maxLength).trimStart()}`;
  }

  function languageName(code) {
    return LANGUAGE_NAMES[code] || code || "Translation";
  }

  function languageLabel(code) {
    const name = languageName(code);
    const nativeName = LANGUAGE_NATIVE_NAMES[code];
    return nativeName && nativeName !== name ? `${name} · ${nativeName}` : name;
  }

  function textDirection(code) {
    return RTL_LANGUAGE_CODES.has(code) ? "rtl" : "auto";
  }

  function displayTime() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function syncRequestedControlsFromState(state = currentState) {
    if (state.targetLanguage) requestedTargetLanguage = state.targetLanguage;
    if (state.translationVoice) requestedTranslationVoice = state.translationVoice;
  }

  function activeDisplayLanguage(state = currentState) {
    return (
      state.displayTargetLanguage ||
      activeTargetLanguage ||
      pageSession?.targetLanguage ||
      state.targetLanguage ||
      requestedTargetLanguage ||
      "de"
    );
  }

  function activeDisplayVoice(state = currentState) {
    return (
      activeTranslationVoice ||
      pageSession?.translationVoice ||
      state.translationVoice ||
      requestedTranslationVoice ||
      "marin"
    );
  }

  function trace(type, details = {}) {
    const backendUrl = String(
      currentState.backendUrl || "http://127.0.0.1:8799"
    ).replace(/\/$/, "");
    void fetch(`${backendUrl}/api/realtime/translations/trace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "content",
        type,
        running: Boolean(pageSession),
        targetLanguage: activeDisplayLanguage(),
        requestedTargetLanguage: requestedTargetLanguage || elements?.language?.value || null,
        translationVoice: activeDisplayVoice(),
        requestedTranslationVoice: requestedTranslationVoice || elements?.voice?.value || null,
        translationMode: currentState.translationMode || "sync",
        pageToken,
        ...details
      })
    }).catch(() => {});
  }

  function liveSnapshot(status, overrides = {}) {
    const base = {
      ...fallbackState(),
      ...currentState,
      ...overlaySettings(),
      running: Boolean(pageSession),
      connecting: false,
      status,
      sourceText: trimDisplay(currentSourceText, 220),
      targetText: trimDisplay(currentTargetText, 280),
      history: pageHistory,
      displayTargetLanguage: activeDisplayLanguage(),
      ...overrides
    };
    return base;
  }

  function notifyLive(status, overrides = {}) {
    render(liveSnapshot(status, overrides));
    trace("status", {
      status,
      ...overrides
    });
  }

  function addHistoryTurn(languageCode = activeTargetLanguage || currentState.targetLanguage) {
    const target = normalizeText(currentTargetText);
    const source = normalizeText(currentSourceText);
    if (!target && !source) return;

    const last = pageHistory[0];
    if (
      last?.type !== "language" &&
      last?.target === target &&
      last?.source === source &&
      last?.language === languageCode
    ) return;

    pageHistory = [
      {
        id: `${Date.now()}`,
        type: "turn",
        time: displayTime(),
        language: languageCode,
        languageName: languageName(languageCode),
        languageLabel: languageLabel(languageCode),
        target,
        source
      },
      ...pageHistory
    ].slice(0, 24);
  }

  function timelineItems(history = [], state = currentState) {
    const items = [...history].reverse();
    const liveTarget = normalizeText(state.targetText);
    const liveSource = normalizeText(state.sourceText);

    if (liveTarget || liveSource) {
      const liveLanguage = activeDisplayLanguage(state);
      const last = items.at(-1);
      if (last?.type !== "language" || last.language !== liveLanguage) {
        items.push({
          id: `live-marker-${liveLanguage}`,
          type: "language",
          time: displayTime(),
          language: liveLanguage,
          languageName: languageName(liveLanguage),
          languageLabel: languageLabel(liveLanguage),
          live: true
        });
      }
      items.push({
        id: "live",
        type: "live",
        time: displayTime(),
        language: liveLanguage,
        languageName: languageName(liveLanguage),
        languageLabel: languageLabel(liveLanguage),
        target: liveTarget,
        source: liveSource
      });
    }

    return items;
  }

  function addLanguageMarker(languageCode, reason = "switch") {
    const name = languageName(languageCode);
    const last = pageHistory[0];
    if (last?.type === "language" && last.language === languageCode) return;

    pageHistory = [
      {
        id: `${Date.now()}-${languageCode}`,
        type: "language",
        time: displayTime(),
        language: languageCode,
        languageName: name,
        languageLabel: languageLabel(languageCode),
        reason
      },
      ...pageHistory
    ].slice(0, 28);
  }

  function readSourceTranscript(event) {
    if (!event?.type?.includes("transcription")) return "";
    return (
      event.transcript ||
      event.item?.content?.find?.((part) => part.transcript)?.transcript ||
      event.content?.find?.((part) => part.transcript)?.transcript ||
      ""
    );
  }

  function readVisibleCaptionText() {
    const captions = [...document.querySelectorAll(".ytp-caption-segment")]
      .map((element) => element.textContent)
      .join(" ");
    return normalizeText(captions);
  }

  function refreshSourceFromCaptions(reason = "poll") {
    const captionText = readVisibleCaptionText();
    if (!captionText || captionText === lastCaptionText) return;
    lastCaptionText = captionText;
    currentSourceText = captionText;
    trace("source_caption.update", {
      reason,
      chars: captionText.length
    });
    if (pageSession && root && !root.hidden) notifyLive("Live Translator");
  }

  function startSourceCaptionPolling() {
    if (captionPollTimer) return;
    refreshSourceFromCaptions("start");
    captionPollTimer = window.setInterval(() => {
      refreshSourceFromCaptions("poll");
    }, 350);
  }

  function stopSourceCaptionPolling() {
    if (!captionPollTimer) return;
    window.clearInterval(captionPollTimer);
    captionPollTimer = undefined;
    lastCaptionText = "";
  }

  function handleRealtimeEvent(rawMessage, token) {
    if (token !== pageToken) return;

    let event;
    try {
      event = JSON.parse(rawMessage);
    } catch {
      trace("event.parse_error", {
        rawLength: String(rawMessage || "").length
      });
      return;
    }

    trace("event", {
      eventType: event.type || null,
      deltaChars: event.delta ? String(event.delta).length : 0,
      transcriptChars: event.transcript ? String(event.transcript).length : 0,
      errorType: event.error?.type || null,
      errorCode: event.error?.code || null,
      errorMessage: event.error?.message || null
    });

    if (event.type === "error") {
      notifyLive("Translation unavailable");
      return;
    }

    if (
      (event.type === "session.output_transcript.delta" ||
        event.type === "response.audio_transcript.delta" ||
        event.type === "response.output_audio_transcript.delta") &&
      event.delta
    ) {
      currentTargetText = `${currentTargetText}${event.delta}`;
      notifyLive("Live Translator");
      return;
    }

    if (
      (event.type === "session.output_transcript.done" ||
        event.type === "response.audio_transcript.done" ||
        event.type === "response.output_audio_transcript.done") &&
      event.transcript
    ) {
      currentTargetText = event.transcript;
      addHistoryTurn();
      notifyLive("Live Translator");
      return;
    }

    const sourceTranscript =
      event.type === "session.input_transcript.delta"
        ? event.delta
        : readSourceTranscript(event);
    if (sourceTranscript) {
      currentSourceText =
        event.type === "session.input_transcript.delta"
          ? `${currentSourceText}${sourceTranscript}`
          : sourceTranscript;
      notifyLive("Live Translator");
      return;
    }

    if (event.type === "session.input_transcript.done" && event.transcript) {
      currentSourceText = event.transcript;
      notifyLive("Live Translator");
      return;
    }

    if (event.type?.includes("speech_started")) {
      if (currentTargetText) addHistoryTurn();
      currentSourceText = "";
      notifyLive("Live Translator");
      return;
    }

    if (event.type?.includes("speech_stopped")) {
      notifyLive("Live Translator");
      return;
    }

    if (
      event.type === "session.output_audio.delta" ||
      event.type === "response.output_audio.done" ||
      event.type === "response.audio.done" ||
      event.type === "response.output_item.done" ||
      event.type === "response.content_part.done" ||
      event.type === "response.done"
    ) {
      addHistoryTurn();
      notifyLive("Live Translator");
    }
  }

  function waitForIceGatheringComplete(pc, timeoutMs = 5000) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();

    return new Promise((resolve) => {
      const timeout = setTimeout(done, timeoutMs);

      function done() {
        clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }

      function onChange() {
        if (pc.iceGatheringState === "complete") done();
      }

      pc.addEventListener("icegatheringstatechange", onChange);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function nudgePlayback(video) {
    if (!video.paused) return;
    const playPromise = video.play();
    if (!playPromise?.then) return;
    await Promise.race([
      playPromise.catch(() => {}),
      delay(250)
    ]);
  }

  function captureVideoStreamOnce(video) {
    const capture = video.captureStream || video.mozCaptureStream;
    if (!capture) {
      throw new Error("This Chrome build cannot capture the YouTube video element.");
    }
    const stream = capture.call(video);
    return stream;
  }

  async function capturedVideoStream(video, timeoutMs = 9000) {
    const start = Date.now();
    let lastStream;

    while (Date.now() - start < timeoutMs) {
      if (video.paused) {
        await nudgePlayback(video);
      }

      lastStream = captureVideoStreamOnce(video);
      if (lastStream.getAudioTracks().length) {
        return lastStream;
      }

      lastStream.getTracks().forEach((track) => track.stop());
      await delay(300);
    }

    throw new Error("YouTube audio is not ready yet. Press play, then start Sotto again.");
  }

  function closeSession(session, { stopStream = true } = {}) {
    session?.dataChannel?.close();
    session?.peerConnection?.close();
    if (stopStream) {
      session?.stream?.getTracks().forEach((track) => track.stop());
    }
    if (session?.remoteAudio) {
      session.remoteAudio.pause();
      session.remoteAudio.srcObject = null;
      session.remoteAudio.remove();
    }
  }

  function applyAudioMix(settings = overlaySettings(), { remote = true } = {}) {
    const video = document.querySelector("video");
    const originalVolume = originalVolumeValue(settings.originalVolume);
    const translationVolume = translationVolumeValue(settings.translationVolume);

    if (video) {
      video.volume = originalVolume;
      video.muted = originalVolume === 0;
    }

    if (remote && pageSession?.remoteAudio) {
      pageSession.remoteAudio.volume = translationVolume;
      pageSession.remoteAudio.muted = translationVolume === 0;
    }

    return {
      originalVolume,
      translationVolume
    };
  }

  function playRemoteAudio(session, reason = "track") {
    const audio = session?.remoteAudio;
    if (!audio?.srcObject) return;

    audio.muted = false;
    audio.volume = translationVolumeValue(overlaySettings().translationVolume);
    void audio.play()
      .then(() => {
        trace("remote_audio.playing", {
          token: session.token,
          reason,
          volume: audio.volume,
          targetLanguage: session.targetLanguage || null
        });
      })
      .catch((error) => {
        trace("remote_audio.play_blocked", {
          token: session.token,
          reason,
          errorName: error?.name || null,
          errorMessage: error?.message || null,
          targetLanguage: session.targetLanguage || null
        });
        if (session === pageSession || session.token === pageToken) {
          notifyLive("Tap the video once to unlock translated audio");
        }
      });
  }

  function attachRemoteAudioTrack(session, event) {
    const audio = session?.remoteAudio;
    if (!audio) return;

    const stream = event.streams?.[0] || new MediaStream([event.track]);
    audio.volume = translationVolumeValue(overlaySettings().translationVolume);
    audio.srcObject = stream;
    trace("remote_audio.track_attached", {
      token: session.token,
      trackKind: event.track?.kind || null,
      streamTrackCount: stream.getTracks().length,
      targetLanguage: session.targetLanguage || null
    });
    playRemoteAudio(session, "track");
  }

  function warmTranslationLanguages(reason = "session", preferredLanguage) {
    const now = Date.now();
    if (now - lastWarmAt < 6000 && !preferredLanguage) return;
    lastWarmAt = now;

    const settings = overlaySettings();
    const targetLanguages = [
      preferredLanguage,
      ...WARM_LANGUAGE_CODES
    ].filter(
      (language, index, languages) =>
        language &&
        language !== settings.targetLanguage &&
        languages.indexOf(language) === index
    );
    if (!targetLanguages.length) return;

    trace("client_secret.prepare_requested", {
      reason,
      targetLanguages
    });
    void sendRuntimeMessage({
      type: "PREPARE_TRANSLATION_LANGUAGES",
      settings,
      targetLanguages,
      reason
    }).catch((error) => {
      trace("client_secret.prepare_request_error", {
        reason,
        errorMessage: error?.message || "Could not prepare languages"
      });
    });
  }

  function hideOverlay({ deactivate = true } = {}) {
    if (deactivate) overlayActivated = false;
    if (root) root.hidden = true;
  }

  async function stopPageTranslation(reason = "user_stop", shouldRender = false) {
    trace("content.session.stop", { reason });
    pageToken += 1;
    const session = pageSession;
    pageSession = undefined;
    activeTargetLanguage = undefined;
    activeTranslationVoice = undefined;
    activeTranslationMode = undefined;
    stopSourceCaptionPolling();
    closeSession(session);

    if (shouldRender) {
      render({
        ...currentState,
        running: false,
        connecting: false,
        status: "Stopped",
        targetText: "",
        sourceText: "",
        history: pageHistory
      });
    } else {
      hideOverlay();
    }
  }

  async function startPageTranslation(settings = {}, options = {}) {
    const sessionSettings = { ...overlaySettings(), ...settings };
    createOverlay();
    overlayActivated = true;
    root.hidden = false;

    const previousSession = pageSession;
    const isHandover = Boolean(options.handover && previousSession);
    const handoverLanguageChanged = Boolean(options.languageChanged);
    const handoverVoiceChanged = Boolean(options.voiceChanged);
    if (!isHandover) {
      currentState = { ...currentState, ...sessionSettings };
      syncRequestedControlsFromState(currentState);
    }
    if (pageSession && !isHandover) return liveSnapshot("Live Translator");

    const token = pageToken + 1;
    if (isHandover) {
      addHistoryTurn(activeTargetLanguage || previousSession?.targetLanguage);
    }
    currentTargetText = "";
    currentSourceText = "";
    if (!isHandover) pageHistory = [];
    const nextLanguageName = languageName(sessionSettings.targetLanguage);
    const handoverStatus =
      handoverVoiceChanged && !handoverLanguageChanged
        ? "Switching voice"
        : `Switching to ${nextLanguageName}`;
    render(liveSnapshot(isHandover ? handoverStatus : "Capturing video audio", {
      running: Boolean(previousSession),
      connecting: true,
      targetText: ""
    }));
    trace("content.session.start_requested", {
      token,
      href: window.location.href
    });

    let nextSession;
    const previousAudioVolume = previousSession?.remoteAudio?.volume;
    try {
      if (isHandover && previousSession?.remoteAudio) {
        previousSession.remoteAudio.volume = 0;
        trace("remote_audio.previous_muted_for_handover", {
          token: previousSession.token,
          nextToken: token,
          previousTargetLanguage: previousSession.targetLanguage || null,
          nextTargetLanguage: sessionSettings.targetLanguage || null,
          previousTranslationVoice: previousSession.translationVoice || null,
          nextTranslationVoice: sessionSettings.translationVoice || null
        });
      }

      const video = document.querySelector("video");
      if (!video) throw new Error("No YouTube video element was found.");
      const stream =
        isHandover && previousSession?.stream?.active
          ? previousSession.stream
          : await capturedVideoStream(video);
      applyAudioMix(sessionSettings, { remote: false });
      startSourceCaptionPolling();

      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel("oai-events");
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudio.preload = "auto";
      remoteAudio.volume = translationVolumeValue(sessionSettings.translationVolume);
      document.documentElement.append(remoteAudio);

      nextSession = {
        token,
        peerConnection: pc,
        dataChannel: channel,
        stream,
        remoteAudio,
        targetLanguage: sessionSettings.targetLanguage,
        translationVoice: sessionSettings.translationVoice,
        translationMode: sessionSettings.translationMode
      };
      if (!isHandover) {
        pageToken = token;
        pageSession = nextSession;
      }

      channel.addEventListener("open", () => {
        trace("data_channel.open", { token });
        if (token === pageToken) notifyLive("Live Translator");
      });
      channel.addEventListener("message", (event) => {
        handleRealtimeEvent(event.data, token);
      });
      channel.addEventListener("error", () => {
        trace("data_channel.error", { token });
        if (token === pageToken) notifyLive("Realtime event channel error");
      });
      channel.addEventListener("close", () => {
        trace("data_channel.close", { token });
      });

      pc.addEventListener("connectionstatechange", () => {
        trace("peer.connection_state", {
          token,
          connectionState: pc.connectionState
        });
        if (token !== pageToken) return;
        if (pc.connectionState === "connected") notifyLive("Live Translator");
        if (pc.connectionState === "disconnected") notifyLive("Reconnecting");
        if (pc.connectionState === "failed") notifyLive("Connection failed");
      });
      pc.addEventListener("iceconnectionstatechange", () => {
        trace("peer.ice_connection_state", {
          token,
          iceConnectionState: pc.iceConnectionState
        });
      });
      pc.addEventListener("signalingstatechange", () => {
        trace("peer.signaling_state", {
          token,
          signalingState: pc.signalingState
        });
      });

      pc.addEventListener("track", (event) => {
        trace("peer.track", {
          token,
          trackKind: event.track?.kind || null,
          streamCount: event.streams?.length || 0
        });
        attachRemoteAudioTrack(nextSession, event);
      });

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      trace("capture.stream_ready", {
        token,
        audioTrackCount: stream.getAudioTracks().length,
        videoTrackCount: stream.getVideoTracks().length,
        audioTrackLabels: stream.getAudioTracks().map((track) => track.label)
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      trace("sdp.offer_ready", {
        token,
        sdpChars: pc.localDescription?.sdp?.length || 0
      });

      const response = await sendRuntimeMessage({
        type: "OPENAI_TRANSLATION_SDP",
        offerSdp: pc.localDescription.sdp,
        settings: sessionSettings
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Could not open realtime translation.");
      }

      await pc.setRemoteDescription({
        type: "answer",
        sdp: response.answerSdp
      });
      if (isHandover) {
        addHistoryTurn(activeTargetLanguage || previousSession?.targetLanguage);
        currentTargetText = "";
        currentSourceText = "";
        pageToken = token;
        pageSession = nextSession;
        closeSession(previousSession, {
          stopStream: previousSession?.stream !== nextSession.stream
        });
      }
      currentState = { ...currentState, ...sessionSettings };
      activeTargetLanguage = sessionSettings.targetLanguage;
      activeTranslationVoice = sessionSettings.translationVoice;
      activeTranslationMode = sessionSettings.translationMode;
      syncRequestedControlsFromState(sessionSettings);
      if (!isHandover || handoverLanguageChanged) {
        addLanguageMarker(sessionSettings.targetLanguage, isHandover ? "switch" : "start");
      }
      trace("sdp.remote_set", {
        token,
        targetLanguage: sessionSettings.targetLanguage,
        translationVoice: sessionSettings.translationVoice,
        clientSecretRequestId: response.clientSecretRequestId || null
      });
      warmTranslationLanguages("post_session");
      const snapshot = liveSnapshot("Live Translator");
      notifyLive("Live Translator");
      return snapshot;
    } catch (error) {
      trace("content.session.start_error", {
        token,
        errorMessage: error?.message || "Could not start live translation."
      });
      if (!isHandover) {
        await stopPageTranslation("start_error", false);
      } else if (nextSession && nextSession !== pageSession) {
        closeSession(nextSession, {
          stopStream: nextSession.stream !== previousSession?.stream
        });
      }
      if (isHandover && previousSession?.remoteAudio && previousAudioVolume !== undefined) {
        previousSession.remoteAudio.volume = previousAudioVolume;
      }
      if (isHandover) {
        requestedTargetLanguage =
          activeTargetLanguage || previousSession?.targetLanguage || currentState.targetLanguage;
        requestedTranslationVoice =
          activeTranslationVoice || previousSession?.translationVoice || currentState.translationVoice;
      }
      render({
        ...currentState,
        ...overlaySettings(),
        running: Boolean(isHandover && previousSession),
        connecting: false,
        status: error?.message || "Could not start live translation.",
        targetText: error?.message || "Could not start live translation.",
        sourceText: "",
        history: pageHistory
      });
      throw error;
    }
  }

  function createOverlay() {
    if (root) return;

    root = document.createElement("aside");
    root.className = "lt-root";
    root.innerHTML = `
      <div class="lt-panel">
        <div class="lt-toolbar" data-lt-drag-handle>
          <div class="lt-brand" aria-label="Sotto">
            <span class="lt-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" focusable="false">
                <rect width="64" height="64" rx="15" fill="#E2FF66"></rect>
                <path d="M43 17H25.5C18.8 17 14 21 14 26.7C14 32.3 18.5 36 25.3 36H38.7C45.5 36 50 39.7 50 45.3C50 51 45.2 55 38.5 55H18" fill="none" stroke="#10110D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M21 25.5H32.5" fill="none" stroke="#10110D" stroke-width="3.5" stroke-linecap="round" opacity="0.82"></path>
                <path d="M31.5 45H43" fill="none" stroke="#10110D" stroke-width="3.5" stroke-linecap="round" opacity="0.82"></path>
                <circle cx="47" cy="17" r="4" fill="#10110D"></circle>
              </svg>
            </span>
            <span class="lt-wordmark">Sotto</span>
            <span class="lt-state" data-lt-status>Ready</span>
          </div>
          <label class="lt-select-control lt-language-control">
            <span>Hear</span>
            <select data-lt-language></select>
          </label>
          <label class="lt-select-control lt-voice-control">
            <span>Voice</span>
            <select data-lt-voice></select>
          </label>
          <button class="lt-button" type="button" data-lt-collapse-source>Text</button>
          <button class="lt-button lt-button-primary" type="button" data-lt-start-stop>Stop</button>
        </div>
        <div class="lt-body">
          <div class="lt-main">
            <div class="lt-target" data-lt-target></div>
          </div>
          <div class="lt-side" data-lt-side>
            <div class="lt-source" data-lt-source></div>
            <div class="lt-history" data-lt-history aria-label="Translation history"></div>
          </div>
        </div>
        <span class="lt-resize-edge lt-resize-edge-n" aria-hidden="true" data-lt-resize-mode="resize-n"></span>
        <span class="lt-resize-edge lt-resize-edge-e" aria-hidden="true" data-lt-resize-mode="resize-e"></span>
        <span class="lt-resize-edge lt-resize-edge-s" aria-hidden="true" data-lt-resize-mode="resize-s"></span>
        <span class="lt-resize-edge lt-resize-edge-w" aria-hidden="true" data-lt-resize-mode="resize-w"></span>
        <button class="lt-resize-corner lt-resize-corner-nw" type="button" aria-label="Resize translation overlay from top left" data-lt-resize-mode="resize-nw"></button>
        <button class="lt-resize-corner lt-resize-corner-ne" type="button" aria-label="Resize translation overlay from top right" data-lt-resize-mode="resize-ne"></button>
        <button class="lt-resize-corner lt-resize-corner-sw" type="button" aria-label="Resize translation overlay from bottom left" data-lt-resize-mode="resize-sw"></button>
        <button class="lt-resize-corner lt-resize-corner-se" type="button" aria-label="Resize translation overlay from bottom right" data-lt-resize-mode="resize-se"></button>
      </div>
    `;
    document.documentElement.append(root);

    elements = {
      status: root.querySelector("[data-lt-status]"),
      language: root.querySelector("[data-lt-language]"),
      voice: root.querySelector("[data-lt-voice]"),
      dragHandle: root.querySelector("[data-lt-drag-handle]"),
      startStop: root.querySelector("[data-lt-start-stop]"),
      collapseSource: root.querySelector("[data-lt-collapse-source]"),
      target: root.querySelector("[data-lt-target]"),
      side: root.querySelector("[data-lt-side]"),
      source: root.querySelector("[data-lt-source]"),
      history: root.querySelector("[data-lt-history]"),
      resizeHandles: root.querySelectorAll("[data-lt-resize-mode]")
    };
    populateLanguages();
    populateVoices();
    bindOverlayEvents();
    applyLayout();
  }

  function loadLayout() {
    try {
      return {
        ...DEFAULT_LAYOUT,
        ...JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}")
      };
    } catch {
      return { ...DEFAULT_LAYOUT };
    }
  }

  function saveLayout() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }

  function sendRuntimeMessage(message) {
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
    elements.language.replaceChildren(commonGroup, moreGroup);
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
    elements.voice.replaceChildren(preferredGroup, moreGroup);
  }

  function clampLayout() {
    const maxWidth = Math.max(300, window.innerWidth - 24);
    const maxHeight = Math.max(130, window.innerHeight - 24);
    const width = Math.min(Math.max(layout.width || root.offsetWidth || 700, 300), maxWidth);
    const height = Math.min(Math.max(layout.height || root.offsetHeight || 190, 130), maxHeight);
    const left = Math.min(
      Math.max(layout.left ?? window.innerWidth - width - 18, 12),
      Math.max(12, window.innerWidth - width - 12)
    );
    const top = Math.min(
      Math.max(layout.top ?? window.innerHeight - height - 92, 12),
      Math.max(12, window.innerHeight - height - 12)
    );

    layout = { ...layout, left, top, width, height };
  }

  function applyLayout() {
    if (!root) return;
    clampLayout();
    root.style.left = `${layout.left}px`;
    root.style.top = `${layout.top}px`;
    root.style.width = `${layout.width}px`;
    root.style.height = `${layout.height}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.classList.toggle("is-side-collapsed", Boolean(layout.sideCollapsed));
    root.classList.toggle("is-compact", layout.width < 560 || layout.height < 210);
    root.classList.toggle("is-roomy", layout.width > 760 && layout.height > 235);
    root.style.setProperty(
      "--lt-target-lines",
      String(Math.max(2, Math.min(8, Math.floor((layout.height - 74) / 38))))
    );
    elements.collapseSource.textContent = layout.sideCollapsed ? "Text" : "Hide";
  }

  function beginPointerMode(event, mode) {
    if (event.button !== 0) return;
    if (event.target.closest("button, select, input, .lt-history")) return;
    dragMode = mode;
    lastPointer = {
      x: event.clientX,
      y: event.clientY,
      left: layout.left ?? root.getBoundingClientRect().left,
      top: layout.top ?? root.getBoundingClientRect().top,
      width: layout.width ?? root.getBoundingClientRect().width,
      height: layout.height ?? root.getBoundingClientRect().height
    };
    root.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function beginResizeMode(event, mode) {
    if (event.button !== 0) return;
    dragMode = mode;
    lastPointer = {
      x: event.clientX,
      y: event.clientY,
      left: layout.left ?? root.getBoundingClientRect().left,
      top: layout.top ?? root.getBoundingClientRect().top,
      width: layout.width ?? root.getBoundingClientRect().width,
      height: layout.height ?? root.getBoundingClientRect().height
    };
    root.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function resizeLayoutFromPointer(mode, dx, dy) {
    const minWidth = 300;
    const minHeight = 130;
    let left = lastPointer.left;
    let top = lastPointer.top;
    let width = lastPointer.width;
    let height = lastPointer.height;

    if (mode.includes("e")) {
      width = lastPointer.width + dx;
    }
    if (mode.includes("s")) {
      height = lastPointer.height + dy;
    }
    if (mode.includes("w")) {
      width = lastPointer.width - dx;
      left = lastPointer.left + dx;
      if (width < minWidth) {
        left -= minWidth - width;
        width = minWidth;
      }
    }
    if (mode.includes("n")) {
      height = lastPointer.height - dy;
      top = lastPointer.top + dy;
      if (height < minHeight) {
        top -= minHeight - height;
        height = minHeight;
      }
    }

    layout.left = left;
    layout.top = top;
    layout.width = Math.max(minWidth, width);
    layout.height = Math.max(minHeight, height);
  }

  function bindOverlayEvents() {
    root.addEventListener("pointerdown", () => {
      playRemoteAudio(pageSession, "overlay_gesture");
    }, { capture: true });

    elements.dragHandle.addEventListener("pointerdown", (event) => {
      beginPointerMode(event, "drag");
    });

    elements.resizeHandles.forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        beginResizeMode(event, handle.dataset.ltResizeMode);
      });
    });

    root.addEventListener("pointermove", (event) => {
      if (!dragMode || !lastPointer) return;
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;

      if (dragMode === "drag") {
        layout.left = lastPointer.left + dx;
        layout.top = lastPointer.top + dy;
      } else if (dragMode.startsWith("resize-")) {
        resizeLayoutFromPointer(dragMode.replace("resize-", ""), dx, dy);
      }

      applyLayout();
    });

    root.addEventListener("pointerup", (event) => {
      if (!dragMode) return;
      dragMode = undefined;
      lastPointer = undefined;
      root.releasePointerCapture?.(event.pointerId);
      saveLayout();
    });

    window.addEventListener("resize", () => {
      applyLayout();
      saveLayout();
    });

    for (const eventName of ["pointerdown", "focus", "mouseenter"]) {
      elements.language.addEventListener(eventName, () => {
        warmTranslationLanguages(`language_${eventName}`);
      });
    }

    elements.language.addEventListener("change", async () => {
      const targetLanguage = elements.language.value;
      requestedTargetLanguage = targetLanguage;
      warmTranslationLanguages("language_change", targetLanguage);
      if (pageSession) {
        render(liveSnapshot("Switching language", {
          running: true,
          connecting: true,
          targetText: "",
          displayTargetLanguage: targetLanguage
        }));
      }
      const response = await sendRuntimeMessage({
        type: "UPDATE_SETTINGS",
        settings: selectedOverlaySettings()
      }).catch(() => {});
      if (response?.state) {
        currentState = { ...currentState, ...response.state };
        if (!currentState.connecting) syncRequestedControlsFromState(currentState);
        if (root && !root.hidden) render(currentState);
      }
    });

    elements.voice.addEventListener("change", async () => {
      const translationVoice = elements.voice.value;
      requestedTranslationVoice = translationVoice;
      if (pageSession) {
        render(liveSnapshot("Switching voice", {
          running: true,
          connecting: true,
          targetText: ""
        }));
      }
      const response = await sendRuntimeMessage({
        type: "UPDATE_SETTINGS",
        settings: selectedOverlaySettings()
      }).catch(() => {});
      if (response?.state) {
        currentState = { ...currentState, ...response.state };
        if (!currentState.connecting) syncRequestedControlsFromState(currentState);
        if (root && !root.hidden) render(currentState);
      }
    });

    elements.startStop.addEventListener("click", async () => {
      elements.startStop.disabled = true;
      try {
        if (pageSession || currentState.running || currentState.connecting) {
          await stopPageTranslation("overlay_stop", false);
          const response = await sendRuntimeMessage({ type: "STOP_TRANSLATION" }).catch(() => null);
          if (response?.state) currentState = { ...currentState, ...response.state };
        } else {
          const response = await sendRuntimeMessage({
            type: "START_TRANSLATION",
            settings: selectedOverlaySettings()
          });
          if (response?.state) currentState = { ...currentState, ...response.state };
        }
      } catch (error) {
        render({
          ...fallbackState(),
          ...currentState,
          running: false,
          connecting: false,
          status: error?.message || "Could not start live translation.",
          targetText: error?.message || "Could not start live translation."
        });
      } finally {
        elements.startStop.disabled = false;
      }
    });

    elements.collapseSource.addEventListener("click", () => {
      layout.sideCollapsed = !layout.sideCollapsed;
      applyLayout();
      saveLayout();
    });
  }

  function overlaySettings() {
    return {
      backendUrl: currentState.backendUrl || "http://127.0.0.1:8799",
      sourceLanguage: currentState.sourceLanguage || "auto",
      targetLanguage:
        activeTargetLanguage ||
        pageSession?.targetLanguage ||
        currentState.targetLanguage ||
        requestedTargetLanguage ||
        "de",
      translationVoice:
        activeTranslationVoice ||
        pageSession?.translationVoice ||
        currentState.translationVoice ||
        requestedTranslationVoice ||
        "marin",
      translationMode: currentState.translationMode || "sync",
      originalVolume: currentState.originalVolume ?? 18,
      translationVolume: currentState.translationVolume ?? 100,
      showSource: currentState.showSource ?? false
    };
  }

  function selectedOverlaySettings() {
    const settings = overlaySettings();
    return {
      ...settings,
      targetLanguage: elements?.language?.value || requestedTargetLanguage || settings.targetLanguage,
      translationVoice: elements?.voice?.value || requestedTranslationVoice || settings.translationVoice
    };
  }

  function emptyText(text, fallback) {
    const value = String(text || "").trim();
    return value || fallback;
  }

  function renderHistory(history = [], showSource = false) {
    if (!history.length) {
      elements.history.replaceChildren();
      elements.history.hidden = true;
      return;
    }

    elements.history.hidden = false;
    const fragment = document.createDocumentFragment();
    for (const turn of history.slice(0, 16)) {
      if (turn.type === "language") {
        const marker = document.createElement("div");
        marker.className = "lt-history-marker";

        const time = document.createElement("span");
        time.textContent = turn.time;
        const language = document.createElement("strong");
        language.textContent = turn.languageLabel || languageLabel(turn.language);
        language.dir = textDirection(turn.language);

        marker.append(time, language);
        fragment.append(marker);
        continue;
      }

      const item = document.createElement("button");
      item.type = "button";
      item.className = "lt-history-item";

      const meta = document.createElement("span");
      meta.className = "lt-history-meta";
      meta.textContent = `${turn.time} · ${turn.languageLabel || languageLabel(turn.language)}`;

      const text = document.createElement("span");
      text.className = "lt-history-text";
      text.lang = turn.language || "";
      text.dir = textDirection(turn.language);
      text.textContent =
        showSource && turn.source
          ? `${turn.source} -> ${turn.target}`
          : turn.target;

      item.append(meta, text);
      item.title = `${meta.textContent} ${text.textContent}`;
      fragment.append(item);
    }
    elements.history.replaceChildren(fragment);
  }

  function renderMainFlow(state) {
    const items = timelineItems(state.history, state);
    if (!items.length) {
      elements.target.textContent =
        state.running || state.connecting
          ? state.translationMode === "turns" ? "Listening..." : "Live Translator..."
          : "Ready";
      return;
    }

    const wasNearBottom =
      elements.target.scrollTop + elements.target.clientHeight >=
      elements.target.scrollHeight - 28;
    const fragment = document.createDocumentFragment();

    for (const item of items) {
      if (item.type === "language") {
        const marker = document.createElement("div");
        marker.className = "lt-flow-marker";
        marker.dataset.live = item.live ? "true" : "false";

        const time = document.createElement("span");
        time.textContent = item.time;
        const language = document.createElement("strong");
        language.textContent = item.languageLabel || languageLabel(item.language);
        language.dir = textDirection(item.language);

        marker.append(time, language);
        fragment.append(marker);
        continue;
      }

      const row = document.createElement("div");
      row.className = item.type === "live" ? "lt-flow-item is-live" : "lt-flow-item";
      row.lang = item.language || "";
      row.dir = textDirection(item.language);

      const text = document.createElement("div");
      text.className = "lt-flow-text";
      text.textContent = emptyText(item.target, item.type === "live" ? "Listening..." : "");
      row.append(text);

      if (state.showSource && item.source) {
        const source = document.createElement("div");
        source.className = "lt-flow-source";
        source.textContent = item.source;
        row.append(source);
      }

      fragment.append(row);
    }

    elements.target.replaceChildren(fragment);
    if (wasNearBottom || state.connecting) {
      elements.target.scrollTop = elements.target.scrollHeight;
    }
  }

  function render(state) {
    createOverlay();
    const { displayTargetLanguage, ...persistedState } = state;
    currentState = { ...currentState, ...persistedState };
    delete currentState.displayTargetLanguage;
    applyAudioMix(currentState);
    root.hidden = false;
    root.classList.toggle("is-connecting", Boolean(state.connecting));
    root.classList.toggle("is-stopped", !state.running && !state.connecting);
    root.classList.toggle("is-with-source", Boolean(state.showSource));
    root.classList.toggle("is-side-hidden", Boolean(layout.sideCollapsed) || !state.showSource);
    elements.status.textContent = emptyText(state.status, "Listening");
    elements.language.value =
      requestedTargetLanguage || state.targetLanguage || currentState.targetLanguage || "de";
    const selectedVoice =
      requestedTranslationVoice || state.translationVoice || currentState.translationVoice || "marin";
    elements.voice.value = VOICE_OPTIONS.some(({ id }) => id === selectedVoice)
      ? selectedVoice
      : "marin";
    elements.target.lang = "";
    elements.target.dir = "auto";
    elements.startStop.textContent =
      state.running || state.connecting ? "Stop" : "Start";
    elements.startStop.disabled = Boolean(state.connecting);
    renderMainFlow(state);
    elements.side.hidden = Boolean(layout.sideCollapsed) || !state.showSource;
    elements.source.hidden = !state.showSource || layout.sideCollapsed;
    elements.source.textContent = emptyText(state.sourceText, "Waiting for source captions...");
    elements.history.replaceChildren();
    elements.history.hidden = true;
    applyLayout();
  }

  function fallbackState() {
    return {
      running: false,
      connecting: false,
      status: "Ready",
      sourceText: "",
      targetText: "",
      history: [],
      backendUrl: "http://127.0.0.1:8799",
      sourceLanguage: "auto",
      targetLanguage: "de",
      translationVoice: "marin",
      translationMode: "sync",
      originalVolume: 18,
      translationVolume: 100,
      showSource: false
    };
  }

  async function syncInitialState() {
    const response = await sendRuntimeMessage({ type: "GET_STATE" }).catch(() => null);
    currentState = { ...fallbackState(), ...(response?.state || {}) };
    syncRequestedControlsFromState(currentState);
    hideOverlay();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "CONTENT_PING") {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "CONTENT_UPDATE") {
      const nextState = { ...currentState, ...(message.state || {}) };
      currentState = nextState;
      if (!pageSession || !nextState.connecting) syncRequestedControlsFromState(nextState);
      if (overlayActivated || root) {
        if (!nextState.running && !nextState.connecting) {
          hideOverlay();
        } else {
          render(nextState);
        }
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "CONTENT_START_PAGE_TRANSLATION") {
      (async () => {
        try {
          const state = await startPageTranslation(message.settings || {});
          sendResponse({ ok: true, state });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error?.message || "Could not start live translation.",
            state: liveSnapshot(error?.message || "Could not start live translation.", {
              running: false,
              connecting: false
            })
          });
        }
      })();
      return true;
    }

    if (message?.type === "CONTENT_UPDATE_SETTINGS") {
      (async () => {
        try {
          const nextSettings = message.settings || {};
          if (nextSettings.targetLanguage) requestedTargetLanguage = nextSettings.targetLanguage;
          if (nextSettings.translationVoice) requestedTranslationVoice = nextSettings.translationVoice;
          const previousLanguage = activeTargetLanguage || currentState.targetLanguage;
          const previousVoice = activeTranslationVoice || currentState.translationVoice;
          const previousMode = activeTranslationMode || currentState.translationMode;
          const languageChanged =
            Boolean(nextSettings.targetLanguage) &&
            nextSettings.targetLanguage !== previousLanguage;
          const voiceChanged =
            Boolean(nextSettings.translationVoice) &&
            nextSettings.translationVoice !== previousVoice;
          const modeChanged =
            Boolean(nextSettings.translationMode) &&
            nextSettings.translationMode !== previousMode;

          if (pageSession && (languageChanged || voiceChanged || modeChanged)) {
            addHistoryTurn(previousLanguage);
            const nextLanguageName =
              LANGUAGE_NAMES[nextSettings.targetLanguage] ||
              nextSettings.targetLanguage ||
              "translation";
            const status =
              voiceChanged && !languageChanged
                ? "Switching voice"
                : `Switching to ${nextLanguageName}`;
            render(liveSnapshot(status, {
              running: true,
              connecting: true,
              targetText: "",
              displayTargetLanguage: nextSettings.targetLanguage
            }));
            const state = await startPageTranslation(nextSettings, {
              handover: true,
              languageChanged,
              voiceChanged,
              modeChanged
            });
            sendResponse({ ok: true, state });
            return;
          }

          currentState = { ...currentState, ...nextSettings };
          syncRequestedControlsFromState(currentState);
          applyAudioMix(currentState);
          if (root && !root.hidden) {
            render(
              pageSession
                ? liveSnapshot("Live Translator")
                : { ...fallbackState(), ...currentState }
            );
          }
          sendResponse({
            ok: true,
            state: pageSession
              ? liveSnapshot("Live Translator")
              : { ...fallbackState(), ...currentState }
          });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error?.message || "Could not update translation settings.",
            state: liveSnapshot(error?.message || "Could not update settings.", {
              running: Boolean(pageSession),
              connecting: false
            })
          });
        }
      })();
      return true;
    }

    if (
      message?.type === "CONTENT_STOP" ||
      message?.type === "CONTENT_STOP_PAGE_TRANSLATION"
    ) {
      void stopPageTranslation("background_stop", false);
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  void syncInitialState();
})();
