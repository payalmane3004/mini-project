import { SESSION_KEY, SESSION_EXPIRED_EVENT } from "../auth/authState";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export function getApiBaseUrl() {
  return API_BASE_URL.replace(/\/$/, "");
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
    throw new Error("Could not reach the CampusSphere API. Check that the backend is running.", { cause: error });
  }

  if (response.status === 401 && token) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
}
