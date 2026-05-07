import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { getOpenAIConfig } from "./env.js";
import {
  assertBridgeAccess,
  bridgeAuthEnabled,
  bridgeTokenPath,
  corsHeadersForRequest,
  debugRoutesEnabled,
  getBridgeToken,
  getAllowedOrigin
} from "./bridgeSecurity.js";
import {
  createTranslationClientSecretForBrowser,
  createTranslationSdpAnswer,
  OpenAIRealtimeError,
  REALTIME_VOICE_OPTIONS
} from "./openaiRealtimeTranslation.js";

const MAX_SDP_BYTES = 512 * 1024;
const PUBLIC_DIR = resolve(process.cwd(), "public");
let lastTranslationRequest;
const translationTrace = [];
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function addTraceEvent(event) {
  translationTrace.unshift({
    timestamp: new Date().toISOString(),
    ...event
  });
  translationTrace.splice(200);
}

function previewResponseBody(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.slice(0, 500);

  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}

function sendCorsPreflight(request, response) {
  const allowedOrigin = getAllowedOrigin(request);
  if (request.headers.origin && !allowedOrigin) {
    sendJson(response, 403, {
      error: "This origin is not allowed to use Sotto."
    });
    return;
  }

  response.writeHead(204, {
    ...corsHeadersForRequest(request),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept,X-Sotto-Bridge-Token,Authorization",
    "Access-Control-Max-Age": "86400"
  });
  response.end();
}

async function readRawBody(request, maxBytes = MAX_SDP_BYTES) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw Object.assign(new Error("Request body is too large."), {
        status: 413
      });
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function getRequestUrl(request) {
  const host = request.headers.host || "127.0.0.1";
  return new URL(request.url, `http://${host}`);
}

function getStaticPath(urlPathname) {
  const pathname = urlPathname === "/" ? "/index.html" : urlPathname;
  const decoded = decodeURIComponent(pathname);
  const normalizedPath = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = resolve(PUBLIC_DIR, `.${sep}${normalizedPath}`);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${sep}`)) {
    return undefined;
  }

  return filePath;
}

async function sendStaticFile(response, filePath) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return false;

    response.writeHead(200, {
      "Content-Type":
        MIME_TYPES[extname(filePath)] || "application/octet-stream",
      "Content-Length": fileStat.size,
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function createServer() {
  return createHttpServer(async (request, response) => {
    for (const [key, value] of Object.entries(corsHeadersForRequest(request))) {
      response.setHeader(key, value);
    }

    if (request.method === "OPTIONS") {
      sendCorsPreflight(request, response);
      return;
    }

    const url = getRequestUrl(request);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        assertBridgeAccess(request, {
          requireToken: false,
          requireTokenForExtensions: false
        });
        const config = getOpenAIConfig();
        sendJson(response, 200, {
          ok: true,
          apiKeyConfigured: Boolean(config.apiKey),
          bridgeAuthEnabled: bridgeAuthEnabled(),
          debugRoutesEnabled: debugRoutesEnabled(),
          translationModel: config.translationModel,
          translationVoice: config.translationVoice
        });
        return;
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/realtime/translations/config"
      ) {
        assertBridgeAccess(request, {
          requireToken: false
        });
        const config = getOpenAIConfig();
        sendJson(response, 200, {
          model: config.translationModel,
          voice: config.translationVoice,
          voices: REALTIME_VOICE_OPTIONS,
          clientSecretEndpoint: "/api/realtime/translations/client-secret",
          endpoint: "/api/realtime/translations/sdp",
          accepts: "application/sdp",
          returns: "application/sdp",
          upstream: "/v1/realtime/translations/calls",
          apiKeyConfigured: Boolean(config.apiKey),
          bridgeAuthEnabled: bridgeAuthEnabled(),
          debugRoutesEnabled: debugRoutesEnabled()
        });
        return;
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/realtime/translations/last-request"
      ) {
        assertBridgeAccess(request, { requireToken: true });
        if (!debugRoutesEnabled()) {
          sendJson(response, 404, {
            error: "Debug routes are disabled. Set SOTTO_ENABLE_DEBUG_ROUTES=1 to enable them."
          });
          return;
        }
        sendJson(response, lastTranslationRequest ? 200 : 404, {
          ok: Boolean(lastTranslationRequest),
          request: lastTranslationRequest || null
        });
        return;
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/realtime/translations/trace"
      ) {
        assertBridgeAccess(request, { requireToken: true });
        if (!debugRoutesEnabled()) {
          sendJson(response, 404, {
            error: "Debug routes are disabled. Set SOTTO_ENABLE_DEBUG_ROUTES=1 to enable them."
          });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          events: translationTrace
        });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/realtime/translations/trace/reset"
      ) {
        assertBridgeAccess(request, { requireToken: true });
        if (!debugRoutesEnabled()) {
          sendJson(response, 404, {
            error: "Debug routes are disabled. Set SOTTO_ENABLE_DEBUG_ROUTES=1 to enable them."
          });
          return;
        }
        translationTrace.length = 0;
        sendJson(response, 200, {
          ok: true
        });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/realtime/translations/trace"
      ) {
        assertBridgeAccess(request, { requireToken: true });
        if (!debugRoutesEnabled()) {
          sendJson(response, 404, {
            error: "Debug routes are disabled. Set SOTTO_ENABLE_DEBUG_ROUTES=1 to enable them."
          });
          return;
        }
        const body = await readRawBody(request, 64 * 1024);
        try {
          addTraceEvent(JSON.parse(body));
        } catch {
          addTraceEvent({
            type: "trace.parse_error",
            body: body.slice(0, 500)
          });
        }
        sendJson(response, 200, {
          ok: true
        });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/realtime/translations/client-secret"
      ) {
        assertBridgeAccess(request);
        const rawBody = await readRawBody(request, 64 * 1024);
        let body = {};
        if (rawBody) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            throw Object.assign(new Error("Expected JSON request body."), {
              status: 400
            });
          }
        }

        const requestedVoice =
          body.translationVoice ||
          body.voice ||
          body.translation_voice ||
          url.searchParams.get("voice") ||
          undefined;
        const result = await createTranslationClientSecretForBrowser({
          model: body.model || url.searchParams.get("model") || undefined,
          sourceLanguage:
            body.sourceLanguage ||
            body.source_language ||
            url.searchParams.get("source_language") ||
            undefined,
          targetLanguage:
            body.targetLanguage ||
            body.target_language ||
            url.searchParams.get("target_language") ||
            undefined,
          voice: requestedVoice
        });

        lastTranslationRequest = {
          rawSourceLanguage:
            body.sourceLanguage ||
            body.source_language ||
            url.searchParams.get("source_language") ||
            null,
          rawTargetLanguage:
            body.targetLanguage ||
            body.target_language ||
            url.searchParams.get("target_language") ||
            null,
          rawVoice: requestedVoice || null,
          routedSourceLanguage: result.sourceLanguage,
          routedTargetLanguage: result.targetLanguage,
          routedVoice: result.voice,
          hasServerLanguageLock: true,
          translationMode: "sync",
          turnDetectionMode: null,
          upstreamPath: result.upstreamPath,
          requestId: null,
          clientSecretRequestId: result.requestId || null,
          timestamp: new Date().toISOString()
        };
        addTraceEvent({
          type: "server.client_secret",
          targetLanguage: result.targetLanguage,
          sourceLanguage: result.sourceLanguage,
          voice: result.voice,
          translationMode: "sync",
          turnDetectionMode: null,
          clientSecretRequestId: result.requestId || null
        });

        sendJson(response, 200, {
          clientSecret: result.clientSecret,
          expiresAt: result.expiresAt,
          model: result.model,
          callsUrl: result.callsUrl,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          voice: result.voice,
          upstream: result.upstreamPath,
          clientSecretRequestId: result.requestId || null
        });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/realtime/translations/sdp"
      ) {
        assertBridgeAccess(request);
        const offerSdp = await readRawBody(request);
        const result = await createTranslationSdpAnswer({
          offerSdp,
          model: url.searchParams.get("model") || undefined,
          sourceLanguage: url.searchParams.get("source_language") || undefined,
          targetLanguage: url.searchParams.get("target_language") || undefined,
          translationMode:
            url.searchParams.get("translation_mode") ||
            url.searchParams.get("mode") ||
            undefined,
          instructions: url.searchParams.get("instructions") || undefined,
          voice: url.searchParams.get("voice") || undefined,
          turnDetectionMode:
            url.searchParams.get("turn_detection") ||
            url.searchParams.get("turn_detection_mode") ||
            undefined
        });
        lastTranslationRequest = {
          rawSourceLanguage: url.searchParams.get("source_language") || null,
          rawTargetLanguage: url.searchParams.get("target_language") || null,
          rawVoice: url.searchParams.get("voice") || null,
          routedSourceLanguage: result.sourceLanguage,
          routedTargetLanguage: result.targetLanguage,
          routedVoice: result.voice,
          hasServerLanguageLock: result.instructions.includes(
            `target_language=${result.targetLanguage}`
          ),
          translationMode: result.translationMode,
          turnDetectionMode: result.turnDetectionMode,
          upstreamPath: result.upstreamPath,
          requestId: result.requestId || null,
          clientSecretRequestId: result.clientSecretRequestId || null,
          timestamp: new Date().toISOString()
        };
        addTraceEvent({
          type: "server.sdp_answer",
          targetLanguage: result.targetLanguage,
          sourceLanguage: result.sourceLanguage,
          voice: result.voice,
          translationMode: result.translationMode,
          turnDetectionMode: result.turnDetectionMode,
          requestId: result.requestId || null,
          clientSecretRequestId: result.clientSecretRequestId || null
        });

        response.writeHead(result.status, {
          ...corsHeadersForRequest(request),
          "Content-Type": "application/sdp",
          "X-OpenAI-Request-ID": result.requestId || "",
          "Access-Control-Expose-Headers": "X-OpenAI-Request-ID"
        });
        response.end(result.answerSdp);
        return;
      }

      if (request.method === "GET") {
        const filePath = getStaticPath(url.pathname);
        if (filePath && (await sendStaticFile(response, filePath))) return;
      }

      sendJson(response, 404, {
        error: "Not found",
        routes: [
          "GET /",
          "GET /health",
          "GET /api/realtime/translations/config",
          "GET /api/realtime/translations/last-request",
          "GET /api/realtime/translations/trace",
          "POST /api/realtime/translations/client-secret",
          "POST /api/realtime/translations/trace",
          "POST /api/realtime/translations/trace/reset",
          "POST /api/realtime/translations/sdp"
        ]
      });
    } catch (error) {
      if (error instanceof OpenAIRealtimeError) {
        const sourceLanguage = url.searchParams.get("source_language") || null;
        const targetLanguage = url.searchParams.get("target_language") || null;
        addTraceEvent({
          type: "server.openai_error",
          endpoint: url.pathname,
          sourceLanguage,
          targetLanguage,
          status: error.status || 502,
          message: error.message,
          code: error.code || null,
          requestId: error.requestId || null,
          responseBodyPreview: previewResponseBody(error.responseBody)
        });
        lastTranslationRequest = {
          rawSourceLanguage: sourceLanguage,
          rawTargetLanguage: targetLanguage,
          routedSourceLanguage: sourceLanguage,
          routedTargetLanguage: targetLanguage,
          hasServerLanguageLock: false,
          translationMode:
            url.searchParams.get("translation_mode") ||
            url.searchParams.get("mode") ||
            null,
          turnDetectionMode:
            url.searchParams.get("turn_detection") ||
            url.searchParams.get("turn_detection_mode") ||
            null,
          upstreamPath: null,
          requestId: error.requestId || null,
          clientSecretRequestId: null,
          error: {
            status: error.status || 502,
            message: error.message,
            code: error.code || null
          },
          timestamp: new Date().toISOString()
        };
        sendJson(response, error.status || 502, {
          error: {
            message: error.message,
            type: error.type,
            code: error.code,
            requestId: error.requestId
          }
        });
        return;
      }

      addTraceEvent({
        type: "server.error",
        endpoint: url.pathname,
        sourceLanguage: url.searchParams.get("source_language") || null,
        targetLanguage: url.searchParams.get("target_language") || null,
        status: error.status || 500,
        message: error.message || "Unexpected server error"
      });
      sendJson(response, error.status || 500, {
        error: {
          message: error.message || "Unexpected server error"
        }
      });
    }
  });
}

export function startServer({
  port = process.env.PORT || 8799,
  host = process.env.HOST || "127.0.0.1"
} = {}) {
  const server = createServer();

  server.listen(port, host, () => {
    const address = server.address();
    const resolvedPort =
      typeof address === "object" && address ? address.port : port;
    const resolvedHost =
      typeof address === "object" && address ? address.address : host;

    console.log(
      `Realtime translation server listening on http://${resolvedHost}:${resolvedPort}`
    );
    if (bridgeAuthEnabled()) {
      getBridgeToken();
      console.log(`Sotto bridge token file: ${bridgeTokenPath()}`);
      console.log("Run `npm run bridge:token` to print the token for the extension.");
    }
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
