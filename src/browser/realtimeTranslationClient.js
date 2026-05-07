export async function waitForIceGatheringComplete(peerConnection, timeoutMs = 5000) {
  if (peerConnection.iceGatheringState === "complete") return;

  await new Promise((resolve) => {
    const timeout = setTimeout(done, timeoutMs);

    function done() {
      clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }

    function onChange() {
      if (peerConnection.iceGatheringState === "complete") done();
    }

    peerConnection.addEventListener("icegatheringstatechange", onChange);
  });
}

export async function connectRealtimeTranslation({
  endpoint = "/api/realtime/translations/sdp",
  model,
  sourceLanguage,
  targetLanguage,
  instructions,
  voice,
  audioTrack,
  audioStream,
  includeDataChannel = false,
  onRemoteTrack,
  onDataChannelMessage,
  onConnectionStateChange,
  iceGatheringTimeoutMs
} = {}) {
  if (!globalThis.RTCPeerConnection) {
    throw new Error("RTCPeerConnection is not available in this environment.");
  }

  const peerConnection = new RTCPeerConnection();
  const ownedStream =
    audioStream ||
    (!audioTrack
      ? await navigator.mediaDevices.getUserMedia({ audio: true })
      : undefined);

  const track = audioTrack || ownedStream.getAudioTracks()[0];
  if (!track) {
    throw new Error("No local audio track is available for translation.");
  }

  peerConnection.addTrack(track, ownedStream || new MediaStream([track]));

  peerConnection.addEventListener("track", (event) => {
    onRemoteTrack?.(event);
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    onConnectionStateChange?.(peerConnection.connectionState);
  });

  let dataChannel;
  if (includeDataChannel) {
    dataChannel = peerConnection.createDataChannel("oai-events");
    dataChannel.addEventListener("message", (event) => {
      onDataChannelMessage?.(event);
    });
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await waitForIceGatheringComplete(peerConnection, iceGatheringTimeoutMs);

  const url = new URL(endpoint, window.location.origin);
  if (model) url.searchParams.set("model", model);
  if (sourceLanguage) url.searchParams.set("source_language", sourceLanguage);
  if (targetLanguage) url.searchParams.set("target_language", targetLanguage);
  if (instructions) url.searchParams.set("instructions", instructions);
  if (voice) url.searchParams.set("voice", voice);

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
      `Translation SDP exchange failed (${response.status}): ${answerSdp}`
    );
  }

  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: answerSdp
  });

  return {
    peerConnection,
    dataChannel,
    localStream: ownedStream,
    close() {
      dataChannel?.close();
      peerConnection.close();
      ownedStream?.getTracks().forEach((streamTrack) => streamTrack.stop());
    }
  };
}
