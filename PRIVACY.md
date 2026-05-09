# SaySame Privacy Policy

**Last updated:** 2026-05-08
**Maintained by:** Fanis Poulinakis (publisher)
**Contact:** fanispoulinakisai@gmail.com

SaySame is a Chrome extension that translates the audio of videos in real time using OpenAI's Realtime API. We've designed it to keep your data on your own device wherever possible. This page explains exactly what is and isn't handled.

---

## TL;DR

- We **do not** collect, store, or transmit any personal data to any servers we control.
- Your **OpenAI API key** is stored locally in your own browser only (Chrome's `chrome.storage.local`). It never leaves your machine except when you make a request to OpenAI.
- The **audio of the video** you choose to translate is sent **directly from your browser to OpenAI's servers** for translation. We never see it, route it, or log it.
- We have **no analytics**, **no tracking**, **no telemetry**, and no third-party services other than OpenAI.

---

## What data SaySame handles

| Data type | Where it is stored | Where it is sent |
|---|---|---|
| Your OpenAI API key | Locally in your browser (`chrome.storage.local`) on your device only | Only to `api.openai.com` when you start a translation session, as part of standard OpenAI authentication |
| Your settings (chosen language, voice, volume, bar position, etc.) | Locally in your browser (`chrome.storage.local`) on your device only | Never sent anywhere |
| Audio captured from the video you're watching | Streamed in real time from your browser to OpenAI's Realtime API | Directly to OpenAI; never touches our servers |
| Translated audio + transcripts received from OpenAI | Streamed back to your browser and played/displayed in the SaySame bar | Never re-transmitted to anyone |
| Live cost ticker / session timer | Computed locally in your browser; not stored after the session ends | Never sent anywhere |

We do not collect names, emails, IP addresses, browsing history, or any other identifying information.

---

## Third parties

**OpenAI** is the only third party SaySame interacts with. When you start a translation session, your browser opens a connection directly to OpenAI's servers (`api.openai.com`) using the API key you provided. OpenAI's handling of that data is governed by [OpenAI's privacy policy](https://openai.com/policies/privacy-policy) and [API data usage policy](https://openai.com/policies/api-data-usage-policies).

If you enable the optional **"Advanced bridge mode"** in settings (off by default), SaySame will instead route requests through a local relay server you run on your own machine (typically `http://127.0.0.1:8799`). This is for advanced users who self-host. Either way, no traffic touches any server operated by SaySame's publisher.

---

## Permissions explained

SaySame requests the following permissions only because the extension cannot work without them:

- **`activeTab`** — to know which tab you're currently watching a video on, so the bar can attach to that tab.
- **`scripting`** — to inject the SaySame bar UI into the video page.
- **`storage`** — to save your settings (API key, default language, etc.) on your device so they persist between sessions.
- **Host permissions for video sites** (YouTube, Bilibili, Xiaohongshu, Douyin, Weibo, TikTok, Twitter/X, Vimeo, Twitch) — so the extension knows which pages it can attach to. Without these the bar can't appear on those sites.
- **Host permission for `api.openai.com`** — so your browser can send the audio to OpenAI for translation.

We do not use any of these permissions for anything beyond the function described above.

---

## Children

SaySame is not directed at children under 13 and we do not knowingly collect any data, since we don't collect data at all.

---

## Changes to this policy

If anything material changes (new third parties, new data collection, etc.) we will update this page and the "Last updated" date above. The current version of this policy lives on GitHub at:

[https://github.com/fanispoulinakisai-boop/saysame/blob/main/PRIVACY.md](https://github.com/fanispoulinakisai-boop/saysame/blob/main/PRIVACY.md)

---

## Contact

Questions about this policy or about how SaySame handles your data? Email: **fanispoulinakisai@gmail.com**

You can also open an issue on the public GitHub repo: [github.com/fanispoulinakisai-boop/saysame](https://github.com/fanispoulinakisai-boop/saysame)
