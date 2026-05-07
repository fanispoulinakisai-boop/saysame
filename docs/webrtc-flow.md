# WebRTC Flow

The intended application flow is:

1. Browser asks for microphone permission.
2. Browser creates an `RTCPeerConnection`.
3. Browser adds the microphone audio track.
4. Browser creates and sets a local SDP offer.
5. Browser posts the SDP offer to the app server:

```text
POST /api/realtime/translations/sdp?source_language=en&target_language=ru
Content-Type: application/sdp
```

6. App server forwards the SDP offer to OpenAI:

```text
POST /v1/realtime/translations/calls
Content-Type: application/sdp
```

The request uses a short-lived translation client secret generated for
`gpt-realtime-translate`. The selected language is enforced in the translation
session config; the browser does not send or own translation instructions.

7. OpenAI returns an SDP answer.
8. App server returns that SDP answer to the browser.
9. Browser sets the remote description.
10. Browser plays the remote audio track as translated speech.

The app server exists because the browser must not hold the real OpenAI API key.
