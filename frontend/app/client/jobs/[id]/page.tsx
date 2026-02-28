"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** Single response in JobRequestDetailSerializer.responses (includes badges from Week 2). */
type JobResponseItem = {
  id?: number;
  provider?: number;
  provider_email?: string;
  provider_company?: string;
  proposed_price_amd?: number | null;
  timeline_text?: string;
  cover_message?: string;
  decision_status?: string;
  created_at?: string | null;
  badges?: string[];
};

/** Accepted response from JobRequestDetailSerializer.accepted_response */
type AcceptedResponse = {
  id: number;
  provider_email?: string;
  provider_company?: string;
} | null;

/** Client's own review for this job (from JobRequestDetailSerializer.my_review) */
type MyReview = {
  rating: number;
  comment: string;
  created_at: string | null;
} | null;

/** Shape from backend JobRequestDetailSerializer */
type JobDetail = {
  id?: number;
  title?: string;
  description?: string;
  category?: string;
  city?: string;
  budget_min_amd?: number | null;
  budget_max_amd?: number | null;
  deadline_date?: string | null;
  status?: string;
  visibility?: string;
   moderation_status?: string;
   moderation_note?: string | null;
  response_price_credits?: number;
  responses_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
  responses?: JobResponseItem[];
  accepted_response?: AcceptedResponse;
  can_review?: boolean;
  my_review?: MyReview;
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

/** Backend: POST /api/jobs/{id}/accept-reject/ expects decision_status ("accepted" | "rejected") and response_id */
const DECISION_ACCEPTED = "accepted";
const DECISION_REJECTED = "rejected";
const JOB_STATUS_OPEN = "open";
const JOB_STATUS_ASSIGNED = "assigned";
const JOB_STATUS_CLOSED = "closed";
const JOB_STATUS_CANCELLED = "cancelled";
const JOB_STATUS_DELETED = "deleted";
const RESPONSE_PENDING = "pending";

const BADGE_LABELS: Record<string, string> = {
  verified: "Verified",
  top_rated: "Top rated",
  fast_responder: "Fast responder",
};

export default function ClientJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? String(params.id) : null;
  const { tokens } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const fetchJob = useCallback((signal?: AbortSignal) => {
    if (!id || !tokens?.access) return Promise.resolve();
    return apiFetch<JobDetail>(`/api/jobs/${id}/`, {
      method: "GET",
      token: tokens.access,
      signal: signal ?? undefined,
    })
      .then((data) => {
        setJob(data ?? null);
        setError("");
      })
      .catch((err) => {
        if (err?.name === "AbortError" || (err instanceof ApiError && err.status === 0)) return;
        setJob(null);
        if (err instanceof ApiError && err.status === 404) {
          setError("Job not found or you don't have access to it.");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view this job.");
        } else {
          setError("Failed to load job.");
        }
      });
  }, [id, tokens?.access]);

  useEffect(() => {
    if (!id || !tokens?.access) {
      setLoading(false);
      if (!tokens?.access) setError("Not authenticated.");
      else if (!id) setError("Invalid job.");
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    fetchJob(ac.signal)?.finally(() => {
      if (!ac.signal.aborted) setLoading(false);
    });

    return () => {
      ac.abort();
    };
  }, [id, tokens?.access, fetchJob]);

  const handleAcceptReject = async (responseId: number, decisionStatus: "accepted" | "rejected") => {
    if (!id || !tokens?.access || !Number.isFinite(responseId)) return;
    setActionError("");
    setSuccessMessage("");
    setLoadingActionId(responseId);

    try {
      await apiFetch(`/api/jobs/${id}/accept-reject/`, {
        method: "POST",
        token: tokens.access,
        body: {
          response_id: responseId,
          decision_status: decisionStatus,
        },
      });
      setSuccessMessage(decisionStatus === DECISION_ACCEPTED ? "Response accepted." : "Response rejected.");
      await fetchJob();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setActionError("You don't have permission to accept or reject responses for this job.");
        } else if (err.status === 404) {
          setActionError("Invalid response.");
        } else if (err.status === 400) {
          const detail = err.body && typeof err.body === "object" ? (err.body as { detail?: string }).detail : undefined;
          const msg = typeof detail === "string" ? detail : err.message || "Invalid request.";
          if (/already assigned|not open/i.test(msg)) {
            setActionError("Job already assigned.");
          } else {
            setActionError(msg);
          }
        } else {
          setActionError(err.message || "Request failed.");
        }
      } else {
        setActionError("Request failed.");
      }
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCancel = async () => {
    if (!id || !tokens?.access) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        "Cancel this job? Providers will no longer see it, but it will remain in your list."
      );
    if (!confirmed) return;
    setActionError("");
    setSuccessMessage("");
    setCancelling(true);
    try {
      await apiFetch<{ ok?: boolean; status?: string }>(`/api/jobs/${id}/cancel/`, {
        method: "POST",
        token: tokens.access,
        body: {},
      });
      setSuccessMessage("Job cancelled.");
      await fetchJob();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          err.body && typeof err.body === "object" && (err.body as { detail?: string }).detail != null
            ? String((err.body as { detail?: string }).detail)
            : err.message || "Failed to cancel job.";
        setActionError(msg);
      } else {
        setActionError("Failed to cancel job.");
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !tokens?.access) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        "Delete this job permanently from your dashboard? This cannot be undone."
      );
    if (!confirmed) return;
    setActionError("");
    setDeleting(true);
    try {
      await apiFetch(`/api/jobs/${id}/`, { method: "DELETE", token: tokens.access });
      router.replace("/client/jobs");
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          err.body && typeof err.body === "object" && (err.body as { detail?: string }).detail != null
            ? String((err.body as { detail?: string }).detail)
            : err.message || "Failed to delete job.";
        setActionError(msg);
      } else {
        setActionError("Failed to delete job.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleReopen = async () => {
    if (!id || !tokens?.access) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm("Reopen this job? It will appear in the provider feed again.");
    if (!confirmed) return;
    setActionError("");
    setSuccessMessage("");
    setReopening(true);
    try {
      await apiFetch<{ ok?: boolean; status?: string }>(`/api/jobs/${id}/reopen/`, {
        method: "POST",
        token: tokens.access,
        body: {},
      });
      setSuccessMessage("Job reopened.");
      await fetchJob();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          err.body && typeof err.body === "object" && (err.body as { detail?: string }).detail != null
            ? String((err.body as { detail?: string }).detail)
            : err.message || "Failed to reopen job.";
        setActionError(msg);
      } else {
        setActionError("Failed to reopen job.");
      }
    } finally {
      setReopening(false);
    }
  };

  const handleRestore = async () => {
    if (!id || !tokens?.access) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm("Restore this job? It will appear back in your list and in the provider feed.");
    if (!confirmed) return;
    setActionError("");
    setSuccessMessage("");
    setRestoring(true);
    try {
      await apiFetch<{ ok?: boolean; status?: string }>(`/api/jobs/${id}/restore/`, {
        method: "POST",
        token: tokens.access,
        body: {},
      });
      setSuccessMessage("Job restored.");
      await fetchJob();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          err.body && typeof err.body === "object" && (err.body as { detail?: string }).detail != null
            ? String((err.body as { detail?: string }).detail)
            : err.message || "Failed to restore job.";
        setActionError(msg);
      } else {
        setActionError("Failed to restore job.");
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = async () => {
    if (!id || !tokens?.access) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm("Mark this job as done? You can still leave feedback for the provider.");
    if (!confirmed) return;
    setActionError("");
    setSuccessMessage("");
    setClosing(true);
    try {
      await apiFetch<{ ok?: boolean; status?: string }>(`/api/jobs/${id}/close/`, {
        method: "POST",
        token: tokens.access,
        body: {},
      });
      setSuccessMessage("Job marked as done.");
      await fetchJob();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          err.body && typeof err.body === "object" && (err.body as { detail?: string }).detail != null
            ? String((err.body as { detail?: string }).detail)
            : err.message || "Failed to mark as done.";
        setActionError(msg);
      } else {
        setActionError("Failed to mark as done.");
      }
    } finally {
      setClosing(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tokens?.access) return;
    setReviewError("");
    setSubmittingReview(true);
    try {
      await apiFetch<{ rating: number; comment: string; created_at: string }>(`/api/jobs/${id}/review/`, {
        method: "POST",
        token: tokens.access,
        body: { rating: reviewRating, comment: reviewComment.trim() },
      });
      setSuccessMessage("Thank you! Your review has been submitted.");
      setReviewComment("");
      await fetchJob();
    } catch (err) {
      if (err instanceof ApiError) {
        setReviewError(err.message || "Failed to submit review.");
      } else {
        setReviewError("Failed to submit review.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const canShowActions =
    job != null &&
    (job.status ?? "").toLowerCase() === JOB_STATUS_OPEN;

  const isResponsePending = (resp: JobResponseItem) =>
    (resp.decision_status ?? "").toLowerCase() === RESPONSE_PENDING;

  if (!id) {
    return (
      <RequireAuth role="client">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-red-600">Invalid job.</p>
          <Link href="/client/jobs" className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900">
            ← Back to My Jobs
          </Link>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth role="client">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/client/jobs"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to My Jobs
            </Link>
            {!loading && !error && job && (
              <>
                <Link
                  href={`/client/create?duplicate=${encodeURIComponent(String(job.id ?? id))}`}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Duplicate
                </Link>
                {(job.status ?? "").toLowerCase() === JOB_STATUS_OPEN && (
                  <Link
                    href={`/client/jobs/${id}/edit`}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Edit
                  </Link>
                )}
                {(job.status ?? "").toLowerCase() === JOB_STATUS_CANCELLED && (
                  <button
                    type="button"
                    disabled={reopening || restoring || (job.responses_count ?? 0) > 0}
                    onClick={handleReopen}
                    title={(job.responses_count ?? 0) > 0 ? "Cannot reopen: job has responses." : undefined}
                    className="rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {reopening ? "Reopening…" : "Reopen Job"}
                  </button>
                )}
                {(job.status ?? "").toLowerCase() === JOB_STATUS_DELETED && (
                  <button
                    type="button"
                    disabled={reopening || restoring}
                    onClick={handleRestore}
                    className="rounded-lg border border-green-300 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {restoring ? "Restoring…" : "Restore Job"}
                  </button>
                )}
                {(job.status ?? "").toLowerCase() === JOB_STATUS_ASSIGNED && (
                  <button
                    type="button"
                    disabled={closing}
                    onClick={handleClose}
                    className="rounded-lg border border-green-300 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {closing ? "Marking…" : "Mark as done"}
                  </button>
                )}
                {(job.status ?? "").toLowerCase() !== JOB_STATUS_CANCELLED &&
                  (job.status ?? "").toLowerCase() !== JOB_STATUS_DELETED &&
                  (job.status ?? "").toLowerCase() !== JOB_STATUS_ASSIGNED &&
                  (job.status ?? "").toLowerCase() !== JOB_STATUS_CLOSED && (
                    <button
                      type="button"
                      disabled={cancelling || deleting}
                      onClick={handleCancel}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {cancelling ? "Cancelling…" : "Cancel Job"}
                    </button>
                  )}
                {(job.status ?? "").toLowerCase() !== JOB_STATUS_DELETED &&
                  (job.status ?? "").toLowerCase() !== JOB_STATUS_ASSIGNED &&
                  (job.status ?? "").toLowerCase() !== JOB_STATUS_CLOSED && (
                  <button
                    type="button"
                    disabled={cancelling || deleting || reopening || restoring || closing}
                    onClick={handleDelete}
                    className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete Job"}
                  </button>
                )}
              </>
            )}
          </div>

          {loading && <p className="text-gray-500">Loading…</p>}

          {error && !loading && (
            <>
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              <Link href="/client/jobs" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
                ← Back to My Jobs
              </Link>
            </>
          )}

          {successMessage && (
            <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
              {successMessage}
            </div>
          )}

          {actionError && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {!loading && !error && job && (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {job.title ?? "Untitled"}
                </h1>
                {(job.status ?? "").toLowerCase() === JOB_STATUS_CANCELLED ? (
                  <span
                    className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800"
                    aria-label="Status"
                  >
                    Cancelled
                  </span>
                ) : (job.status ?? "").toLowerCase() === JOB_STATUS_DELETED ? (
                  <span
                    className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-800"
                    aria-label="Status"
                  >
                    Deleted
                  </span>
                ) : (job.status ?? "").toLowerCase() === JOB_STATUS_ASSIGNED ? (
                  <span
                    className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"
                    aria-label="Status"
                  >
                    Assigned
                  </span>
                ) : (job.status ?? "").toLowerCase() === JOB_STATUS_CLOSED ? (
                  <span
                    className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-700"
                    aria-label="Status"
                  >
                    Done
                  </span>
                ) : (
                  <span
                    className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700"
                    aria-label="Status"
                  >
                    {job.status ?? "—"}
                  </span>
                )}
              </div>

              {job.moderation_status && (
                <p
                  className={`mt-1 text-sm ${
                    (job.moderation_status ?? "").toLowerCase() === "rejected"
                      ? "text-red-600"
                      : (job.moderation_status ?? "").toLowerCase() === "pending"
                        ? "text-amber-700"
                        : "text-gray-600"
                  }`}
                >
                  {(job.moderation_status ?? "").toLowerCase() === "pending"
                    ? "Pending admin review – your job is not yet visible to executors."
                    : (job.moderation_status ?? "").toLowerCase() === "approved"
                      ? "Approved by admin – visible to executors."
                      : (job.moderation_status ?? "").toLowerCase() === "rejected"
                        ? `Rejected by admin${job.moderation_note ? `: ${job.moderation_note}` : ""}`
                        : null}
                </p>
              )}

              {(job.status ?? "").toLowerCase() === JOB_STATUS_ASSIGNED && job.accepted_response && (
                <p className="text-sm text-gray-700">
                  Assigned to:{" "}
                  <span className="font-medium">
                    {job.accepted_response.provider_company?.trim() ||
                      job.accepted_response.provider_email ||
                      "Provider"}
                  </span>
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {(job.category ?? job.city) && (
                  <p className="text-sm text-gray-500">
                    {[job.category, job.city].filter(Boolean).join(" · ")}
                  </p>
                )}
                {(job.created_at ?? job.updated_at) && (
                  <p className="text-xs text-gray-400">
                    {job.created_at && `Created ${formatDate(job.created_at)}`}
                    {job.created_at && job.updated_at && " · "}
                    {job.updated_at && `Updated ${formatDate(job.updated_at)}`}
                  </p>
                )}
              </div>

              {job.response_price_credits != null && Number.isFinite(job.response_price_credits) && (
                <p className="text-sm text-gray-600">
                  Response cost: {job.response_price_credits} credit{job.response_price_credits !== 1 ? "s" : ""} (for providers)
                </p>
              )}

              {job.description != null && job.description !== "" && (
                <div>
                  <h2 className="mb-1 text-sm font-medium text-gray-700">Description</h2>
                  <p className="whitespace-pre-wrap text-gray-900">{job.description}</p>
                </div>
              )}

              {(job.budget_min_amd != null || job.budget_max_amd != null) && (
                <p className="text-sm text-gray-600">
                  Budget:{" "}
                  {job.budget_min_amd != null && job.budget_max_amd != null
                    ? `${job.budget_min_amd} – ${job.budget_max_amd} AMD`
                    : job.budget_min_amd != null
                      ? `from ${job.budget_min_amd} AMD`
                      : `up to ${job.budget_max_amd} AMD`}
                </p>
              )}

              {job.deadline_date != null && job.deadline_date !== "" && (
                <p className="text-sm text-gray-600">Deadline: {formatDate(job.deadline_date)}</p>
              )}

              <div>
                <h2 className="mb-2 text-lg font-medium text-gray-900">
                  Responses {job.responses_count != null ? `(${job.responses_count})` : ""}
                </h2>
                {Array.isArray(job.responses) && job.responses.length > 0 ? (
                  <ul className="space-y-4">
                    {job.responses.map((resp) => {
                      const respId = resp.id;
                      const showButtons =
                        canShowActions &&
                        respId != null &&
                        isResponsePending(resp);
                      const isBusy = loadingActionId === respId;

                      return (
                        <li
                          key={respId ?? Math.random()}
                          className="rounded-md border border-gray-200 p-4"
                        >
                          <div className="flex flex-wrap justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {resp.provider_company ?? resp.provider_email ?? "Provider"}
                              </span>
                              {resp.provider != null && id && (
                                <Link
                                  href={`/executor/${resp.provider}?from_job=${encodeURIComponent(id)}`}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                >
                                  View profile
                                </Link>
                              )}
                            </div>
                            {resp.decision_status != null && resp.decision_status !== "" && (
                              <span className="text-sm text-gray-500">{resp.decision_status}</span>
                            )}
                          </div>
                          {Array.isArray(resp.badges) && resp.badges.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {resp.badges.map((key) => (
                                <span
                                  key={key}
                                  className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                >
                                  {BADGE_LABELS[key] ?? key}
                                </span>
                              ))}
                            </div>
                          )}
                          {resp.proposed_price_amd != null && (
                            <p className="mt-1 text-sm text-gray-600">{resp.proposed_price_amd} AMD</p>
                          )}
                          {resp.cover_message != null && resp.cover_message !== "" && (
                            <p className="mt-2 text-sm text-gray-700">{resp.cover_message}</p>
                          )}
                          {resp.timeline_text != null && resp.timeline_text !== "" && (
                            <p className="mt-1 text-xs text-gray-500">{resp.timeline_text}</p>
                          )}
                          {resp.created_at != null && (
                            <p className="mt-1 text-xs text-gray-400">{formatDate(resp.created_at)}</p>
                          )}
                          {showButtons && (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAcceptReject(respId!, DECISION_ACCEPTED)}
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                              >
                                {isBusy ? "…" : "Accept"}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAcceptReject(respId!, DECISION_REJECTED)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                              >
                                {isBusy ? "…" : "Reject"}
                              </button>
                            </div>
                          )}
                          {respId != null && (
                            <div className="mt-2">
                              <Link
                                href={`/chat/${respId}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  chat
                                </span>
                                Open chat
                              </Link>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No responses yet.</p>
                )}
              </div>

              {/* Leave feedback / Your review */}
              {job.can_review && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-3 text-lg font-medium text-gray-900">Leave feedback</h2>
                  <form onSubmit={handleSubmitReview} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Rating (1–5)</label>
                      <select
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="block w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? "star" : "stars"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Comment (optional)</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={3}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Share your experience with the provider…"
                      />
                    </div>
                    {reviewError && (
                      <p className="text-sm text-red-600">{reviewError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {submittingReview ? "Submitting…" : "Submit review"}
                    </button>
                  </form>
                </div>
              )}
              {job.my_review && !job.can_review && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-2 text-lg font-medium text-gray-900">Your review</h2>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium" aria-label="Rating">
                      {"★".repeat(job.my_review.rating)}{"☆".repeat(5 - job.my_review.rating)}
                    </span>{" "}
                    {job.my_review.rating} / 5
                  </p>
                  {job.my_review.comment != null && job.my_review.comment !== "" && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{job.my_review.comment}</p>
                  )}
                  {job.my_review.created_at && (
                    <p className="mt-1 text-xs text-gray-400">Submitted {formatDate(job.my_review.created_at)}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
