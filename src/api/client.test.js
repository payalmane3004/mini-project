import test from "node:test";
import assert from "node:assert/strict";
import { getApiBaseUrl, resolveApiBaseUrl } from "./client.js";
import viteConfig from "../../vite.config.js";

test("Vite defaults to localhost:5173 and standard API ports", () => {
  assert.equal(viteConfig.server.host, "localhost");
  assert.equal(viteConfig.server.port, 5173);
  assert.equal(viteConfig.server.strictPort, true);
  assert.equal(resolveApiBaseUrl({ frontendPort: String(viteConfig.server.port), development: true }), "http://127.0.0.1:8000");
});

test("development frontend at localhost:5173 targets standard uvicorn port 8000", () => {
  assert.equal(resolveApiBaseUrl({ frontendPort: "5173", development: true }), "http://127.0.0.1:8000");
});

test("configured API base overrides the development port default", () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: "http://127.0.0.1:8123/", frontendPort: "5173", development: true }), "http://127.0.0.1:8123");
});

test("production builds do not infer the local demo backend from port 5173", () => {
  assert.equal(resolveApiBaseUrl({ frontendPort: "5173", development: false }), "http://127.0.0.1:8000");
});

test("API base keeps the standard local backend default on other frontend ports", (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { port: "5173" } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  assert.equal(getApiBaseUrl(), "http://127.0.0.1:8000");
});
