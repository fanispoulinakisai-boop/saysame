import { createServer } from "node:http";
import {
  buildTranslationInstructions,
  createTranslationClientSecretForBrowser,
  normalizeTranslationLanguages
} from "../src/openaiRealtimeTranslation.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function createFakeOpenAIServer(captures) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let body = "";
    for await (const chunk of request) body += chunk;

    captures.push({
      method: request.method,
      pathname: url.pathname,
      authorization: request.headers.authorization || "",
      contentType: request.headers["content-type"],
      body
    });

    if (url.pathname === "/v1/realtime/translations/client_secrets") {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "x-request-id": "req_translation_client_secret_test"
      });
      response.end(JSON.stringify({
        value: "ek_translation_test",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        session: {}
      }));
      return;
    }

    response.writeHead(404, {
      "Content-Type": "application/json"
    });
    response.end(JSON.stringify({ error: { message: "Unexpected route" } }));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalized = normalizeTranslationLanguages({
  sourceLanguage: "English",
  targetLanguage: "Russian"
});
assert(normalized.sourceLanguage === "en", "English must map to en.");
assert(normalized.targetLanguage === "ru", "Russian must map to ru.");

const normalizedAlbanian = normalizeTranslationLanguages({
  sourceLanguage: "English",
  targetLanguage: "Albanian"
});
assert(normalizedAlbanian.sourceLanguage === "en", "English must map to en.");
assert(normalizedAlbanian.targetLanguage === "sq", "Albanian must map to sq.");

const instructions = buildTranslationInstructions(normalized);
assert(
  instructions.includes("target_language=ru"),
  "Russian instructions must include target_language=ru."
);
assert(
  instructions.includes("Russian only"),
  "Russian instructions must explicitly force Russian-only output."
);
assert(
  instructions.includes("Never output Spanish unless target_language=es"),
  "Russian instructions must forbid Spanish drift."
);

const albanianInstructions = buildTranslationInstructions(normalizedAlbanian);
assert(
  albanianInstructions.includes("target_language=sq"),
  "Albanian instructions must include target_language=sq."
);
assert(
  albanianInstructions.includes("Albanian only"),
  "Albanian instructions must explicitly force Albanian-only output."
);

const captures = [];
const fakeServer = createFakeOpenAIServer(captures);
const port = await listen(fakeServer);

try {
  const russianSecret = await createTranslationClientSecretForBrowser({
    apiKey: "test-key",
    baseUrl: `http://127.0.0.1:${port}/v1`,
    sourceLanguage: "English",
    targetLanguage: "Russian"
  });

  const russianSecretCapture = captures[0];
  assert(russianSecretCapture, "Expected a fake OpenAI client secret request.");
  assert(russianSecretCapture.method === "POST", "Expected POST to OpenAI.");
  assert(
    russianSecretCapture.pathname === "/v1/realtime/translations/client_secrets",
    `Unexpected Russian client secret path: ${russianSecretCapture.pathname}`
  );
  assert(
    russianSecretCapture.contentType?.includes("application/json"),
    "Translation client secrets must use JSON."
  );
  assert(
    russianSecretCapture.body.includes('"model":"gpt-realtime-translate"'),
    "Backend must create a dedicated translation session."
  );
  assert(
    russianSecretCapture.body.includes('"language":"ru"'),
    "Backend must route supported targets into audio.output.language."
  );
  assert(
    !russianSecretCapture.body.includes('"voice"'),
    "Dedicated translation sessions must not send unsupported voice fields."
  );
  assert(
    !russianSecretCapture.body.includes("translate to Spanish"),
    "Backend must not forward stale Spanish client instructions."
  );
  assert(
    russianSecret.clientSecret === "ek_translation_test",
    "Backend must return the short-lived translation client secret."
  );
  assert(
    russianSecret.voice === "marin",
    "Backend must return the default translation voice."
  );
  assert(
    russianSecret.callsUrl === `http://127.0.0.1:${port}/v1/realtime/translations/calls`,
    "Backend must tell the browser to call the dedicated translation calls endpoint."
  );

  const customVoiceRussianSecret = await createTranslationClientSecretForBrowser({
    apiKey: "test-key",
    baseUrl: `http://127.0.0.1:${port}/v1`,
    sourceLanguage: "English",
    targetLanguage: "Russian",
    voice: "cedar"
  });

  const customVoiceRussianCapture = captures[1];
  assert(customVoiceRussianCapture, "Expected a fake translation client secret request.");
  assert(
    customVoiceRussianCapture.pathname === "/v1/realtime/translations/client_secrets",
    `Unexpected custom voice Russian path: ${customVoiceRussianCapture.pathname}`
  );
  assert(
    customVoiceRussianCapture.body.includes('"model":"gpt-realtime-translate"'),
    "Custom voice Russian sessions must still use gpt-realtime-translate."
  );
  assert(
    customVoiceRussianCapture.body.includes('"language":"ru"'),
    "Custom voice Russian sessions must still route into audio.output.language."
  );
  assert(
    !customVoiceRussianCapture.body.includes('"voice"'),
    "Public translation sessions must not switch to a generic voice model."
  );
  assert(
    customVoiceRussianSecret.callsUrl === `http://127.0.0.1:${port}/v1/realtime/translations/calls`,
    "Custom voice Russian sessions must still use the translation calls endpoint."
  );

  const albanianSecret = await createTranslationClientSecretForBrowser({
    apiKey: "test-key",
    baseUrl: `http://127.0.0.1:${port}/v1`,
    sourceLanguage: "English",
    targetLanguage: "Albanian",
    voice: "verse"
  });

  const albanianSecretCapture = captures[2];
  assert(albanianSecretCapture, "Expected a fake OpenAI translation client secret request.");
  assert(captures.length === 3, "Backend should not post browser SDP server-side.");
  assert(
    albanianSecretCapture.pathname === "/v1/realtime/translations/client_secrets",
    `Unexpected Albanian client secret path: ${albanianSecretCapture.pathname}`
  );
  assert(
    albanianSecretCapture.body.includes('"model":"gpt-realtime-translate"'),
    "Albanian sessions must use gpt-realtime-translate."
  );
  assert(
    albanianSecretCapture.body.includes('"language":"sq"'),
    "Albanian sessions must route into audio.output.language."
  );
  assert(
    !albanianSecretCapture.body.includes('"voice"'),
    "Public translation sessions must not switch to a generic voice model."
  );
  assert(
    albanianSecret.clientSecret === "ek_translation_test",
    "Backend must return the short-lived translation client secret."
  );
  assert(
    albanianSecret.callsUrl === `http://127.0.0.1:${port}/v1/realtime/translations/calls`,
    "Backend must tell the browser to call the translation calls endpoint."
  );

  console.log("PASS backend language routing uses gpt-realtime-translate");
} finally {
  await close(fakeServer);
}
