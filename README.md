# Live YT Translator

A Chrome extension for live-translating YouTube videos with OpenAI Realtime.
Choose a language, press **Start**, and hear translated speech while a live
caption overlay follows the video.

![Live YT Translator screenshot](docs/assets/sotto-extension-screenshot.png)

## What You Need

- Google Chrome.
- An OpenAI API key.
- A YouTube video.

## Install

1. Download or clone this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension` folder.

## Use

1. Open a YouTube video.
2. Click the extension icon.
3. Paste your OpenAI API key.
4. Choose the language you want to hear.
5. Press **Start**.

The overlay appears only after you start translation. You can move it, resize it,
hide it, change language, and adjust the balance between the original video
audio and translated voice.

## API Key Safety

The default mode stores your OpenAI API key locally in Chrome extension storage.
It is not synced to your Google account, and the YouTube page/content script
does not receive the key. The background service worker uses the key to create
short-lived Realtime client secrets.

For safer testing, create a dedicated OpenAI project key for this extension and
monitor usage in your OpenAI dashboard.

## Advanced Local Bridge

If you do not want the extension to store your OpenAI key, use local bridge mode
instead.

Create `.env.local` from `.env.example`, set `OPENAI_API_KEY`, then run:

```sh
npm start
```

Print a local bridge token:

```sh
npm run bridge:token
```

In the extension popup, open **Advanced bridge**, enable **Use local bridge**,
paste the token, and press **Start**.

## Development

No-key checks:

```sh
npm run check:language-routing
```

Live OpenAI access checks:

```sh
npm run check:translation-model
npm run check:access
```

`check:translation-model` is the focused check for `gpt-realtime-translate`.
It asks OpenAI for a short-lived Realtime translation client secret and never
prints the secret or your API key.

## Notes

- This is experimental software.
- It currently targets YouTube.
- Realtime translation quality, supported languages, voices, and latency depend
  on the OpenAI Realtime API.

## License

MIT
