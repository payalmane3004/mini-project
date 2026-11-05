import { SESSION_KEY, SESSION_EXPIRED_EVENT } from "../auth/authState.js";

const CONFIGURED_API_BASE_URL = import.meta.env?.VITE_API_BASE_URL;
const DEVELOPMENT_API_BASE_URL = import.meta.env?.DEV === false ? null : "http://127.0.0.1:8001";

export function resolveApiBaseUrl({ configuredUrl, development = import.meta.env?.DEV !== false }) {
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (development && DEVELOPMENT_API_BASE_URL) return DEVELOPMENT_API_BASE_URL;
  throw new Error("VITE_API_BASE_URL must be set for production builds.");
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl({
    configuredUrl: CONFIGURED_API_BASE_URL,
    frontendPort: typeof window !== "undefined" ? window.location?.port : undefined,
    development: import.meta.env?.DEV !== false,
  });
}

export function apiErrorMessage(body, fallback) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    const issues = body.detail.map((issue) => {
      const path = Array.isArray(issue?.loc)
        ? issue.loc.filter((part) => part !== "body").join(".")
        : "";
      const message = typeof issue?.msg === "string" ? issue.msg : "Invalid value";
      return path ? `${path}: ${message}` : message;
    }).filter(Boolean);
    if (issues.length) return issues.join(" ");
  }
  return fallback;
}

function storedAccessToken() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
    return typeof session?.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const { anonymous = false, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers || {});
  const token = anonymous ? null : storedAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...requestOptions, headers });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    console.error("CampusSphere API request failed before receiving a response", {
      method: requestOptions.method || "GET",
      path: new URL(path, getApiBaseUrl()).pathname,
      reason: error.name || "NetworkError",
    });
    throw new Error(`Request to ${getApiBaseUrl()}${path} failed before the server returned a response (${error.message || error.name}).`, { cause: error });
  }

  if (!response.ok) {
    console.error("CampusSphere API returned an unsuccessful response", {
      method: requestOptions.method || "GET",
      path: new URL(path, getApiBaseUrl()).pathname,
      status: response.status,
    });
  }

  if (response.status === 401 && token) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
}
