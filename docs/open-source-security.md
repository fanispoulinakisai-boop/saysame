# Open-Source Security Plan

This is the security shape Sotto should have before a public release.

## Chosen Product Shape

For the first public-friendly version, use a two-mode design:

1. **Default: extension-local key mode.**
   This is the most convenient path that is not reckless. The user pastes an
   OpenAI API key into the Sotto extension settings once. The key is stored only
   in `chrome.storage.local`, never synced, and the extension immediately calls
   `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`
   so content scripts cannot read it. Only the extension service worker can use
   the key. The YouTube content script sends SDP offers to the service worker;
   the service worker creates short-lived Realtime client secrets and returns
   only the SDP answer/session result needed to run the translation.

2. **Advanced: local bridge mode.**
   This is the stronger BYO-key path for users who do not want a browser
   extension to hold their provider key. The OpenAI API key lives in a local
   Node bridge, and the extension talks to the bridge with a local token.

This is the honest compromise: the default mode is much easier for normal users,
while the advanced bridge remains available for people who want stronger key
isolation.

## Current Bridge Shape

Bridge mode should continue to behave like this:

- The OpenAI API key lives only in the local Node bridge, loaded from `OPENAI_API_KEY`.
- The Chrome extension never asks for, stores, logs, or transmits the OpenAI API key.
- The extension asks the bridge for a short-lived Realtime client secret, then uses that client secret to connect to OpenAI over WebRTC.
- The bridge binds to `127.0.0.1` by default and rejects non-loopback traffic unless `SOTTO_ALLOW_REMOTE_BRIDGE=1` is explicitly set.
- Cross-origin bridge access is restricted to Chrome extension origins, localhost origins, and explicit `SOTTO_ALLOWED_ORIGINS`.
- The extension must present a local bridge token for privileged bridge calls.
- Debug trace routes are disabled unless `SOTTO_ENABLE_DEBUG_ROUTES=1` is explicitly set.

This follows the OpenAI Realtime browser pattern: an application server creates an ephemeral client secret, and the browser connects over WebRTC with that short-lived secret rather than a long-lived API key.

## Threat Model

Protect these assets:

- OpenAI API key.
- Short-lived Realtime client secret.
- Local bridge token.
- Audio, transcripts, translations, and debugging traces.
- YouTube page access granted to the extension.

Primary threats:

- Accidentally committing a real API key.
- Leaking a user-pasted key from extension storage or a privileged extension page.
- A random website on the user's browser calling the local bridge.
- A LAN device reaching the bridge if it binds beyond loopback.
- Debug endpoints leaking transcript snippets or upstream error details.
- Extension permissions drifting wider than needed.

Accepted local-machine limitation:

- A process already running as the same OS user can usually read local config files or call localhost services. The bridge token mainly protects against browser-origin abuse and accidental cross-origin use, not a fully compromised machine.

## Authentication Choices

Recommended default:

1. User opens Sotto extension settings.
2. User pastes a dedicated OpenAI project key.
3. Extension stores the key in `chrome.storage.local`, not `chrome.storage.sync`.
4. Extension restricts storage to trusted extension contexts.
5. Extension service worker uses the key to create ephemeral Realtime client secrets.
6. Content scripts never receive the long-lived key.
7. Product copy tells users that this is convenient local storage, not maximum-security secret storage.

Advanced bridge mode:

1. User sets `OPENAI_API_KEY` in `.env.local` or the shell.
2. Bridge stores a random local token at `~/.config/sotto-live/bridge-token`.
3. User runs `npm run bridge:token` and pastes the token into the extension's Bridge section.
4. Extension sends `X-Sotto-Bridge-Token` to the local bridge.
5. Bridge creates short-lived Realtime client secrets and never returns the long-lived key.

Do not add:

- Long-lived OpenAI keys in `chrome.storage.sync`, page `localStorage`, IndexedDB, source files, manifests, or build artifacts.
- A hosted demo that accepts arbitrary user OpenAI keys unless the key is encrypted, scoped, revocable, and never visible to browser code after submission.

Exception for default extension-local key mode:

- `chrome.storage.local` is acceptable only if access is restricted to trusted
  contexts, the key never reaches content scripts, the key is never synced, and
  users are clearly told that the browser extension can use the key.

Future hosted version:

- Prefer a hosted Sotto backend with user accounts, quotas, and abuse controls.
- Browser authenticates to Sotto, Sotto owns the OpenAI API key, and users never paste provider keys into the extension.
- If users must bring their own provider key, put that in a self-hosted backend or OS keychain, not the Chrome extension.

## Permission Rules

Keep extension permissions narrow:

- `activeTab`, `scripting`, and `storage` are needed for page activation, content script injection, and settings.
- YouTube host permissions are needed only for the video pages Sotto supports.
- `https://api.openai.com/*` is needed because the extension uses short-lived Realtime client secrets to open WebRTC calls directly to OpenAI.
- Do not add broad `<all_urls>` or unrelated site permissions.

## Extension-Local Key Guardrails

- Set `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`
  during service worker startup.
- Store the key in `chrome.storage.local`, never `chrome.storage.sync`.
- Use a dedicated settings/options page for the key; do not inject key controls
  into YouTube.
- Do not expose the key to `content.js`.
- Do not include the key in runtime messages, trace events, errors, URLs, or SDP
  bodies.
- Keep the OpenAI calls in the background service worker.
- Use a strict extension Content Security Policy with no remote scripts.
- Encourage a dedicated OpenAI project key and usage monitoring.

## Logging Rules

Never log:

- `OPENAI_API_KEY`.
- Realtime client secret values.
- Authorization headers.
- Full SDP bodies.
- Raw audio.

Debug routes may keep small sanitized event metadata while developing. They are off by default in the public copy.

## Release Checklist

- [ ] Choose a license.
- [ ] Remove private machine paths from docs and examples.
- [ ] Verify `.env`, `.env.local`, and generated token files are ignored.
- [ ] Run secret scanning before publishing.
- [ ] Implement extension-local key mode in the service worker.
- [ ] Confirm content scripts cannot read `chrome.storage.local`.
- [ ] Confirm content scripts never receive `OPENAI_API_KEY`.
- [ ] Reload the unpacked extension from the public copy and validate Start/Stop on YouTube.
- [ ] Validate that the extension fails cleanly without a bridge token.
- [ ] Validate that `chrome-extension://...` requests with the correct token can create a client secret.
- [ ] Validate that a random web origin cannot call bridge endpoints.
- [ ] Validate that debug routes are unavailable unless explicitly enabled.

## Source Notes

- OpenAI production guidance says API keys should not be exposed in code or public repositories and should be provided through environment variables or secret management.
- OpenAI Realtime guidance says the server should create ephemeral client secrets for browser/mobile clients, and those short-lived tokens can be used in client environments.
- Chrome extension security guidance emphasizes limiting exposure, using secure extension practices, and keeping permissions narrow.
