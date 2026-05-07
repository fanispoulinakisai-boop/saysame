# Live YT Translator Extension

This is the Chrome extension folder. Load this folder as an unpacked extension
from `chrome://extensions`.

## Quick Start

1. Open a YouTube video.
2. Click the extension icon.
3. Paste an OpenAI API key.
4. Pick a language.
5. Press **Start**.

## Advanced Bridge Mode

Bridge mode keeps the OpenAI key in a local Node server instead of in extension
storage. Start the bridge from the repo root with `npm start`, copy the token
from `npm run bridge:token`, then paste it into **Advanced bridge** in the
extension popup.
