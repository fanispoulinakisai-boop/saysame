import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const TOKEN_BYTES = 32;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function truthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function csvEnv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function tokenFilePath() {
  const configDir =
    process.env.SOTTO_CONFIG_DIR ||
    join(homedir(), ".config", "sotto-live");
  return resolve(configDir, "bridge-token");
}

export function bridgeAuthEnabled() {
  return !truthyEnv(process.env.SOTTO_DISABLE_BRIDGE_AUTH);
}

export function debugRoutesEnabled() {
  return truthyEnv(process.env.SOTTO_ENABLE_DEBUG_ROUTES);
}

export function bridgeTokenPath() {
  return tokenFilePath();
}

export function getBridgeToken() {
  const envToken = String(process.env.SOTTO_BRIDGE_TOKEN || "").trim();
  if (envToken) return envToken;

  const path = tokenFilePath();
  if (existsSync(path)) {
    return readFileSync(path, "utf8").trim();
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${token}\n`, { mode: 0o600 });
  return token;
}

export function isLoopbackRequest(request) {
  const remoteAddress = request.socket?.remoteAddress;
  return LOOPBACK_ADDRESSES.has(remoteAddress);
}

export function getAllowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return "";

  const extraOrigins = csvEnv(process.env.SOTTO_ALLOWED_ORIGINS);
  if (extraOrigins.includes(origin)) return origin;

  const extensionId = String(process.env.SOTTO_EXTENSION_ID || "").trim();
  if (origin.startsWith("chrome-extension://")) {
    return !extensionId || origin === `chrome-extension://${extensionId}`
      ? origin
      : "";
  }

  try {
    const url = new URL(origin);
    if (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    ) {
      return origin;
    }
  } catch {
    return "";
  }

  return "";
}

export function corsHeadersForRequest(request) {
  const allowedOrigin = getAllowedOrigin(request);
  return {
    Vary: "Origin",
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {})
  };
}

function readPresentedToken(request) {
  const headerToken = request.headers["x-sotto-bridge-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  const authorization = request.headers.authorization;
  const match =
    typeof authorization === "string"
      ? authorization.match(/^Bearer\s+(.+)$/i)
      : null;
  return match ? match[1].trim() : "";
}

function tokenMatches(expected, presented) {
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(presented);
  return (
    expectedBuffer.length === presentedBuffer.length &&
    timingSafeEqual(expectedBuffer, presentedBuffer)
  );
}

export function assertBridgeAccess(request, options = {}) {
  const {
    requireToken = false,
    requireTokenForExtensions = true
  } = options;

  if (
    !truthyEnv(process.env.SOTTO_ALLOW_REMOTE_BRIDGE) &&
    !isLoopbackRequest(request)
  ) {
    throw Object.assign(new Error("Bridge access is limited to this device."), {
      status: 403
    });
  }

  const origin = request.headers.origin;
  const allowedOrigin = getAllowedOrigin(request);
  if (origin && !allowedOrigin) {
    throw Object.assign(new Error("This origin is not allowed to use Sotto."), {
      status: 403
    });
  }

  const isExtensionRequest = allowedOrigin.startsWith("chrome-extension://");
  const tokenRequired =
    bridgeAuthEnabled() &&
    (requireToken ||
      (requireTokenForExtensions && isExtensionRequest) ||
      truthyEnv(process.env.SOTTO_REQUIRE_BRIDGE_TOKEN));

  if (!tokenRequired) return;

  const expected = getBridgeToken();
  const presented = readPresentedToken(request);
  if (!presented || !tokenMatches(expected, presented)) {
    throw Object.assign(
      new Error(
        "Bridge token is required. Run `npm run bridge:token` and paste it into the Sotto extension."
      ),
      { status: 401 }
    );
  }
}
