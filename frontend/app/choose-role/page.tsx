"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MePayload = {
  id?: number;
  email?: string;
  full_name?: string;
  role?: string;
  is_client?: boolean;
  is_provider?: boolean;
  provider_verification_status?: string | null;
};

const ACTIVE_MODE_KEY = "active_mode";

export default function ChooseRolePage() {
  const { tokens, setUserFromMe, logout } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [enableProviderLoading, setEnableProviderLoading] = useState(false);
  const [enableProviderError, setEnableProviderError] = useState("");

  const fetchMe = useCallback(async () => {
    if (!tokens?.access) return;
    try {
      const data = await apiFetch<MePayload>("/api/auth/me/", {
        method: "GET",
        token: tokens.access,
      });
      setMe(data ?? null);
      if (data && setUserFromMe) {
        setUserFromMe({
          email: data.email ?? "",
          role: typeof data.role === "string" ? data.role : "client",
          is_client: data.is_client !== false,
          is_provider: data.is_provider === true,
          provider_verification_status: data.provider_verification_status ?? null,
        });
      }
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [tokens?.access, setUserFromMe]);

  useEffect(() => {
    if (!tokens?.access) {
      setLoading(false);
      return;
    }
    fetchMe();
  }, [tokens?.access, fetchMe]);

  const handleContinueAsClient = () => {
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_MODE_KEY, "client");
    router.replace("/client");
  };

  const handleContinueAsProvider = () => {
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_MODE_KEY, "provider");
    router.replace("/provider");
  };

  const handleEnableProvider = async () => {
    if (!tokens?.access) return;
    setEnableProviderError("");
    setEnableProviderLoading(true);
    try {
      const data = await apiFetch<MePayload>("/api/auth/enable-provider/", {
        method: "POST",
        token: tokens.access,
        body: {},
      });
      setMe((prev) => (prev ? { ...prev, is_provider: true, provider_verification_status: data?.provider_verification_status ?? "pending" } : prev));
      if (data && setUserFromMe) {
        setUserFromMe({
          email: data.email ?? "",
          role: typeof data.role === "string" ? data.role : "client",
          is_client: data.is_client !== false,
          is_provider: true,
          provider_verification_status: data.provider_verification_status ?? null,
        });
      }
    } catch (err) {
      setEnableProviderError(err instanceof ApiError ? err.message : "Failed to enable provider mode.");
    } finally {
      setEnableProviderLoading(false);
    }
  };

  const isClient = me?.is_client !== false;
  const isProvider = me?.is_provider === true;
  const verificationStatus = me?.provider_verification_status ?? null;

  return (
    <RequireAuth role="any">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Choose mode</h1>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>

          {loading && <p className="text-gray-500">Loading…</p>}

          {!loading && me && (
            <>
              <p className="text-sm text-gray-600">
                Continue as client to post and manage jobs, or as provider to browse jobs and submit responses.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!isClient}
                  onClick={handleContinueAsClient}
                  className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-500 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white"
                >
                  <span className="block text-lg font-medium text-gray-900">Continue as Client</span>
                  <span className="mt-1 block text-sm text-gray-500">Post jobs, manage responses, accept or reject offers.</span>
                </button>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!isProvider}
                    onClick={handleContinueAsProvider}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-green-500 hover:bg-green-50/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white"
                  >
                    <span className="block text-lg font-medium text-gray-900">Continue as Provider</span>
                    <span className="mt-1 block text-sm text-gray-500">Browse feed, submit responses, manage credits.</span>
                  </button>

                  {!isProvider && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                      <button
                        type="button"
                        disabled={enableProviderLoading}
                        onClick={handleEnableProvider}
                        className="w-full rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                      >
                        {enableProviderLoading ? "Enabling…" : "Enable Provider Mode"}
                      </button>
                      {enableProviderError && (
                        <p className="mt-2 text-sm text-red-600">{enableProviderError}</p>
                      )}
                    </div>
                  )}

                  {isProvider && verificationStatus != null && verificationStatus !== "" && (
                    <p className="text-xs text-gray-500">
                      Verification: {verificationStatus}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
