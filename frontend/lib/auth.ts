const TOKENS_KEY = "marketplace_tokens";

export type Tokens = {
  access: string;
  refresh: string;
};

export type JwtPayload = {
  sub?: number;
  email?: string;
  role?: string;
  exp?: number;
};

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Tokens;
    return parsed?.access && parsed?.refresh ? parsed : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKENS_KEY);
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  try {
    return decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return "";
  }
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    if (!json) return null;
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function payloadToUser(payload: JwtPayload | null): { email: string; role: string } | null {
  if (!payload) return null;
  const email = typeof payload.email === "string" ? payload.email : "";
  const role = typeof payload.role === "string" ? payload.role : "client";
  return { email, role };
}
