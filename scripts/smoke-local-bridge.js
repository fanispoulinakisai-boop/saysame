import { createServer } from "../src/server.js";

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

const server = createServer();
const port = await listen(server);

try {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/realtime/translations/config`
  );

  const config = await response.json();
  if (
    response.status !== 200 ||
    config.clientSecretEndpoint !== "/api/realtime/translations/client-secret" ||
    config.upstream !== "/v1/realtime/translations/calls" ||
    config.model !== "gpt-realtime-translate"
  ) {
    console.error(`FAIL local bridge config (${response.status})`);
    console.error(JSON.stringify(config, null, 2).slice(0, 500));
    process.exitCode = 1;
  } else {
    console.log("PASS local bridge is configured for browser translation calls");
  }
} finally {
  await close(server);
}
