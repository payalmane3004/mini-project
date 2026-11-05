import test from "node:test";
import assert from "node:assert/strict";
import { getApiBaseUrl, resolveApiBaseUrl } from "./client.js";
import { createViteConfig } from "../../vite.config.js";

test("Vite defaults to localhost:5173 and the configured local API port", () => {
  const viteConfig = createViteConfig({ mode: "development" });
  assert.equal(viteConfig.server.host, "localhost");
  assert.equal(viteConfig.server.port, 5173);
  assert.equal(viteConfig.server.strictPort, true);
  assert.equal(resolveApiBaseUrl({ frontendPort: String(viteConfig.server.port), development: true }), "http://127.0.0.1:8001");
});

test("development frontend at localhost:5173 targets the active uvicorn port 8001", () => {
  assert.equal(resolveApiBaseUrl({ frontendPort: "5173", development: true }), "http://127.0.0.1:8001");
});

test("configured API base overrides the development port default", () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: "http://127.0.0.1:8123/", frontendPort: "5173", development: true }), "http://127.0.0.1:8123");
});

test("production builds do not infer the local demo backend from port 5173", () => {
  assert.throws(
    () => resolveApiBaseUrl({ frontendPort: "5173", development: false }),
    /VITE_API_BASE_URL must be set for production builds/,
  );
  assert.throws(
    () => createViteConfig({ mode: "production" }),
    /Set VITE_API_BASE_URL/,
  );
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: "https://api.campussphere.example/", development: false }),
    "https://api.campussphere.example",
  );
  assert.doesNotMatch(JSON.stringify(createViteConfig({ mode: "production", apiBaseUrl: "https://api.campussphere.example" })), /127\.0\.0\.1:8001/);
});

test("API base keeps the local backend default on other frontend ports", (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { port: "5173" } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  assert.equal(getApiBaseUrl(), "http://127.0.0.1:8001");
});
