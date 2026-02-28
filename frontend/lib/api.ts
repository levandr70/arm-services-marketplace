const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** When status is 400, may contain field-level errors: { field: string[] } */
    public body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, token, headers: extraHeaders = {}, signal } = options;

  const url = path.startsWith("http") ? path : `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers, signal: signal ?? undefined };
  if (body != null && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let detailMessage = "";

  let errorBody: Record<string, unknown> | undefined;
  if (text) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (typeof data.detail === "string") {
        detailMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        detailMessage = data.detail.join(" ");
      } else if (res.status === 400 && typeof data === "object" && data !== null) {
        // DRF validation errors: { "field": ["error"], ... }
        errorBody = data;
        const parts: string[] = [];
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value)) {
            parts.push(`${key}: ${value.join(" ")}`);
          } else if (typeof value === "string") {
            parts.push(`${key}: ${value}`);
          }
        }
        if (parts.length) detailMessage = parts.join(". ");
      }
    } catch {
      // ignore
    }
  }

  if (!res.ok) {
    const message =
      detailMessage ||
      (res.status === 500
        ? "Server error"
        : res.statusText || "Request failed");
    throw new ApiError(message, res.status, errorBody);
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}
