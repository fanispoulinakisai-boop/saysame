// =====================================================================
// Sotto — cheap "text mode" pipeline.
//
// Pipeline (per page session):
//   1. Take the captured MediaStream from the page <video>.
//   2. Open a WebRTC realtime transcription session against OpenAI's
//      gpt-realtime-whisper model. Background mints an ephemeral
//      client_secret and exchanges the SDP (mirrors the voice-mode
//      machinery so the API key never enters the content script).
//   3. As Whisper streams transcript deltas + finalized segments,
//      forward each finalized segment to background which calls
//      gpt-4o-mini chat completions to translate it. The translated
//      text is returned to us and rendered as the target caption.
//
// No translated audio is played — captions only. Estimated cost
// ~$0.02 per minute of session time (Whisper ≈ $0.017/min + a small
// gpt-4o-mini bill per finalized segment).
//
// Public surface (exposed on window so content.js can wire it up):
//   window.__sottoTextMode = {
//     start({ stream, settings, onPartialSource, onFinalSource,
//             onPartialTarget, onFinalTarget, onStatus, onError, onClosed,
//             sendRuntimeMessage }),
//     stop()
//   }
// =====================================================================

(() => {
  const VERSION = "0.1.0";
  if (window.__sottoTextModeVersion === VERSION) return;
  window.__sottoTextModeVersion = VERSION;

  let activeSession = null;

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

  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  // Walk a Whisper realtime event and return any transcript-like text
  // it carries. The realtime API has churned through several event
  // type names; we accept the ones documented for both translate-style
  // and transcription-style sessions, plus the older
  // conversation.item.input_audio_transcription.* names.
  function readTranscriptText(event) {
    if (!event || typeof event !== "object") return "";
    if (typeof event.delta === "string" && event.delta) return event.delta;
    if (typeof event.transcript === "string" && event.transcript) return event.transcript;
    return "";
  }

  function isDeltaEvent(type) {
    if (!type) return false;
    return (
      type === "conversation.item.input_audio_transcription.delta" ||
      type === "session.input_transcript.delta" ||
      type === "input_audio_buffer.transcription.delta" ||
      type === "response.audio_transcript.delta" ||
      type === "response.input_audio_transcription.delta"
    );
  }

  function isFinalEvent(type) {
    if (!type) return false;
    return (
      type === "conversation.item.input_audio_transcription.completed" ||
      type === "conversation.item.input_audio_transcription.done" ||
      type === "session.input_transcript.done" ||
      type === "input_audio_buffer.transcription.completed" ||
      type === "response.audio_transcript.done" ||
      type === "response.input_audio_transcription.done"
    );
  }

  // Schedule a translation request. We serialize requests per-session
  // so we don't reorder finalized segments in the caption overlay.
  function makeTranslator(session) {
    let queue = Promise.resolve();
    return function translate(segment) {
      if (!segment || !segment.trim()) return Promise.resolve("");
      const job = queue.then(async () => {
        if (session.closed) return "";
        try {
          const response = await session.sendRuntimeMessage({
            type: "TRANSLATE_TEXT_SEGMENT",
            settings: session.settings,
            segment,
            sourceLanguage: session.settings.sourceLanguage || "auto",
            targetLanguage: session.settings.targetLanguage || "en"
          });
          if (!response?.ok) {
            const message = response?.error || "Translation request failed.";
            session.onError?.(new Error(message));
            return "";
          }
          const translated = String(response.translatedText || "").trim();
          if (translated && !session.closed) {
            session.onFinalTarget?.(translated, { source: segment });
          }
          return translated;
        } catch (error) {
          session.onError?.(error);
          return "";
        }
      });
      // Don't let one failed translation poison the queue.
      queue = job.catch(() => undefined);
      return job;
    };
  }

  async function start(options = {}) {
    if (activeSession) {
      stop("restart");
    }

    const {
      stream,
      settings = {},
      onPartialSource,
      onFinalSource,
      onPartialTarget,
      onFinalTarget,
      onStatus,
      onError,
      onClosed,
      sendRuntimeMessage
    } = options;

    if (!stream) throw new Error("Text mode requires a captured audio stream.");
    if (typeof sendRuntimeMessage !== "function") {
      throw new Error("Text mode requires a sendRuntimeMessage helper.");
    }
    if (!stream.getAudioTracks().length) {
      throw new Error("Captured stream has no audio track for transcription.");
    }

    const session = {
      stream,
      settings,
      onPartialSource,
      onFinalSource,
      onPartialTarget,
      onFinalTarget,
      onStatus,
      onError,
      onClosed,
      sendRuntimeMessage,
      pc: null,
      dataChannel: null,
      closed: false,
      partialBuffer: ""
    };
    activeSession = session;
    session.translate = makeTranslator(session);

    onStatus?.("Capturing video audio");

    try {
      const pc = new RTCPeerConnection();
      session.pc = pc;
      const channel = pc.createDataChannel("oai-events");
      session.dataChannel = channel;

      // We never play any audio in text mode, but we still need a
      // recvonly transceiver so the SDP offer is valid for the
      // realtime endpoint.
      pc.addTransceiver("audio", { direction: "sendonly" });

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      channel.addEventListener("open", () => {
        if (session.closed) return;
        onStatus?.("Live Translator (text)");
      });

      channel.addEventListener("message", (event) => {
        if (session.closed) return;
        const parsed = safeJsonParse(event.data);
        if (!parsed) return;

        // Surface every event type to a global ring buffer so the
        // orchestrator can inspect what the model is sending. Cheap.
        try {
          window.__sottoTextModeEvents = window.__sottoTextModeEvents || [];
          window.__sottoTextModeEvents.push({
            ts: Date.now(),
            type: parsed.type,
            keys: Object.keys(parsed)
          });
          if (window.__sottoTextModeEvents.length > 200) {
            window.__sottoTextModeEvents.shift();
          }
        } catch {}

        if (parsed.type === "error") {
          const message =
            parsed.error?.message ||
            parsed.message ||
            "Realtime transcription error.";
          onError?.(new Error(message));
          return;
        }

        if (isDeltaEvent(parsed.type)) {
          const text = readTranscriptText(parsed);
          if (!text) return;
          session.partialBuffer = `${session.partialBuffer}${text}`;
          onPartialSource?.(session.partialBuffer);
          return;
        }

        if (isFinalEvent(parsed.type)) {
          const finalText =
            readTranscriptText(parsed) || session.partialBuffer;
          session.partialBuffer = "";
          if (!finalText.trim()) return;
          onFinalSource?.(finalText);
          void session.translate(finalText);
          return;
        }

        if (parsed.type?.includes?.("speech_started")) {
          session.partialBuffer = "";
        }
      });

      channel.addEventListener("error", () => {
        if (session.closed) return;
        onError?.(new Error("Transcription event channel error."));
      });

      channel.addEventListener("close", () => {
        if (session.closed) return;
        onStatus?.("Transcription channel closed");
      });

      pc.addEventListener("connectionstatechange", () => {
        if (session.closed) return;
        if (pc.connectionState === "failed") {
          onError?.(new Error("Transcription connection failed."));
        }
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      onStatus?.("Connecting transcription");
      const response = await sendRuntimeMessage({
        type: "OPENAI_TRANSCRIPTION_SDP",
        offerSdp: pc.localDescription.sdp,
        settings
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not open transcription session.");
      }

      await pc.setRemoteDescription({
        type: "answer",
        sdp: response.answerSdp
      });

      onStatus?.("Live Translator (text)");
      return { ok: true };
    } catch (error) {
      stop("start_error");
      throw error;
    }
  }

  function stop(reason = "user_stop") {
    const session = activeSession;
    if (!session) return;
    activeSession = null;
    session.closed = true;
    try { session.dataChannel?.close(); } catch {}
    try { session.pc?.close(); } catch {}
    session.onClosed?.(reason);
  }

  window.__sottoTextMode = { start, stop, version: VERSION };
})();
