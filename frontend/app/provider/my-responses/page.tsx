"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MyResponseItem = {
  id?: number;
  job_id?: number;
  job_title?: string;
  decision_status?: string;
  response_fee_credits?: number;
  created_at?: string | null;
  proposed_price_amd?: number | null;
  cover_message?: string;
  timeline_text?: string;
};

type MyResponsesResponse = {
  results?: MyResponseItem[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso);
  }
}

function statusLabel(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "accepted") return "Accepted";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

function statusBadgeClass(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "accepted") return "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800";
  if (s === "rejected") return "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800";
  return "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800";
}

const MESSAGE_TRUNCATE_LENGTH = 120;

function truncateMessage(msg: string | null | undefined): string {
  if (msg == null || msg === "") return "";
  const s = String(msg).trim();
  if (s.length <= MESSAGE_TRUNCATE_LENGTH) return s;
  return s.slice(0, MESSAGE_TRUNCATE_LENGTH) + "…";
}

function buildMyResponsesUrl(params: { status?: string; page?: number }): string {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.page != null && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `/api/my-responses/?${s}` : "/api/my-responses/";
}

export default function ProviderMyResponsesPage() {
  const { tokens } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [items, setItems] = useState<MyResponseItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const setFilters = useCallback(
    (updates: { status?: string; page?: number }) => {
      const p = new URLSearchParams(searchParams.toString());
      if (updates.status !== undefined) (updates.status ? p.set("status", updates.status) : p.delete("status"));
      if (updates.page !== undefined) (updates.page != null && updates.page > 1 ? p.set("page", String(updates.page)) : p.delete("page"));
      router.replace(`/provider/my-responses?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const fetchResponses = useCallback(() => {
    if (!tokens?.access) return Promise.resolve();
    setLoading(true);
    setError("");
    return apiFetch<MyResponsesResponse>(buildMyResponsesUrl({ status: statusFilter || undefined, page }), {
      method: "GET",
      token: tokens.access,
    })
      .then((data) => {
        setItems(Array.isArray(data?.results) ? data.results : []);
        setTotalCount(data?.count ?? null);
        setNextUrl(data?.next ?? null);
        setPrevUrl(data?.previous ?? null);
      })
      .catch(() => {
        setItems([]);
        setError("Failed to load responses.");
      })
      .finally(() => setLoading(false));
  }, [tokens?.access, statusFilter, page]);

  useEffect(() => {
    if (!tokens?.access) {
      setLoading(false);
      setError("Not authenticated.");
      return;
    }
    fetchResponses();
  }, [tokens?.access, fetchResponses]);

  const handleWithdraw = async (responseId: number) => {
    if (!tokens?.access) return;
    if (!confirm("Withdraw this response? Your credits will be refunded.")) return;
    setActionError("");
    setWithdrawingId(responseId);
    try {
      await apiFetch<{ ok?: boolean }>(`/api/my-responses/${responseId}/withdraw/`, {
        method: "POST",
        token: tokens.access,
        body: {},
      });
      await fetchResponses();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to withdraw.");
    } finally {
      setWithdrawingId(null);
    }
  };

  const isPending = (item: MyResponseItem) => (item.decision_status ?? "").toLowerCase() === "pending";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Responses</h1>

          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setFilters({ status: e.target.value || undefined, page: 1 })}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {actionError && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
          )}

          {loading && <p className="text-gray-500">Loading…</p>}

          {error && !loading && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 py-12 text-center">
              <p className="text-gray-600">No responses yet.</p>
              <Link
                href="/provider/feed"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Go to Feed
              </Link>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className="space-y-4">
              {items.map((item) => {
                const jobId = item.job_id;
                const jobTitle = item.job_title ?? "Untitled job";
                const createdStr = formatDate(item.created_at ?? null);
                const credits = item.response_fee_credits;
                const message = truncateMessage(item.cover_message);
                const pending = isPending(item);
                return (
                  <li
                    key={item.id ?? Math.random()}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {jobId != null ? (
                          <Link
                            href={`/provider/my-responses/${item.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {jobTitle}
                          </Link>
                        ) : (
                          <span className="font-medium text-gray-900">{jobTitle}</span>
                        )}
                        {jobId != null && (
                          <span className="text-xs text-gray-400" aria-label="Job ID">
                            #{jobId}
                          </span>
                        )}
                        <span
                          className={statusBadgeClass(item.decision_status)}
                          aria-label="Response status"
                        >
                          {statusLabel(item.decision_status)}
                        </span>
                      </div>
                      {message ? (
                        <p className="mt-1.5 text-sm text-gray-700" title={item.cover_message}>
                          Your message: {message}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0 text-sm text-gray-500">
                        {createdStr ? <span>Submitted {createdStr}</span> : null}
                        {credits != null && Number.isFinite(credits) ? (
                          <span>{credits} credit{credits !== 1 ? "s" : ""} paid</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {jobId != null && (
                        <Link
                          href={`/provider/jobs/${jobId}`}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                          View job
                        </Link>
                      )}
                      {item.id != null && (
                        <Link
                          href={`/provider/my-responses/${item.id}`}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                          Details
                        </Link>
                      )}
                      {item.id != null && (
                        <Link
                          href={`/chat/${item.id}`}
                          className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                          Chat with client
                        </Link>
                      )}
                      {pending && item.id != null && (
                        <button
                          type="button"
                          disabled={withdrawingId === item.id}
                          onClick={() => handleWithdraw(item.id!)}
                          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                          {withdrawingId === item.id ? "Withdrawing…" : "Withdraw"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          {!loading && !error && (nextUrl || prevUrl || (totalCount != null && totalCount > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
              <div>
                {prevUrl ? (
                  <button
                    type="button"
                    onClick={() => setFilters({ page: page - 1 })}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    ← Previous
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">← Previous</span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                Page {page}
                {totalCount != null && totalCount > 0 && ` · ${totalCount} total`}
              </span>
              <div>
                {nextUrl ? (
                  <button
                    type="button"
                    onClick={() => setFilters({ page: page + 1 })}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Next →
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">Next →</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
