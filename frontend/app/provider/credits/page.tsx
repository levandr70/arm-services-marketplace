"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

/**
 * GET /api/credits/ — CreditsBalanceViewSet.list returns { credits_balance }.
 * Optional: credits_available, balance, transactions (if backend adds later).
 */
type CreditsResponse = {
  credits_balance?: number;
  credits_available?: number;
  balance?: number;
  transactions?: Array<{
    type?: string;
    amount?: number;
    created_at?: string | null;
    note?: string;
    [key: string]: unknown;
  }>;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

export default function ProviderCreditsPage() {
  const { tokens } = useAuth();
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const accessToken = tokens?.access ?? null;
    if (!accessToken) {
      setLoading(false);
      setError("Not authenticated.");
      return;
    }

    let cancelled = false;
    apiFetch<CreditsResponse>("/api/credits/", { method: "GET", token: accessToken })
      .then((res) => {
        if (cancelled) return;
        setData(res ?? null);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError("Failed to load credits.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokens?.access]);

  const balance =
    data?.credits_balance ??
    data?.credits_available ??
    data?.balance ??
    null;
  const balanceNum =
    balance != null && Number.isFinite(balance) ? Number(balance) : null;
  const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
  const recentTransactions = transactions.slice(0, 10);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Credits</h1>

          {loading && <p className="text-gray-500">Loading…</p>}

          {error && !loading && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {!loading && !error && (
            <>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-500">Current balance</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {balanceNum != null ? balanceNum : "—"} credit{balanceNum !== 1 ? "s" : ""}
                </p>
                {balanceNum === 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    You need credits to respond to jobs. Contact admin for test credits.
                  </p>
                )}
              </div>

              <div>
                <h2 className="mb-2 text-lg font-medium text-gray-900">Recent transactions</h2>
                {recentTransactions.length > 0 ? (
                  <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
                    {recentTransactions.map((tx, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {tx.type ?? "—"} {tx.amount != null ? (tx.amount >= 0 ? `+${tx.amount}` : String(tx.amount)) : ""}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(tx.created_at)}</span>
                        {tx.note != null && tx.note !== "" && (
                          <span className="w-full text-xs text-gray-400">{tx.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    No transactions yet.
                  </p>
                )}
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Testing</p>
                <p className="mt-1">
                  To add credits for testing, use Django admin refund/credit transaction.
                </p>
                <p className="mt-2 text-amber-700">
                  We&apos;ll implement purchase later.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
  );
}
