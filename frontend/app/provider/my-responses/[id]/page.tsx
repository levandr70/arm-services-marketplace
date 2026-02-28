"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ResponseDetail = {
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

export default function ProviderMyResponseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? String(params.id) : null;
  const responseId = id != null && /^\d+$/.test(id) ? parseInt(id, 10) : null;
  const { tokens } = useAuth();

  const [response, setResponse] = useState<ResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editCover, setEditCover] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTimeline, setEditTimeline] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchResponse = useCallback(() => {
    if (!responseId || !tokens?.access) return Promise.resolve();
    setLoading(true);
    setError("");
    return apiFetch<ResponseDetail>(`/api/my-responses/${responseId}/`, { method: "GET", token: tokens.access })
      .then((data) => {
        setResponse(data ?? null);
        setEditCover((data?.cover_message ?? "").trim());
        setEditPrice(data?.proposed_price_amd != null ? String(data.proposed_price_amd) : "");
        setEditTimeline((data?.timeline_text ?? "").trim());
      })
      .catch((err) => {
        setResponse(null);
        setError(err instanceof ApiError && err.status === 404 ? "Response not found." : "Failed to load response.");
      })
      .finally(() => setLoading(false));
  }, [responseId, tokens?.access]);

  useEffect(() => {
    if (!tokens?.access || responseId == null) {
      setLoading(false);
      if (!tokens?.access) setError("Not authenticated.");
      else if (responseId == null) setError("Invalid response.");
      return;
    }
    fetchResponse();
  }, [tokens?.access, responseId, fetchResponse]);

  const handleWithdraw = async () => {
    if (!responseId || !tokens?.access) return;
    if (!confirm("Withdraw this response? Your credits will be refunded.")) return;
    setActionError("");
    setWithdrawing(true);
    try {
      await apiFetch(`/api/my-responses/${responseId}/withdraw/`, { method: "POST", token: tokens.access, body: {} });
      router.replace("/provider/my-responses");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to withdraw.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseId || !tokens?.access) return;
    setActionError("");
    setSaving(true);
    try {
      const body: { cover_message?: string; proposed_price_amd?: number | null; timeline_text?: string } = {
        cover_message: editCover.trim(),
        timeline_text: editTimeline.trim(),
      };
      const priceNum = editPrice.trim() ? parseInt(editPrice.trim(), 10) : null;
      if (priceNum != null && Number.isFinite(priceNum) && priceNum >= 0) body.proposed_price_amd = priceNum;
      else body.proposed_price_amd = null;
      await apiFetch<ResponseDetail>(`/api/my-responses/${responseId}/`, {
        method: "PATCH",
        token: tokens.access,
        body,
      });
      setResponse((prev) => (prev ? { ...prev, ...body } : null));
      setEditing(false);
      fetchResponse();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const pending = (response?.decision_status ?? "").toLowerCase() === "pending";
  const canEdit = pending;

  if (!id || responseId == null) {
    return (
      <RequireAuth role="provider">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-red-600">Invalid response.</p>
          <Link href="/provider/my-responses" className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900">
            ← My Responses
          </Link>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth role="provider">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/provider/my-responses" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              ← My Responses
            </Link>
            <Link href="/provider/feed" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Feed
            </Link>
          </div>

          {loading && <p className="text-gray-500">Loading…</p>}
          {error && !loading && (
            <>
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              <Link href="/provider/my-responses" className="inline-block text-sm font-medium text-gray-600 hover:text-gray-900">
                ← My Responses
              </Link>
            </>
          )}

          {!loading && !error && response && (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="text-2xl font-semibold text-gray-900">Your response</h1>
                <span className={statusBadgeClass(response.decision_status)}>{statusLabel(response.decision_status)}</span>
              </div>

              {response.job_id != null && (
                <p className="text-sm text-gray-600">
                  Job:{" "}
                  <Link href={`/provider/jobs/${response.job_id}`} className="font-medium text-blue-600 hover:underline">
                    {response.job_title ?? `#${response.job_id}`}
                  </Link>
                  {" "}(#{response.job_id})
                </p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-0 text-sm text-gray-500">
                {response.created_at && <span>Submitted {formatDate(response.created_at)}</span>}
                {response.response_fee_credits != null && (
                  <span>{response.response_fee_credits} credit{response.response_fee_credits !== 1 ? "s" : ""} paid</span>
                )}
              </div>

              {actionError && (
                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
              )}

              {!editing ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h2 className="text-sm font-medium text-gray-900">Your message</h2>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">{response.cover_message || "—"}</p>
                  {response.timeline_text && (
                    <>
                      <h2 className="mt-3 text-sm font-medium text-gray-900">Timeline</h2>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">{response.timeline_text}</p>
                    </>
                  )}
                  {response.proposed_price_amd != null && (
                    <p className="mt-2 text-sm text-gray-600">Proposed price: {response.proposed_price_amd} AMD</p>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit response
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSaveEdit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                    <textarea
                      value={editCover}
                      onChange={(e) => setEditCover(e.target.value)}
                      rows={4}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Proposed price (AMD)</label>
                    <input
                      type="number"
                      min={0}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Timeline</label>
                    <textarea
                      value={editTimeline}
                      onChange={(e) => setEditTimeline(e.target.value)}
                      rows={2}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setActionError(""); }}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {pending && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={withdrawing}
                    onClick={handleWithdraw}
                    className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {withdrawing ? "Withdrawing…" : "Withdraw response"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
