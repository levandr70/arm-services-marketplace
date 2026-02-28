"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * GET /api/feed/{id}/ — JobRequestFeedDetailSerializer: id, title, description, category, city,
 * status, budget_min_amd, budget_max_amd, deadline_date, response_price_credits, responses_count, created_at.
 */
type FeedJobDetail = {
  id?: number;
  title?: string;
  description?: string;
  category?: string;
  city?: string;
  status?: string;
  budget_min_amd?: number | null;
  budget_max_amd?: number | null;
  deadline_date?: string | null;
  response_price_credits?: number;
  responses_count?: number;
  created_at?: string | null;
};

type MyResponseItem = {
  id?: number;
  job_id?: number;
  job_title?: string;
  decision_status?: string;
  response_fee_credits?: number;
  created_at?: string | null;
  cover_message?: string;
};

type MyResponsesResponse = {
  results?: MyResponseItem[];
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
  if (s === "assigned") return "Assigned";
  if (s === "cancelled") return "Cancelled";
  if (s === "deleted") return "Deleted";
  return "Open";
}

function statusBadgeClass(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "accepted" || s === "assigned") return "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800";
  if (s === "rejected") return "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800";
  if (s === "cancelled") return "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800";
  return "inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700";
}

const JOB_STATUS_OPEN = "open";

export default function ProviderJobDetailPage() {
  const params = useParams();
  const id = params?.id != null ? String(params.id) : null;
  const { tokens } = useAuth();
  const [job, setJob] = useState<FeedJobDetail | null>(null);
  const [myResponses, setMyResponses] = useState<MyResponseItem[]>([]);
  const [loadingJob, setLoadingJob] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [jobError, setJobError] = useState("");
  const [responsesError, setResponsesError] = useState("");

  const jobIdNum = id != null && /^\d+$/.test(id) ? Number(id) : null;

  const fetchJob = useCallback(() => {
    if (!jobIdNum || !tokens?.access) return Promise.resolve();
    setLoadingJob(true);
    setJobError("");
    return apiFetch<FeedJobDetail>(`/api/feed/${jobIdNum}/`, { method: "GET", token: tokens.access })
      .then((data) => {
        setJob(data ?? null);
      })
      .catch((err) => {
        setJob(null);
        if (err instanceof ApiError && err.status === 404) {
          setJobError("Job not found or no longer available.");
        } else if (err instanceof ApiError && err.status === 403) {
          setJobError("You don't have permission to view this job.");
        } else {
          setJobError("Failed to load job.");
        }
      })
      .finally(() => setLoadingJob(false));
  }, [jobIdNum, tokens?.access]);

  const fetchMyResponses = useCallback(() => {
    if (!tokens?.access) return Promise.resolve();
    setLoadingResponses(true);
    setResponsesError("");
    return apiFetch<MyResponsesResponse>("/api/my-responses/", { method: "GET", token: tokens.access })
      .then((data) => {
        const list = Array.isArray(data?.results) ? data.results : [];
        setMyResponses(list);
      })
      .catch(() => {
        setMyResponses([]);
        setResponsesError("Failed to load your responses.");
      })
      .finally(() => setLoadingResponses(false));
  }, [tokens?.access]);

  useEffect(() => {
    if (!tokens?.access || jobIdNum == null) {
      setLoadingJob(false);
      setLoadingResponses(false);
      if (!tokens?.access) setJobError("Not authenticated.");
      else if (jobIdNum == null) setJobError("Invalid job.");
      return;
    }
    fetchJob();
    fetchMyResponses();
  }, [jobIdNum, tokens?.access, fetchJob, fetchMyResponses]);

  const myResponse = jobIdNum != null
    ? myResponses.find((r) => r.job_id === jobIdNum)
    : undefined;

  const isOpen = (job?.status ?? "").toLowerCase() === JOB_STATUS_OPEN;
  const loading = loadingJob || loadingResponses;

  if (!id) {
    return (
      <RequireAuth role="provider">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-red-600">Invalid job.</p>
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

          {loading && !job && !jobError && <p className="text-gray-500">Loading…</p>}

          {jobError && !loading && (
            <>
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{jobError}</p>
              {myResponse != null && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h2 className="text-sm font-medium text-gray-900">Your response to this job</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Status: {statusLabel(myResponse.decision_status)}
                    {myResponse.response_fee_credits != null && Number.isFinite(myResponse.response_fee_credits) && (
                      <> · {myResponse.response_fee_credits} credit{myResponse.response_fee_credits !== 1 ? "s" : ""} paid</>
                    )}
                    {myResponse.created_at && <> · {formatDate(myResponse.created_at)}</>}
                  </p>
                  {myResponse.cover_message && (
                    <p className="mt-2 text-sm text-gray-700">{myResponse.cover_message}</p>
                  )}
                  <Link href="/provider/my-responses" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
                    View in My Responses
                  </Link>
                </div>
              )}
              <Link href="/provider/feed" className="inline-block text-sm font-medium text-gray-600 hover:text-gray-900">
                Back to Feed
              </Link>
            </>
          )}

          {responsesError && !loading && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{responsesError}</p>
          )}

          {!loadingJob && !jobError && job && (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {job.title ?? "Untitled"}
                </h1>
                {job.id != null && (
                  <span className="text-xs text-gray-400" aria-label="Job ID">#{job.id}</span>
                )}
                <span className={statusBadgeClass(job.status)} aria-label="Status">
                  {statusLabel(job.status)}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0 text-sm text-gray-500">
                {(job.category ?? job.city) && (
                  <span>{[job.category, job.city].filter(Boolean).join(" · ")}</span>
                )}
                {job.created_at && <span>Posted {formatDate(job.created_at)}</span>}
              </div>

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

              {job.description != null && job.description !== "" && (
                <div>
                  <h2 className="mb-1 text-sm font-medium text-gray-700">Description</h2>
                  <p className="whitespace-pre-wrap text-gray-900">{job.description}</p>
                </div>
              )}

              {myResponse != null ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h2 className="text-sm font-medium text-gray-900">Your Response</h2>
                  {myResponse.cover_message && (
                    <p className="mt-1.5 text-sm text-gray-700">{myResponse.cover_message}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0 text-sm text-gray-500">
                    <span>Status: {statusLabel(myResponse.decision_status)}</span>
                    {myResponse.response_fee_credits != null && Number.isFinite(myResponse.response_fee_credits) && (
                      <span>{myResponse.response_fee_credits} credit{myResponse.response_fee_credits !== 1 ? "s" : ""} paid</span>
                    )}
                    {myResponse.created_at && <span>Submitted {formatDate(myResponse.created_at)}</span>}
                  </div>
                </div>
              ) : isOpen ? (
                <div>
                  <Link
                    href={`/provider/respond/${id}`}
                    className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Respond
                  </Link>
                </div>
              ) : (
                <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This job is not open for responses.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
