# Security Policy

## Supported Versions

This project is experimental. Treat `main` or the currently published release as
the only supported line once the project is public.

## Reporting Security Issues

Until a public repo exists, report issues privately to the maintainer rather
than opening public issues with exploit details, API keys, transcripts, or logs.

## Secret Handling

Do not put an OpenAI API key in:

- the Chrome extension popup
- `chrome.storage.local`
- browser `localStorage`
- committed source files
- screenshots
- logs
- GitHub issues

Use `OPENAI_API_KEY` in `.env.local`, a shell environment variable, or a secret
manager. The extension should receive only the local bridge token and short-lived
Realtime client secrets.
