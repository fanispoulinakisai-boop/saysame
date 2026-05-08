(() => {
  const OVERLAY_VERSION = "0.2.0";
  if (window.__liveTranslateOverlayVersion === OVERLAY_VERSION) return;
  window.__liveTranslateOverlayVersion = OVERLAY_VERSION;
  document.querySelectorAll(".lt-root, .lt-pill").forEach((element) => element.remove());

  // ===========================================================
  // Constants — copied from popup.js / previous content.js
  // ===========================================================
  const LANGUAGE_FLAGS = {
    en: "🇺🇸", el: "🇬🇷", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹",
    ja: "🇯🇵", ru: "🇷🇺", zh: "🇨🇳", pt: "🇵🇹", ko: "🇰🇷", ar: "🇸🇦",
    af: "🇿🇦", az: "🇦🇿", be: "🇧🇾", bg: "🇧🇬", bs: "🇧🇦", ca: "🇪🇸",
    cs: "🇨🇿", cy: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", da: "🇩🇰", et: "🇪🇪", fa: "🇮🇷", fi: "🇫🇮",
    gl: "🇪🇸", he: "🇮🇱", hi: "🇮🇳", hr: "🇭🇷", hu: "🇭🇺", hy: "🇦🇲",
    id: "🇮🇩", is: "🇮🇸", kk: "🇰🇿", kn: "🇮🇳", lt: "🇱🇹", lv: "🇱🇻",
    mi: "🇳🇿", mk: "🇲🇰", mr: "🇮🇳", ms: "🇲🇾", ne: "🇳🇵", nl: "🇳🇱",
    no: "🇳🇴", pl: "🇵🇱", ro: "🇷🇴", sk: "🇸🇰", sl: "🇸🇮", sr: "🇷🇸",
    sv: "🇸🇪", sw: "🇰🇪", ta: "🇮🇳", th: "🇹🇭", tl: "🇵🇭", tr: "🇹🇷",
    uk: "🇺🇦", ur: "🇵🇰", vi: "🇻🇳"
  };

  const LANGUAGE_OPTIONS = [
    { code: "en", name: "English", common: true },
    { code: "el", name: "Greek", common: true },
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

  // Per-minute cost by mode.
  //   voice: gpt-realtime-translate ≈ $0.034/min (per OpenAI pricing)
  //   text:  gpt-realtime-whisper (~$0.017/min) + gpt-4o-mini per
  //          finalized segment (rough total ≈ $0.02/min)
  const COST_PER_MINUTE_VOICE = 0.034;
  const COST_PER_MINUTE_TEXT = 0.02;
  const COST_WARN_THRESHOLD = 5.0;
  function costPerMinute() {
    return mode === "text" ? COST_PER_MINUTE_TEXT : COST_PER_MINUTE_VOICE;
  }

  // ===========================================================
  // State
  // ===========================================================
  let root;
  let pill;
  let elements = {};
  let currentState = {};
  let overlayVisible = false;
  let pageSession;
  let textSession;
  let pageToken = 0;
  let currentTargetText = "";
  let previousFinalizedTarget = "";
  let currentSourceText = "";
  let activeTargetLanguage;
  let activeTranslationVoice;
  let activeTranslationMode;
  let requestedTargetLanguage;
  let requestedTranslationVoice;
  let lastWarmAt = 0;
  let captionPollTimer;
  let lastCaptionText = "";
  let sessionStartedAt = 0;
  let tickerTimer;
  let mode = "voice";
  let barOpacity = 100;
  let isHidden = false;
  let isStreaming = false;
  let settingsOpen = false;
  let popoverOpen = false;
  let dragState = null;

  // ===========================================================
  // Helpers
  // ===========================================================
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

  function languageFlag(code) {
    return LANGUAGE_FLAGS[code] || "🏳";
  }

  function updateLanguageFlagAttr() {
    if (!elements?.languageWrap || !elements?.languageSelect) return;
    const code = elements.languageSelect.value || requestedTargetLanguage || "en";
    elements.languageWrap.dataset.flag = languageFlag(code);
  }

  function textDirection(code) {
    return RTL_LANGUAGE_CODES.has(code) ? "rtl" : "auto";
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "content",
        type,
        running: Boolean(pageSession || textSession),
        mode,
        targetLanguage: activeDisplayLanguage(),
        requestedTargetLanguage:
          requestedTargetLanguage || elements?.languageSelect?.value || null,
        translationVoice: activeDisplayVoice(),
        requestedTranslationVoice:
          requestedTranslationVoice || elements?.voiceSelect?.value || null,
        translationMode: currentState.translationMode || "sync",
        pageToken,
        ...details
      })
    }).catch(() => {});
  }

  function liveSnapshot(status, overrides = {}) {
    return {
      ...fallbackState(),
      ...currentState,
      ...overlaySettings(),
      running: Boolean(pageSession || textSession),
      connecting: false,
      status,
      sourceText: trimDisplay(currentSourceText, 220),
      targetText: trimDisplay(currentTargetText, 280),
      displayTargetLanguage: activeDisplayLanguage(),
      ...overrides
    };
  }

  function notifyLive(status, overrides = {}) {
    render(liveSnapshot(status, overrides));
    trace("status", { status, ...overrides });
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
    trace("source_caption.update", { reason, chars: captionText.length });
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

  // ===========================================================
  // Realtime event handling — UNCHANGED FROM PREVIOUS LOGIC
  // ===========================================================
  function handleRealtimeEvent(rawMessage, token) {
    if (token !== pageToken) return;

    let event;
    try {
      event = JSON.parse(rawMessage);
    } catch {
      trace("event.parse_error", { rawLength: String(rawMessage || "").length });
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
      isStreaming = true;
      notifyLive("Live Translator");
      return;
    }

    if (
      (event.type === "session.output_transcript.done" ||
        event.type === "response.audio_transcript.done" ||
        event.type === "response.output_audio_transcript.done") &&
      event.transcript
    ) {
      previousFinalizedTarget = currentTargetText;
      currentTargetText = event.transcript;
      isStreaming = false;
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
      if (currentTargetText) previousFinalizedTarget = currentTargetText;
      currentSourceText = "";
      notifyLive("Live Translator");
      return;
    }

    if (event.type?.includes("speech_stopped")) {
      isStreaming = false;
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
      isStreaming = false;
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
    await Promise.race([playPromise.catch(() => {}), delay(250)]);
  }

  // Web Audio pipeline: decouples PLAYBACK volume (what user hears)
  // from CAPTURE volume (what OpenAI receives). With the old approach
  // (video.captureStream), lowering video.volume also lowered the
  // captured audio → OpenAI got quiet input → translation degraded.
  // Now: capture path is fixed at unity gain; only the playback gain
  // node responds to the user's "Original video volume" slider.
  let audioPipeline = null;

  function setupAudioPipeline(video) {
    if (audioPipeline?.video === video) return audioPipeline;
    if (audioPipeline) tearDownAudioPipeline();

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let source;
    try {
      source = ctx.createMediaElementSource(video);
    } catch (e) {
      // The video may already be wired to another AudioContext (rare;
      // happens if another extension or the page itself grabbed it).
      // Fall back to plain captureStream so we still get SOMETHING.
      try { ctx.close(); } catch {}
      throw new Error("Cannot tap video audio (already in use by another tool).");
    }

    const playbackGain = ctx.createGain();
    playbackGain.gain.value = 1.0;
    source.connect(playbackGain);
    playbackGain.connect(ctx.destination);

    const captureGain = ctx.createGain();
    captureGain.gain.value = 1.0; // Always full-volume to OpenAI.
    source.connect(captureGain);
    const dest = ctx.createMediaStreamDestination();
    captureGain.connect(dest);

    audioPipeline = {
      video,
      ctx,
      source,
      playbackGain,
      captureGain,
      dest,
      capturedStream: dest.stream
    };
    return audioPipeline;
  }

  function tearDownAudioPipeline() {
    if (!audioPipeline) return;
    try { audioPipeline.source.disconnect(); } catch {}
    try { audioPipeline.playbackGain.disconnect(); } catch {}
    try { audioPipeline.captureGain.disconnect(); } catch {}
    try { audioPipeline.dest.disconnect(); } catch {}
    try { audioPipeline.ctx.close(); } catch {}
    audioPipeline = null;
  }

  function setPipelinePlaybackGain(value0to1) {
    if (!audioPipeline) return;
    const clamped = Math.max(0, Math.min(1, value0to1));
    audioPipeline.playbackGain.gain.value = clamped;
  }

  async function capturedVideoStream(video, timeoutMs = 9000) {
    // Make sure the video is actually playing — Web Audio source
    // needs the element to have started.
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (video.paused) await nudgePlayback(video);
      if (!video.paused && video.readyState >= 2) break;
      await delay(300);
    }
    if (video.paused) {
      throw new Error("Video audio is not ready yet. Press play, then start SaySame again.");
    }
    const pipeline = setupAudioPipeline(video);
    if (!pipeline?.capturedStream?.getAudioTracks?.().length) {
      throw new Error("This browser cannot tap the page's video audio.");
    }
    // Resume context if it's suspended (autoplay policy). The user
    // already clicked Start so a gesture is active.
    if (pipeline.ctx.state === "suspended") {
      try { await pipeline.ctx.resume(); } catch {}
    }
    return pipeline.capturedStream;
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
      if (audioPipeline) {
        // Pipeline is active — control PLAYBACK volume only. Capture
        // path stays at unity gain so OpenAI always gets clean audio.
        // Force video.volume = 1.0 + muted=false so the WebAudio
        // source has full-strength audio to work with.
        video.volume = 1.0;
        video.muted = false;
        setPipelinePlaybackGain(originalVolume);
      } else {
        // No pipeline yet (idle or text-mode-only state). Fall back
        // to native video.volume so user's slider isn't silently dead.
        video.volume = originalVolume;
        video.muted = originalVolume === 0;
      }
    }

    if (remote && pageSession?.remoteAudio) {
      pageSession.remoteAudio.volume = translationVolume;
      pageSession.remoteAudio.muted = translationVolume === 0;
    }

    return { originalVolume, translationVolume };
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
    const targetLanguages = [preferredLanguage, ...WARM_LANGUAGE_CODES].filter(
      (language, index, languages) =>
        language &&
        language !== settings.targetLanguage &&
        languages.indexOf(language) === index
    );
    if (!targetLanguages.length) return;

    trace("client_secret.prepare_requested", { reason, targetLanguages });
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

  function showOverlay() {
    createOverlay();
    overlayVisible = true;
    isHidden = false;
    root.hidden = false;
    if (pill) pill.classList.remove("is-visible");
    root.classList.add("is-entering");
    setTimeout(() => root?.classList.remove("is-entering"), 260);
    render(currentState);
  }

  function hideOverlay({ deactivate = true } = {}) {
    if (deactivate) overlayVisible = false;
    if (root) root.hidden = true;
    if (pill) pill.classList.remove("is-visible");
  }

  function collapseToPill() {
    if (!root) return;
    isHidden = true;
    root.hidden = true;
    if (!pill) createPill();
    pill.classList.add("is-visible");
    updatePill();
  }

  function expandFromPill() {
    isHidden = false;
    if (pill) pill.classList.remove("is-visible");
    if (root) {
      root.hidden = false;
      root.classList.add("is-entering");
      setTimeout(() => root?.classList.remove("is-entering"), 260);
    }
  }

  async function stopPageTranslation(reason = "user_stop", shouldRender = false) {
    trace("content.session.stop", { reason });
    pageToken += 1;
    const session = pageSession;
    pageSession = undefined;
    activeTargetLanguage = undefined;
    activeTranslationVoice = undefined;
    activeTranslationMode = undefined;
    sessionStartedAt = 0;
    stopTickerTimer();
    stopSourceCaptionPolling();
    closeSession(session);
    isStreaming = false;
    previousFinalizedTarget = "";
    currentTargetText = "";
    currentSourceText = "";

    if (shouldRender) {
      render({
        ...currentState,
        running: false,
        connecting: false,
        status: "Stopped",
        targetText: "",
        sourceText: ""
      });
    } else if (overlayVisible && !isHidden) {
      // Keep the bar visible but in idle mode.
      render({
        ...currentState,
        running: false,
        connecting: false,
        status: "Ready",
        targetText: "",
        sourceText: ""
      });
    }
  }

  // ===========================================================
  // Text mode (cheap pipeline) — uses window.__sottoTextMode
  // (see text-mode.js). Whisper streams the source transcript;
  // background translates each finalized segment via gpt-4o-mini.
  // No voice playback.
  // ===========================================================
  async function stopTextModeTranslation(reason = "user_stop", shouldRender = false) {
    trace("text_mode.session.stop", { reason });
    const session = textSession;
    textSession = undefined;
    sessionStartedAt = 0;
    stopTickerTimer();
    isStreaming = false;
    previousFinalizedTarget = "";
    currentTargetText = "";
    currentSourceText = "";
    try {
      window.__sottoTextMode?.stop?.(reason);
    } catch (error) {
      trace("text_mode.session.stop_error", {
        errorMessage: error?.message || null
      });
    }
    if (session?.stream) {
      session.stream.getTracks().forEach((track) => track.stop());
    }

    if (shouldRender) {
      render({
        ...currentState,
        running: false,
        connecting: false,
        status: "Stopped",
        targetText: "",
        sourceText: ""
      });
    } else if (overlayVisible && !isHidden) {
      render({
        ...currentState,
        running: false,
        connecting: false,
        status: "Ready",
        targetText: "",
        sourceText: ""
      });
    }
  }

  async function startTextModeTranslation(settings = {}) {
    if (!window.__sottoTextMode?.start) {
      throw new Error("Text mode module is not loaded.");
    }
    const sessionSettings = { ...overlaySettings(), ...settings };
    createOverlay();
    overlayVisible = true;
    isHidden = false;
    root.hidden = false;
    currentState = { ...currentState, ...sessionSettings };
    syncRequestedControlsFromState(currentState);

    if (textSession) return liveSnapshot("Live Translator (text)");

    currentTargetText = "";
    currentSourceText = "";
    previousFinalizedTarget = "";
    render(liveSnapshot("Capturing video audio", {
      running: false,
      connecting: true,
      targetText: ""
    }));

    const video = document.querySelector("video");
    if (!video) throw new Error("No video element was found on this page.");
    const stream = await capturedVideoStream(video);
    applyAudioMix(sessionSettings, { remote: false });

    // Mark session up-front so a quick double-Start can't open two
    // peer connections.
    textSession = { stream, settings: sessionSettings };

    try {
      await window.__sottoTextMode.start({
        stream,
        settings: sessionSettings,
        sendRuntimeMessage,
        onStatus: (status) => {
          if (!textSession) return;
          notifyLive(status);
        },
        onPartialSource: (text) => {
          if (!textSession) return;
          currentSourceText = text;
          notifyLive("Live Translator (text)");
        },
        onFinalSource: (text) => {
          if (!textSession) return;
          currentSourceText = text;
          notifyLive("Live Translator (text)");
        },
        onPartialTarget: (text) => {
          if (!textSession) return;
          currentTargetText = text;
          isStreaming = true;
          notifyLive("Live Translator (text)");
        },
        onFinalTarget: (text /*, meta */) => {
          if (!textSession) return;
          if (currentTargetText) previousFinalizedTarget = currentTargetText;
          currentTargetText = text;
          isStreaming = false;
          notifyLive("Live Translator (text)");
        },
        onError: (error) => {
          trace("text_mode.session.error", {
            errorMessage: error?.message || null
          });
          if (textSession) notifyLive(error?.message || "Translation error");
        },
        onClosed: (reason) => {
          trace("text_mode.session.closed", { reason });
        }
      });

      sessionStartedAt = Date.now();
      startTickerTimer();
      const snapshot = liveSnapshot("Live Translator (text)");
      notifyLive("Live Translator (text)");
      return snapshot;
    } catch (error) {
      trace("text_mode.session.start_error", {
        errorMessage: error?.message || "Could not start text translation."
      });
      await stopTextModeTranslation("start_error", false);
      render({
        ...currentState,
        ...overlaySettings(),
        running: false,
        connecting: false,
        status: error?.message || "Could not start text translation.",
        targetText: "",
        sourceText: ""
      });
      throw error;
    }
  }

  async function startPageTranslation(settings = {}, options = {}) {
    const sessionSettings = { ...overlaySettings(), ...settings };
    // Hard guard: voice-mode start must NEVER run when the user
    // selected text mode. Without this, any code path that loses the
    // mode field would silently start translated audio playback
    // (text mode is captions-only by contract).
    if (settings?.mode === "text" || mode === "text") {
      throw new Error("Voice-mode start was called while text mode is selected.");
    }
    createOverlay();
    overlayVisible = true;
    isHidden = false;
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
    currentTargetText = "";
    currentSourceText = "";
    if (!isHandover) previousFinalizedTarget = "";
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
    trace("content.session.start_requested", { token, href: window.location.href });

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
      if (!video) throw new Error("No video element was found on this page.");
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
        trace("peer.connection_state", { token, connectionState: pc.connectionState });
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
        trace("peer.signaling_state", { token, signalingState: pc.signalingState });
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
      // On a language/voice handover, keep the cumulative session
      // timer + cost so the user sees the TRUE total spend — not
      // a misleading $0.00 reset every time they switch languages.
      if (!isHandover || !sessionStartedAt) {
        sessionStartedAt = Date.now();
      }
      startTickerTimer();
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
          activeTargetLanguage ||
          previousSession?.targetLanguage ||
          currentState.targetLanguage;
        requestedTranslationVoice =
          activeTranslationVoice ||
          previousSession?.translationVoice ||
          currentState.translationVoice;
      }
      render({
        ...currentState,
        ...overlaySettings(),
        running: Boolean(isHandover && previousSession),
        connecting: false,
        status: error?.message || "Could not start live translation.",
        targetText: "",
        sourceText: ""
      });
      throw error;
    }
  }

  // ===========================================================
  // Cost ticker
  // ===========================================================
  function formatTickerTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatCost(amount) {
    return `$${amount.toFixed(2)}`;
  }

  function updateTicker() {
    if (!sessionStartedAt || !elements.tickerTime) return;
    const elapsedSec = Math.max(0, (Date.now() - sessionStartedAt) / 1000);
    const cost = (elapsedSec / 60) * costPerMinute();
    elements.tickerTime.textContent = formatTickerTime(elapsedSec);
    elements.tickerAmount.textContent = formatCost(cost);
    elements.ticker.classList.toggle("is-warn", cost >= COST_WARN_THRESHOLD);
    if (pill && isHidden) updatePill(cost);
  }

  function startTickerTimer() {
    stopTickerTimer();
    updateTicker();
    tickerTimer = window.setInterval(updateTicker, 1000);
  }

  function stopTickerTimer() {
    if (tickerTimer) {
      window.clearInterval(tickerTimer);
      tickerTimer = undefined;
    }
    if (elements.tickerTime) {
      elements.tickerTime.textContent = "00:00";
      elements.tickerAmount.textContent = "$0.00";
      elements.ticker?.classList.remove("is-warn");
    }
  }

  function currentCost() {
    if (!sessionStartedAt) return 0;
    return ((Date.now() - sessionStartedAt) / 1000 / 60) * costPerMinute();
  }

  // ===========================================================
  // Overlay creation
  // ===========================================================
  function brandMarkSvg() {
    const src = chrome.runtime.getURL("assets/icons/brand-mark-64.png");
    return `
      <span class="lt-mark" aria-hidden="true">
        <img src="${src}" width="28" height="28" alt="" />
      </span>
    `;
  }

  function gearSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  }

  function closeSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  }

  function pauseSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>`;
  }

  function eyeSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }

  function ccSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M9 10a2 2 0 0 0-3 0v4a2 2 0 0 0 3 0"/><path d="M17 10a2 2 0 0 0-3 0v4a2 2 0 0 0 3 0"/></svg>`;
  }

  function dropletSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11z"></path></svg>`;
  }

  function hideSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  }

  function stopSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`;
  }

  function playSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"></path></svg>`;
  }

  function buildLanguageOptions(select) {
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
    select.replaceChildren(commonGroup, moreGroup);
  }

  function buildVoiceOptions(select) {
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
    select.replaceChildren(preferredGroup, moreGroup);
  }

  function createOverlay() {
    if (root) return;

    root = document.createElement("aside");
    root.className = "lt-root is-idle";
    root.dataset.mode = mode || "voice";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "SaySame live translator");

    // Restore saved bar position + size if present
    try {
      void chrome.storage.local.get(["barPosition", "barSize"]).then((stored) => {
        if (!root) return;
        const pos = stored?.barPosition;
        if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
          const margin = 8;
          const left = Math.max(margin, Math.min(window.innerWidth - 100, pos.left));
          const top = Math.max(margin, Math.min(window.innerHeight - 60, pos.top));
          root.style.left = `${left}px`;
          root.style.top = `${top}px`;
          root.style.right = "auto";
          root.style.bottom = "auto";
          root.style.transform = "none";
        }
        const sz = stored?.barSize;
        // Floor at 600px so an accidental tiny resize doesn't trap the
        // user with a narrow bar on every reload. Default (~880px) is
        // restored if the saved width was too small.
        if (sz) {
          if (typeof sz.width === "number" && sz.width >= 600) {
            const w = Math.max(600, Math.min(window.innerWidth - 16, sz.width));
            root.style.setProperty("--lt-bar-width", `${w}px`);
          }
          if (typeof sz.captionsHeight === "number") {
            const h = Math.max(60, Math.min(window.innerHeight * 0.5, sz.captionsHeight));
            root.style.setProperty("--lt-captions-min-height", `${h}px`);
          }
        }
      }).catch(() => {});
    } catch {}
    root.innerHTML = `
      <div class="lt-panel">
        <span class="lt-resize-handle lt-resize-handle-w" data-lt-resize="w" aria-hidden="true"></span>
        <span class="lt-resize-handle lt-resize-handle-e" data-lt-resize="e" aria-hidden="true"></span>
        <span class="lt-resize-handle lt-resize-handle-s" data-lt-resize="s" aria-hidden="true"></span>
        <span class="lt-resize-handle lt-resize-handle-sw" data-lt-resize="sw" aria-hidden="true"></span>
        <span class="lt-resize-handle lt-resize-handle-se" data-lt-resize="se" aria-hidden="true"></span>
        <div class="lt-settings" data-lt-settings>
          <div class="lt-settings-header">
            <span class="lt-settings-title">Settings</span>
            <button class="lt-btn lt-btn-icon" type="button" data-lt-settings-close aria-label="Close settings">${closeSvg()}</button>
          </div>

          <div class="lt-settings-section">
            <div class="lt-settings-row lt-secret-row">
              <label class="lt-settings-label" for="lt-openai-key">OpenAI API key</label>
              <input class="lt-input" type="password" id="lt-openai-key" autocomplete="off" spellcheck="false" placeholder="sk-..." data-lt-openai-key />
              <button class="lt-secret-toggle" type="button" data-lt-key-toggle aria-label="Show key">${eyeSvg()}</button>
            </div>
          </div>

          <div class="lt-settings-section">
            <div class="lt-settings-row">
              <span class="lt-settings-label">Default mode</span>
              <select class="lt-input" data-lt-default-mode>
                <option value="voice">Voice (realtime audio · ~$0.034/min)</option>
                <option value="text">Text (captions only · ~$0.02/min)</option>
              </select>
            </div>
            <div class="lt-settings-row">
              <span class="lt-settings-label">Default voice</span>
              <select class="lt-input" data-lt-default-voice></select>
            </div>
            <div class="lt-settings-row">
              <span class="lt-settings-label">Default language</span>
              <select class="lt-input" data-lt-default-language></select>
            </div>
          </div>

          <div class="lt-settings-section">
            <div class="lt-settings-row">
              <span class="lt-settings-label">Bar transparency</span>
              <div class="lt-slider-row">
                <input class="lt-slider" type="range" min="0" max="100" step="1" data-lt-opacity />
                <span class="lt-slider-value" data-lt-opacity-value>100</span>
              </div>
              <div class="lt-presets">
                <button class="lt-preset" type="button" data-lt-preset="100">Solid</button>
                <button class="lt-preset" type="button" data-lt-preset="70">70%</button>
                <button class="lt-preset" type="button" data-lt-preset="40">40%</button>
              </div>
            </div>
          </div>

          <div class="lt-settings-section">
            <label class="lt-switch">
              <input type="checkbox" data-lt-show-captions checked />
              <span>Show captions in voice mode</span>
            </label>
          </div>

          <div class="lt-settings-section">
            <div class="lt-settings-row">
              <span class="lt-settings-label">Original video volume</span>
              <div class="lt-slider-row">
                <input class="lt-slider" type="range" min="0" max="100" step="1" data-lt-original-volume />
                <span class="lt-slider-value" data-lt-original-volume-value>18</span>
              </div>
            </div>
            <div class="lt-settings-row">
              <span class="lt-settings-label">Translated voice volume</span>
              <div class="lt-slider-row">
                <input class="lt-slider" type="range" min="0" max="100" step="1" data-lt-translation-volume />
                <span class="lt-slider-value" data-lt-translation-volume-value>100</span>
              </div>
            </div>
          </div>

          <div class="lt-settings-section">
            <label class="lt-switch">
              <input type="checkbox" data-lt-bridge-mode />
              <span>Use local bridge (advanced)</span>
            </label>
            <div class="lt-bridge-fields" data-lt-bridge-fields hidden>
              <div class="lt-settings-row">
                <label class="lt-settings-label" for="lt-bridge-token">Bridge token</label>
                <input class="lt-input" type="password" id="lt-bridge-token" autocomplete="off" spellcheck="false" data-lt-bridge-token />
              </div>
            </div>
          </div>
        </div>

        <div class="lt-strip" data-lt-drag-handle>
          <div class="lt-brand lt-no-drag">
            ${brandMarkSvg()}
            <span class="lt-wordmark">SaySame</span>
            <span class="lt-live" aria-label="Live">
              <span class="lt-live-dot"></span>
              <span>Live</span>
            </span>
          </div>

          <!-- Idle controls -->
          <div class="lt-mode lt-idle-only lt-no-drag" data-lt-mode data-mode="voice" role="tablist" aria-label="Translation mode">
            <span class="lt-mode-indicator" aria-hidden="true"></span>
            <button class="lt-mode-segment" type="button" data-segment="voice" role="tab" aria-selected="true">
              <span aria-hidden="true">🎙</span><span>Voice</span>
            </button>
            <button class="lt-mode-segment" type="button" data-segment="text" role="tab" aria-selected="false">
              <span aria-hidden="true">💬</span><span>Text</span>
            </button>
          </div>

          <div class="lt-select lt-idle-only lt-no-drag" data-lt-voice-wrap>
            <select aria-label="Translation voice" data-lt-voice></select>
          </div>

          <div class="lt-select lt-no-drag" data-lt-language-wrap>
            <select aria-label="Hear language" data-lt-language></select>
          </div>

          <span class="lt-spacer"></span>

          <button class="lt-btn lt-btn-primary lt-idle-only lt-no-drag" type="button" data-lt-start>Start</button>

          <!-- Active controls -->
          <span class="lt-ticker lt-active-only lt-no-drag" data-lt-ticker>
            <span data-lt-ticker-time class="lt-ticker-time">00:00</span>
            <span class="lt-ticker-sep">·</span>
            <span data-lt-ticker-amount class="lt-ticker-amount">$0.00</span>
          </span>

          <div class="lt-transparency-wrap lt-active-only lt-no-drag">
            <button class="lt-btn lt-btn-icon" type="button" data-lt-transparency aria-label="Bar transparency">${dropletSvg()}</button>
            <div class="lt-popover" data-lt-popover>
              <button class="lt-popover-btn" type="button" data-lt-preset-quick="100">Solid</button>
              <button class="lt-popover-btn" type="button" data-lt-preset-quick="70">70%</button>
              <button class="lt-popover-btn" type="button" data-lt-preset-quick="40">40%</button>
            </div>
          </div>

          <button class="lt-btn lt-btn-icon lt-no-drag lt-voice-only" type="button" data-lt-cc aria-label="Toggle captions" aria-pressed="true">${ccSvg()}</button>

          <button class="lt-btn lt-btn-icon lt-no-drag" type="button" data-lt-gear aria-label="Settings">${gearSvg()}</button>

          <button class="lt-btn lt-btn-icon lt-active-only lt-no-drag" type="button" data-lt-hide aria-label="Hide bar">${hideSvg()}</button>

          <button class="lt-btn lt-btn-stop lt-active-only lt-no-drag" type="button" data-lt-stop aria-label="Stop"><span class="lt-btn-stop-icon" aria-hidden="true">${stopSvg()}</span><span class="lt-btn-stop-label">Stop</span></button>

          <button class="lt-btn lt-btn-icon lt-idle-only lt-no-drag" type="button" data-lt-close aria-label="Close">${closeSvg()}</button>
        </div>

        <div class="lt-error-banner" data-lt-error hidden>
          <span class="lt-error-message" data-lt-error-message></span>
          <button class="lt-error-close" type="button" data-lt-error-close aria-label="Dismiss error">×</button>
        </div>

        <div class="lt-captions" data-lt-captions>
          <div class="lt-captions-inner">
            <p class="lt-caption-prev" data-lt-caption-prev></p>
            <p class="lt-caption-current" data-lt-caption-current></p>
          </div>
        </div>
      </div>
    `;

    document.documentElement.append(root);

    elements = {
      panel: root.querySelector(".lt-panel"),
      strip: root.querySelector(".lt-strip"),
      brand: root.querySelector(".lt-brand"),

      mode: root.querySelector("[data-lt-mode]"),
      modeSegments: root.querySelectorAll("[data-segment]"),

      voiceWrap: root.querySelector("[data-lt-voice-wrap]"),
      voiceSelect: root.querySelector("[data-lt-voice]"),
      languageWrap: root.querySelector("[data-lt-language-wrap]"),
      languageSelect: root.querySelector("[data-lt-language]"),

      startBtn: root.querySelector("[data-lt-start]"),
      stopBtn: root.querySelector("[data-lt-stop]"),
      gearBtn: root.querySelector("[data-lt-gear]"),
      closeBtn: root.querySelector("[data-lt-close]"),
      hideBtn: root.querySelector("[data-lt-hide]"),
      transparencyBtn: root.querySelector("[data-lt-transparency]"),
      ccBtn: root.querySelector("[data-lt-cc]"),

      ticker: root.querySelector("[data-lt-ticker]"),
      tickerTime: root.querySelector("[data-lt-ticker-time]"),
      tickerAmount: root.querySelector("[data-lt-ticker-amount]"),

      popover: root.querySelector("[data-lt-popover]"),
      presetQuickBtns: root.querySelectorAll("[data-lt-preset-quick]"),

      captions: root.querySelector("[data-lt-captions]"),
      captionPrev: root.querySelector("[data-lt-caption-prev]"),
      captionCurrent: root.querySelector("[data-lt-caption-current]"),

      errorBanner: root.querySelector("[data-lt-error]"),
      errorMessage: root.querySelector("[data-lt-error-message]"),
      errorClose: root.querySelector("[data-lt-error-close]"),

      // Settings
      settings: root.querySelector("[data-lt-settings]"),
      settingsClose: root.querySelector("[data-lt-settings-close]"),
      openaiKeyInput: root.querySelector("[data-lt-openai-key]"),
      keyToggle: root.querySelector("[data-lt-key-toggle]"),
      defaultMode: root.querySelector("[data-lt-default-mode]"),
      defaultVoice: root.querySelector("[data-lt-default-voice]"),
      defaultLanguage: root.querySelector("[data-lt-default-language]"),
      opacitySlider: root.querySelector("[data-lt-opacity]"),
      opacityValue: root.querySelector("[data-lt-opacity-value]"),
      presetBtns: root.querySelectorAll("[data-lt-preset]"),
      showCaptionsToggle: root.querySelector("[data-lt-show-captions]"),
      originalVolumeSlider: root.querySelector("[data-lt-original-volume]"),
      originalVolumeValueLabel: root.querySelector("[data-lt-original-volume-value]"),
      translationVolumeSlider: root.querySelector("[data-lt-translation-volume]"),
      translationVolumeValueLabel: root.querySelector("[data-lt-translation-volume-value]"),
      bridgeMode: root.querySelector("[data-lt-bridge-mode]"),
      bridgeFields: root.querySelector("[data-lt-bridge-fields]"),
      bridgeToken: root.querySelector("[data-lt-bridge-token]")
    };

    buildVoiceOptions(elements.voiceSelect);
    buildLanguageOptions(elements.languageSelect);
    buildVoiceOptions(elements.defaultVoice);
    buildLanguageOptions(elements.defaultLanguage);
    bindOverlayEvents();
    applyOpacity();
  }

  function createPill() {
    pill = document.createElement("button");
    pill.type = "button";
    pill.className = "lt-pill";
    pill.setAttribute("aria-label", "Show SaySame bar");
    pill.innerHTML = `
      <span class="lt-pill-icon">${playSvg()}</span>
      <span class="lt-pill-amount" data-lt-pill-amount>$0.00</span>
      <span class="lt-pill-close" data-lt-pill-close aria-label="Stop translation">×</span>
    `;
    document.documentElement.append(pill);
    pill.addEventListener("click", (event) => {
      if (event.target.closest("[data-lt-pill-close]")) {
        event.stopPropagation();
        void handleStop();
        return;
      }
      expandFromPill();
    });
  }

  function updatePill(cost = currentCost()) {
    if (!pill) return;
    const amountEl = pill.querySelector("[data-lt-pill-amount]");
    if (amountEl) amountEl.textContent = formatCost(cost);
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

  // ===========================================================
  // Settings persistence (read/write same keys popup used)
  // ===========================================================
  function fallbackState() {
    return {
      running: false,
      connecting: false,
      status: "Ready",
      sourceText: "",
      targetText: "",
      backendUrl: "http://127.0.0.1:8799",
      sourceLanguage: "auto",
      targetLanguage: "en",
      translationVoice: "marin",
      translationMode: "sync",
      originalVolume: 18,
      translationVolume: 100,
      showSource: false,
      connectionMode: "extension",
      openaiApiKey: "",
      bridgeToken: "",
      mode: "voice",
      barOpacity: 100
    };
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
      showSource: currentState.showSource ?? false,
      connectionMode: currentState.connectionMode || "extension",
      openaiApiKey: currentState.openaiApiKey || "",
      bridgeToken: currentState.bridgeToken || ""
    };
  }

  function selectedOverlaySettings() {
    const settings = overlaySettings();
    // Read the key/token DIRECTLY from the inputs when present (even if
    // empty) so an intentional clear actually clears, instead of falling
    // back to the stored value via `||`.
    const keyInputPresent = !!elements?.openaiKeyInput;
    const tokenInputPresent = !!elements?.bridgeToken;
    return {
      ...settings,
      targetLanguage:
        elements?.languageSelect?.value ||
        requestedTargetLanguage ||
        settings.targetLanguage,
      translationVoice:
        elements?.voiceSelect?.value ||
        requestedTranslationVoice ||
        settings.translationVoice,
      connectionMode: elements?.bridgeMode?.checked ? "bridge" : "extension",
      openaiApiKey: keyInputPresent
        ? elements.openaiKeyInput.value.trim()
        : settings.openaiApiKey,
      bridgeToken: tokenInputPresent
        ? elements.bridgeToken.value.trim()
        : settings.bridgeToken
    };
  }

  async function persistOverlaySettings(extra = {}) {
    const settings = { ...selectedOverlaySettings(), ...extra };
    currentState = { ...currentState, ...settings };
    try {
      await chrome.storage.local.set({
        ...settings,
        mode,
        barOpacity
      });
    } catch (error) {
      trace("settings.persist_error", { errorMessage: error?.message || null });
    }
    return settings;
  }

  async function pushSettingsToBackground() {
    const settings = await persistOverlaySettings();
    if (pageSession || currentState.running || currentState.connecting) {
      const response = await sendRuntimeMessage({
        type: "UPDATE_SETTINGS",
        settings
      }).catch(() => null);
      if (response?.state) currentState = { ...currentState, ...response.state };
    }
  }

  // ===========================================================
  // Error banner — surfaces Start failures so the user actually
  // sees what went wrong instead of the bar silently snapping back
  // to idle. Stays visible until dismissed or the next Start click.
  // ===========================================================
  function friendlyErrorMessage(raw) {
    const message = String(raw || "").trim();
    if (!message) return "Could not start live translation.";
    if (/api key/i.test(message)) {
      return "Open settings (⚙) and add your OpenAI API key, then try again.";
    }
    if (/could not reach openai/i.test(message)) {
      return "Network error reaching OpenAI. Check your connection and try again.";
    }
    return message;
  }

  function showErrorBanner(message) {
    if (!elements.errorBanner || !elements.errorMessage) return;
    elements.errorMessage.textContent = friendlyErrorMessage(message);
    elements.errorBanner.hidden = false;
  }

  function hideErrorBanner() {
    if (!elements.errorBanner) return;
    elements.errorBanner.hidden = true;
    if (elements.errorMessage) elements.errorMessage.textContent = "";
  }

  // ===========================================================
  // Event binding
  // ===========================================================
  function bindOverlayEvents() {
    // Unlock audio on user gesture anywhere on the bar
    root.addEventListener(
      "pointerdown",
      () => {
        playRemoteAudio(pageSession, "overlay_gesture");
      },
      { capture: true }
    );

    // Mode toggle (voice ↔ text). Switching while a session is
    // running is intentionally not supported — user must Stop first.
    elements.modeSegments.forEach((segment) => {
      segment.addEventListener("click", () => {
        const next = segment.dataset.segment;
        if (next === mode) return;
        if (next !== "voice" && next !== "text") return;
        if (pageSession || textSession) {
          showTooltip(segment, "Stop translation first");
          return;
        }
        setMode(next);
        void persistOverlaySettings();
      });
    });

    // Voice picker
    elements.voiceSelect.addEventListener("change", async () => {
      const translationVoice = elements.voiceSelect.value;
      requestedTranslationVoice = translationVoice;
      if (pageSession) {
        render(liveSnapshot("Switching voice", {
          running: true,
          connecting: true,
          targetText: ""
        }));
      }
      await pushSettingsToBackground();
    });

    // Language picker — warm + change
    for (const eventName of ["pointerdown", "focus", "mouseenter"]) {
      elements.languageSelect.addEventListener(eventName, () => {
        warmTranslationLanguages(`language_${eventName}`);
      });
    }
    elements.languageSelect.addEventListener("change", async () => {
      const targetLanguage = elements.languageSelect.value;
      requestedTargetLanguage = targetLanguage;
      updateLanguageFlagAttr();
      warmTranslationLanguages("language_change", targetLanguage);
      if (pageSession) {
        render(liveSnapshot("Switching language", {
          running: true,
          connecting: true,
          targetText: "",
          displayTargetLanguage: targetLanguage
        }));
      }
      await pushSettingsToBackground();
    });

    // Start button
    elements.startBtn.addEventListener("click", async () => {
      elements.startBtn.disabled = true;
      hideErrorBanner();
      try {
        const settings = { ...selectedOverlaySettings(), mode };
        const response = await sendRuntimeMessage({
          type: "START_TRANSLATION",
          settings
        });
        if (!response?.ok) {
          throw new Error(response?.error || "Could not start live translation.");
        }
        if (response.state) currentState = { ...currentState, ...response.state };
      } catch (error) {
        const message = error?.message || "Could not start live translation.";
        showErrorBanner(message);
        render({
          ...fallbackState(),
          ...currentState,
          running: false,
          connecting: false,
          status: message
        });
      } finally {
        elements.startBtn.disabled = false;
      }
    });

    // Stop button (Pause was removed — it was just a duplicate Stop and
    // misled users into thinking the session paused / billing paused).
    elements.stopBtn.addEventListener("click", () => void handleStop());

    // Error banner dismiss button
    elements.errorClose?.addEventListener("click", () => hideErrorBanner());

    // Hide button — collapse to pill
    elements.hideBtn.addEventListener("click", () => {
      collapseToPill();
    });

    // Close button (idle)
    elements.closeBtn.addEventListener("click", () => {
      hideOverlay();
    });

    // Gear — open / close settings
    elements.gearBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      toggleSettings();
    });
    elements.settingsClose.addEventListener("click", (event) => {
      event.stopPropagation();
      closeSettings();
    });

    // Click outside settings closes it
    document.addEventListener("mousedown", (event) => {
      if (!settingsOpen) return;
      if (event.target.closest(".lt-settings, [data-lt-gear]")) return;
      closeSettings();
    }, true);

    // Transparency popover
    elements.transparencyBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      popoverOpen = !popoverOpen;
      elements.popover.classList.toggle("is-open", popoverOpen);
    });
    document.addEventListener("click", (event) => {
      if (!popoverOpen) return;
      if (event.target.closest("[data-lt-popover], [data-lt-transparency]")) return;
      popoverOpen = false;
      elements.popover.classList.remove("is-open");
    });
    elements.presetQuickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        setOpacity(Number(btn.dataset.ltPresetQuick));
        popoverOpen = false;
        elements.popover.classList.remove("is-open");
      });
    });

    // Settings: API key
    elements.openaiKeyInput.addEventListener("blur", () => {
      void persistOverlaySettings();
    });
    elements.keyToggle.addEventListener("click", () => {
      const isPassword = elements.openaiKeyInput.type === "password";
      elements.openaiKeyInput.type = isPassword ? "text" : "password";
      elements.keyToggle.setAttribute(
        "aria-label",
        isPassword ? "Hide key" : "Show key"
      );
    });

    // Settings: defaults
    elements.defaultMode.addEventListener("change", () => {
      const next = elements.defaultMode.value;
      if (next !== "voice" && next !== "text") return;
      if (pageSession || textSession) {
        showTooltip(elements.defaultMode, "Stop translation first");
        elements.defaultMode.value = mode;
        return;
      }
      setMode(next);
      void persistOverlaySettings();
    });
    elements.defaultVoice.addEventListener("change", () => {
      elements.voiceSelect.value = elements.defaultVoice.value;
      requestedTranslationVoice = elements.defaultVoice.value;
      void pushSettingsToBackground();
    });
    elements.defaultLanguage.addEventListener("change", () => {
      elements.languageSelect.value = elements.defaultLanguage.value;
      requestedTargetLanguage = elements.defaultLanguage.value;
      updateLanguageFlagAttr();
      void pushSettingsToBackground();
    });

    // Settings: opacity slider
    elements.opacitySlider.addEventListener("input", () => {
      setOpacity(Number(elements.opacitySlider.value));
    });
    elements.presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        setOpacity(Number(btn.dataset.ltPreset));
      });
    });

    // Settings: show-captions toggle (voice mode only — text mode
    // always shows captions because they're the whole point of it)
    const setShowCaptions = (showCaptions) => {
      currentState = { ...currentState, showCaptions };
      if (elements.showCaptionsToggle) elements.showCaptionsToggle.checked = showCaptions;
      if (elements.ccBtn) {
        elements.ccBtn.setAttribute("aria-pressed", String(showCaptions));
        elements.ccBtn.classList.toggle("is-off", !showCaptions);
      }
      applyShowCaptionsClass();
      try { void chrome.storage.local.set({ showCaptions }); } catch {}
    };
    elements.showCaptionsToggle.addEventListener("change", () => {
      setShowCaptions(elements.showCaptionsToggle.checked);
    });
    // CC button on the bar (voice mode only) — same toggle, just on
    // the bar so users don't have to open settings to flip it.
    elements.ccBtn.addEventListener("click", () => {
      setShowCaptions(currentState.showCaptions === false);
    });

    // Settings: volume sliders (original video / translated voice)
    elements.originalVolumeSlider.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, Number(elements.originalVolumeSlider.value) || 0));
      elements.originalVolumeValueLabel.textContent = String(v);
      currentState = { ...currentState, originalVolume: v };
      applyAudioMix({ ...overlaySettings(), originalVolume: v }, { remote: false });
      void persistOverlaySettings();
    });
    elements.translationVolumeSlider.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, Number(elements.translationVolumeSlider.value) || 0));
      elements.translationVolumeValueLabel.textContent = String(v);
      currentState = { ...currentState, translationVolume: v };
      applyAudioMix({ ...overlaySettings(), translationVolume: v }, { remote: true });
      void persistOverlaySettings();
    });

    // Settings: bridge
    elements.bridgeMode.addEventListener("change", () => {
      elements.bridgeFields.hidden = !elements.bridgeMode.checked;
      void pushSettingsToBackground();
    });
    elements.bridgeToken.addEventListener("blur", () => {
      void pushSettingsToBackground();
    });

    // Drag-to-move: any pointerdown on the strip that didn't hit a control
    // (controls have .lt-no-drag) starts a drag. We translate the bar by
    // adjusting `left` and `bottom` directly on root.style.
    elements.strip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(".lt-no-drag, button, select, input, .lt-popover, .lt-settings")) return;

      const rect = root.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        width: rect.width,
        height: rect.height
      };
      try { elements.strip.setPointerCapture(event.pointerId); } catch {}
      root.classList.add("is-dragging");
      event.preventDefault();
    });

    elements.strip.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 8;
      const newLeft = Math.max(margin, Math.min(vw - dragState.width - margin, dragState.originLeft + dx));
      const newTop = Math.max(margin, Math.min(vh - dragState.height - margin, dragState.originTop + dy));
      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.style.transform = "none";
    });

    const endDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      try { elements.strip.releasePointerCapture(event.pointerId); } catch {}
      dragState = null;
      root.classList.remove("is-dragging");
      try {
        const rect = root.getBoundingClientRect();
        void chrome.storage.local.set({
          barPosition: { left: rect.left, top: rect.top }
        });
      } catch {}
    };
    elements.strip.addEventListener("pointerup", endDrag);
    elements.strip.addEventListener("pointercancel", endDrag);

    // Resize handles: drag left/right edges to change width, bottom
    // edge to change captions area height.
    let resizeState = null;
    root.querySelectorAll("[data-lt-resize]").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const rect = root.getBoundingClientRect();
        const captionsRect = elements.captions?.getBoundingClientRect();
        resizeState = {
          mode: handle.dataset.ltResize,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originLeft: rect.left,
          originRight: rect.right,
          originWidth: rect.width,
          originCaptionsHeight: captionsRect?.height || 96
        };
        try { handle.setPointerCapture(event.pointerId); } catch {}
        root.classList.add("is-resizing");
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener("pointermove", (event) => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) return;
        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        const mode = resizeState.mode;
        // Width changes (sides + corners). Bar is centered, so each
        // pixel of pointer travel changes width by 2 (both sides shift).
        if (mode === "e" || mode === "se") {
          const w = Math.max(360, Math.min(window.innerWidth - 16, resizeState.originWidth + dx * 2));
          root.style.setProperty("--lt-bar-width", `${w}px`);
        } else if (mode === "w" || mode === "sw") {
          const w = Math.max(360, Math.min(window.innerWidth - 16, resizeState.originWidth - dx * 2));
          root.style.setProperty("--lt-bar-width", `${w}px`);
        }
        // Captions height changes (bottom edge + bottom corners).
        if (mode === "s" || mode === "sw" || mode === "se") {
          const h = Math.max(40, Math.min(window.innerHeight * 0.6, resizeState.originCaptionsHeight + dy));
          root.style.setProperty("--lt-captions-min-height", `${h}px`);
        }
      });
      const endResize = (event) => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) return;
        try { handle.releasePointerCapture(event.pointerId); } catch {}
        const widthPx = parseFloat(root.style.getPropertyValue("--lt-bar-width")) || null;
        const heightPx = parseFloat(root.style.getPropertyValue("--lt-captions-min-height")) || null;
        resizeState = null;
        root.classList.remove("is-resizing");
        try {
          void chrome.storage.local.set({
            barSize: {
              width: widthPx,
              captionsHeight: heightPx
            }
          });
        } catch {}
      };
      handle.addEventListener("pointerup", endResize);
      handle.addEventListener("pointercancel", endResize);
    });

    // Window resize: re-clamp bar position + width so we never end
    // up with controls pushed off-screen when the user shrinks the
    // window. Throttle via rAF.
    let resizeRaf = 0;
    window.addEventListener("resize", () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        if (!root) return;
        // Clamp width to fit current viewport.
        const widthVar = parseFloat(root.style.getPropertyValue("--lt-bar-width")) || 880;
        const maxWidth = window.innerWidth - 16;
        if (widthVar > maxWidth) {
          root.style.setProperty("--lt-bar-width", `${Math.max(360, maxWidth)}px`);
        }
        // Clamp position if user had previously dragged it.
        const rect = root.getBoundingClientRect();
        if (rect.width === 0) return;
        let left = rect.left;
        let top = rect.top;
        const margin = 8;
        const usingExplicitPos = root.style.left && root.style.left !== "50%";
        if (usingExplicitPos) {
          left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
          top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, top));
          root.style.left = `${left}px`;
          root.style.top = `${top}px`;
        }
      });
    });
  }

  function toggleSettings() {
    if (settingsOpen) closeSettings();
    else openSettings();
  }
  function openSettings() {
    settingsOpen = true;
    root.classList.add("is-settings-open");
  }
  function closeSettings() {
    settingsOpen = false;
    root.classList.remove("is-settings-open");
  }

  function setMode(next) {
    if (next !== "voice" && next !== "text") return;
    mode = next;
    if (root) root.dataset.mode = mode;
    if (elements.mode) {
      elements.mode.dataset.mode = mode;
      elements.modeSegments.forEach((s) => {
        s.setAttribute("aria-selected", String(s.dataset.segment === mode));
      });
    }
    // Voice picker is irrelevant in text mode — gray it out so users
    // don't think their voice choice is doing anything.
    elements.voiceWrap?.classList.toggle("is-disabled", mode === "text");
    applyShowCaptionsClass();
    if (elements.defaultMode) elements.defaultMode.value = mode;
  }

  function setOpacity(value) {
    barOpacity = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    elements.opacitySlider.value = String(barOpacity);
    elements.opacityValue.textContent = String(barOpacity);
    applyOpacity();
    void persistOverlaySettings();
  }

  function applyOpacity() {
    if (!root) return;
    const fraction = barOpacity / 100;
    root.style.setProperty("--lt-bar-opacity", String(fraction));
    root.classList.toggle("is-translucent", barOpacity < 100);
  }

  // Toggle .is-captions-off when user has unchecked "Show captions in
  // voice mode" AND we're in voice mode. Text mode always shows
  // captions regardless.
  function applyShowCaptionsClass() {
    if (!root) return;
    const showCaptions = currentState.showCaptions !== false;
    const captionsOff = !showCaptions && mode === "voice";
    root.classList.toggle("is-captions-off", captionsOff);
  }

  function showTooltip(anchor, text) {
    const existing = root.querySelector(".lt-tooltip");
    if (existing) existing.remove();
    const tooltip = document.createElement("div");
    tooltip.className = "lt-tooltip";
    tooltip.textContent = text;
    root.appendChild(tooltip);
    const anchorRect = anchor.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    tooltip.style.left = `${anchorRect.left - rootRect.left + anchorRect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${anchorRect.top - rootRect.top - tooltip.offsetHeight - 6}px`;
    requestAnimationFrame(() => tooltip.classList.add("is-visible"));
    setTimeout(() => {
      tooltip.classList.remove("is-visible");
      setTimeout(() => tooltip.remove(), 200);
    }, 1600);
  }

  async function handleStop() {
    if (
      !pageSession &&
      !textSession &&
      !currentState.running &&
      !currentState.connecting
    ) return;
    try {
      if (textSession) {
        await stopTextModeTranslation("overlay_stop", false);
      } else {
        await stopPageTranslation("overlay_stop", false);
      }
      const response = await sendRuntimeMessage({ type: "STOP_TRANSLATION" }).catch(
        () => null
      );
      if (response?.state) currentState = { ...currentState, ...response.state };
    } catch (error) {
      trace("overlay.stop_error", { errorMessage: error?.message || null });
    }
    if (isHidden) {
      isHidden = false;
      pill?.classList.remove("is-visible");
      if (root) root.hidden = false;
    }
  }

  // ===========================================================
  // Render — translates state into DOM
  // ===========================================================
  function render(state) {
    createOverlay();
    const { displayTargetLanguage, ...persistedState } = state;
    currentState = { ...currentState, ...persistedState };
    delete currentState.displayTargetLanguage;
    applyAudioMix(currentState);
    if (overlayVisible && !isHidden) {
      root.hidden = false;
    }

    const isActive = Boolean(
      state.running || state.connecting || pageSession || textSession
    );
    root.classList.toggle("is-active", isActive);
    root.classList.toggle("is-idle", !isActive);
    root.classList.toggle("is-connecting", Boolean(state.connecting));

    // Mode toggle reflects current mode
    if (elements.mode) {
      elements.mode.dataset.mode = mode;
      elements.modeSegments.forEach((s) => {
        s.setAttribute("aria-selected", String(s.dataset.segment === mode));
      });
      elements.voiceWrap.classList.toggle("is-disabled", mode === "text");
    }

    // Selects reflect current selection
    const selectedLanguage =
      requestedTargetLanguage ||
      state.targetLanguage ||
      currentState.targetLanguage ||
      "de";
    if (elements.languageSelect.value !== selectedLanguage) {
      elements.languageSelect.value = selectedLanguage;
    }
    const selectedVoice =
      requestedTranslationVoice ||
      state.translationVoice ||
      currentState.translationVoice ||
      "marin";
    elements.voiceSelect.value = VOICE_OPTIONS.some(({ id }) => id === selectedVoice)
      ? selectedVoice
      : "marin";

    // Captions
    renderCaptions(state);
  }

  function renderCaptions(state) {
    if (!elements.captionCurrent) return;
    const current = normalizeText(state.targetText || currentTargetText);
    const previous = normalizeText(previousFinalizedTarget);

    if (!current && !previous) {
      elements.captionPrev.textContent = "";
      elements.captionCurrent.textContent =
        state.connecting
          ? "Listening..."
          : (pageSession || textSession ? "Listening..." : "");
      elements.captionCurrent.classList.remove("is-streaming");
      return;
    }

    elements.captionPrev.textContent = previous && previous !== current ? previous : "";
    elements.captionCurrent.textContent = current || "";
    elements.captionCurrent.classList.toggle("is-streaming", isStreaming && !!current);

    const langCode = activeDisplayLanguage(state);
    elements.captionCurrent.lang = langCode || "";
    elements.captionCurrent.dir = textDirection(langCode);
    elements.captionPrev.lang = langCode || "";
    elements.captionPrev.dir = textDirection(langCode);

    // Auto-scroll to the latest line so the user always sees what's
    // currently being transcribed, even if they shrink the captions
    // box. Defer to next frame so layout has settled.
    if (elements.captions) {
      requestAnimationFrame(() => {
        if (elements.captions) {
          elements.captions.scrollTop = elements.captions.scrollHeight;
        }
      });
    }
  }

  // ===========================================================
  // Initial state sync
  // ===========================================================
  async function syncInitialState() {
    const stored = await chrome.storage.local.get(null);
    if (stored && typeof stored === "object") {
      currentState = { ...fallbackState(), ...stored };
      mode = stored.mode === "text" ? "text" : "voice";
      barOpacity = Number.isFinite(Number(stored.barOpacity))
        ? Number(stored.barOpacity)
        : 100;
    } else {
      currentState = fallbackState();
    }

    const response = await sendRuntimeMessage({ type: "GET_STATE" }).catch(() => null);
    if (response?.state) currentState = { ...currentState, ...response.state };
    syncRequestedControlsFromState(currentState);
  }

  function applyStoredSettingsToControls() {
    if (!elements.openaiKeyInput) return;
    elements.openaiKeyInput.value = currentState.openaiApiKey || "";
    elements.bridgeMode.checked = currentState.connectionMode === "bridge";
    elements.bridgeFields.hidden = !elements.bridgeMode.checked;
    elements.bridgeToken.value = currentState.bridgeToken || "";
    elements.defaultMode.value = mode;
    elements.defaultVoice.value = currentState.translationVoice || "marin";
    elements.defaultLanguage.value = currentState.targetLanguage || "de";
    updateLanguageFlagAttr();
    elements.opacitySlider.value = String(barOpacity);
    elements.opacityValue.textContent = String(barOpacity);
    const ov = Number(currentState.originalVolume ?? 18);
    const tv = Number(currentState.translationVolume ?? 100);
    elements.originalVolumeSlider.value = String(ov);
    elements.originalVolumeValueLabel.textContent = String(ov);
    elements.translationVolumeSlider.value = String(tv);
    elements.translationVolumeValueLabel.textContent = String(tv);
    const showCaptions = currentState.showCaptions !== false;
    elements.showCaptionsToggle.checked = showCaptions;
    applyShowCaptionsClass();
    elements.mode.dataset.mode = mode;
    elements.modeSegments.forEach((s) => {
      s.setAttribute("aria-selected", String(s.dataset.segment === mode));
    });
    elements.voiceWrap.classList.toggle("is-disabled", mode === "text");
    elements.languageSelect.value = currentState.targetLanguage || "de";
    elements.voiceSelect.value = currentState.translationVoice || "marin";
    applyOpacity();
  }

  // ===========================================================
  // Background message handlers
  // ===========================================================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "CONTENT_PING") {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "TOGGLE_BAR") {
      createOverlay();
      applyStoredSettingsToControls();
      if (isHidden) {
        expandFromPill();
      } else if (overlayVisible && !root.hidden) {
        hideOverlay();
      } else {
        showOverlay();
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "CONTENT_UPDATE") {
      const nextState = { ...currentState, ...(message.state || {}) };
      currentState = nextState;
      if (!pageSession || !nextState.connecting) {
        syncRequestedControlsFromState(nextState);
      }
      if (overlayVisible || root) {
        if (!root) createOverlay();
        if (!isHidden) render(nextState);
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "CONTENT_START_PAGE_TRANSLATION") {
      (async () => {
        try {
          const requestedMode =
            message.settings?.mode === "text" ? "text" : "voice";
          // Sync the local mode state with whatever the popup/bar
          // requested so caption render + cost ticker reflect it.
          if (requestedMode !== mode) setMode(requestedMode);
          const state =
            requestedMode === "text"
              ? await startTextModeTranslation(message.settings || {})
              : await startPageTranslation(message.settings || {});
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
          if (nextSettings.targetLanguage) {
            requestedTargetLanguage = nextSettings.targetLanguage;
          }
          if (nextSettings.translationVoice) {
            requestedTranslationVoice = nextSettings.translationVoice;
          }
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
      if (textSession) {
        void stopTextModeTranslation("background_stop", false);
      } else {
        void stopPageTranslation("background_stop", false);
      }
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  // Inject a small SaySame button into YouTube's player chrome
  // (next to the closed-caption button). Mirrors the convenience of
  // toolbar-icon click, but right where users are looking.
  function injectYouTubePlayerButton() {
    try {
      if (!/^https?:\/\/([^/]+\.)?youtube\.com\//i.test(window.location.href)) return;
      if (document.getElementById("__saysame-yt-btn")) return;
      // YouTube's right-controls contains subcontainers
      // (.ytp-right-controls-left and .ytp-right-controls-right) and
      // the settings gear lives inside one of them. Insert next to the
      // gear by using ITS parent, not the outer rightControls.
      const settings = document.querySelector(".ytp-settings-button");
      if (!settings || !settings.parentElement) return;
      const parent = settings.parentElement;
      const btn = document.createElement("button");
      btn.id = "__saysame-yt-btn";
      btn.className = "ytp-button";
      btn.title = "Toggle SaySame translator";
      btn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:48px;height:100%;padding:0;background:transparent;border:0;cursor:pointer;vertical-align:top;";
      btn.innerHTML = `
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#D6FF3D;">
          <span style="font:700 14px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#0B0C0A;letter-spacing:-0.02em;">S</span>
        </span>
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!root) createOverlay();
        if (root.hasAttribute("hidden")) showOverlay();
        else hideOverlay();
      });
      parent.insertBefore(btn, settings);
    } catch {
      // Defensive — if YouTube's DOM shape changes again, don't break
      // the rest of the content script.
    }
  }

  // YouTube swaps its DOM frequently (SPA navigation, autoplay
  // transitions). Watch and re-inject if our button gets removed.
  function watchYouTubeForButton() {
    if (!/^https?:\/\/([^/]+\.)?youtube\.com\//i.test(window.location.href)) return;
    injectYouTubePlayerButton();
    const observer = new MutationObserver(() => {
      injectYouTubePlayerButton();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Bidirectional volume sync: when the user adjusts the page video's
  // own volume control (YouTube/Bilibili native slider), reflect it
  // in our "Original video volume" slider so they stay in sync. Our
  // slider already controls video.volume, so this closes the loop.
  let lastObservedVideo = null;
  function attachVolumeSyncListener() {
    const v = document.querySelector("video");
    if (!v || v === lastObservedVideo) return;
    lastObservedVideo = v;
    v.addEventListener("volumechange", () => {
      if (!root || !elements?.originalVolumeSlider) return;
      const observed = Math.round((v.muted ? 0 : v.volume) * 100);
      const known = Number(currentState.originalVolume ?? 18);
      // While Web Audio pipeline is active, applyAudioMix resets
      // video.volume to 1.0. Ignore those self-triggered events.
      if (audioPipeline && observed === 100) return;
      if (Math.abs(observed - known) < 1) return;
      currentState = { ...currentState, originalVolume: observed };
      elements.originalVolumeSlider.value = String(observed);
      elements.originalVolumeValueLabel.textContent = String(observed);
      // When pipeline is active the user's intent (lower playback)
      // must go through the Web Audio gain node, not video.volume.
      if (audioPipeline) {
        setPipelinePlaybackGain(observed / 100);
        // Restore video.volume to 1.0 so capture stays unaffected
        // (and the pipeline source keeps receiving full-strength audio).
        v.volume = 1.0;
      }
      try { void chrome.storage.local.set({ originalVolume: observed }); } catch {}
    });
  }
  // Re-check periodically because the <video> element can be created
  // late (YouTube SPA nav) or replaced.
  setInterval(attachVolumeSyncListener, 1500);

  // Boot
  (async () => {
    await syncInitialState();
    // Build the overlay DOM eagerly so applyStoredSettingsToControls works
    createOverlay();
    applyStoredSettingsToControls();
    // Stay hidden until user clicks the toolbar icon.
    hideOverlay();
    // Add the YouTube player-chrome button (no-op on other sites).
    watchYouTubeForButton();
  })();
})();
