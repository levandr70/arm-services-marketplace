"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { clearTokens, getTokens, setTokens, type Tokens } from "@/lib/auth";

export type User = {
  email: string;
  role: string;
  is_client?: boolean;
  is_provider?: boolean;
  provider_verification_status?: string | null;
};

type AuthContextValue = {
  user: User | null;
  tokens: Tokens | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  setUserFromMe: (me: User | null) => void;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  city?: string;
  role: "client" | "provider";
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserFromApi(token: string): Promise<User | null> {
  try {
    const data = await apiFetch<{
      email?: string;
      role?: string;
      is_client?: boolean;
      is_provider?: boolean;
      provider_verification_status?: string | null;
    }>("/api/auth/me/", {
      method: "GET",
      token,
    });
    if (data?.email != null) {
      return {
        email: data.email,
        role: typeof data.role === "string" ? data.role : "client",
        is_client: data.is_client !== false,
        is_provider: data.is_provider === true,
        provider_verification_status: data.provider_verification_status ?? null,
      };
    }
  } catch {
    // ignore (e.g. token expired)
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokensState] = useState<Tokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setLoading(false);
      return;
    }
    setTokensState(tokens);
    fetchUserFromApi(tokens.access).then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ access: string; refresh: string }>("/api/auth/token/", {
      method: "POST",
      body: { email, password },
    });
    if (!data?.access || !data?.refresh) throw new ApiError("Invalid response", 500);
    setTokens({ access: data.access, refresh: data.refresh });
    setTokensState({ access: data.access, refresh: data.refresh });
    const u = await fetchUserFromApi(data.access);
    setUser(u ?? { email, role: "client", is_client: true, is_provider: false });
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await apiFetch("/api/auth/register/", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        full_name: payload.full_name,
        phone: payload.phone ?? "",
        city: payload.city ?? "",
        role: payload.role,
      },
    });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setTokensState(null);
  }, []);

  const setUserFromMe = useCallback((me: User | null) => {
    setUser(me);
  }, []);

  const value: AuthContextValue = {
    user,
    tokens,
    loading,
    login,
    register,
    logout,
    setUserFromMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
