export const API_BASE_URL = "/api/v1";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return "Не удалось выполнить запрос";
  }

  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    const firstError = payload.detail[0];
    if (firstError && typeof firstError.msg === "string" && firstError.msg.trim().length > 0) {
      return firstError.msg;
    }
  }

  if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
    return payload.detail;
  }

  return "Не удалось выполнить запрос";
}

export async function apiRequest(endpoint, init = {}) {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (hasBody && !isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson
      ? getErrorMessage(payload)
      : typeof payload === "string" && payload.trim().length > 0
        ? payload
        : "Не удалось выполнить запрос";
    throw new ApiError(message, response.status);
  }

  return payload;
}
