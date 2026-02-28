"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Shape from backend JobRequestListSerializer:
 * id, title, category, city, status, response_price_credits, responses_count, created_at, accepted_provider_name
 */
type JobListItem = {
  id?: number;
  title?: string;
  category?: string;
  city?: string;
  status?: string;
  moderation_status?: string;
  moderation_note?: string | null;
  response_price_credits?: number;
  responses_count?: number;
  created_at?: string | null;
  accepted_provider_name?: string | null;
};

type JobsResponse = {
  results?: JobListItem[];
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

function jobTitle(job: JobListItem): string {
  return job.title ?? "Untitled";
}

function jobStatus(job: JobListItem): string {
  return job.status ?? "—";
}

function jobCity(job: JobListItem): string {
  return job.city ?? "";
}

function jobCategory(job: JobListItem): string {
  return job.category ?? "";
}

function jobCreatedAt(job: JobListItem): string {
  return formatDate(job.created_at ?? null);
}

type StatusFilter = "all" | "open" | "cancelled" | "deleted";

export default function ClientJobsPage() {
  const { tokens } = useAuth();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const accessToken = tokens?.access ?? null;
    if (!accessToken) {
      setLoading(false);
      setError("Not authenticated.");
      return;
    }

    const params = new URLSearchParams();
    if (statusFilter === "open") params.set("status", "open");
    else if (statusFilter === "assigned") params.set("status", "assigned");
    else if (statusFilter === "cancelled") params.set("status", "cancelled");
    else if (statusFilter === "closed") params.set("status", "closed");
    else if (statusFilter === "deleted") params.set("status", "deleted");
    const query = params.toString();
    const url = query ? `/api/jobs/?${query}` : "/api/jobs/";

    let cancelled = false;
    apiFetch<JobsResponse>(url, { method: "GET", token: accessToken })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.results) ? data.results : [];
        setJobs(list);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
        setError("Failed to load jobs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokens?.access, statusFilter]);

  return (
    <RequireAuth role="client">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/client"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </Link>
            <Link
              href="/client/create"
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create New Job
            </Link>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900">My Jobs</h1>

          <div className="flex flex-wrap gap-2">
            {(["all", "open", "assigned", "cancelled", "closed", "deleted"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  statusFilter === filter
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {filter === "all"
                  ? "All"
                  : filter === "open"
                    ? "Open"
                    : filter === "assigned"
                      ? "Assigned"
                      : filter === "cancelled"
                        ? "Cancelled"
                        : filter === "closed"
                          ? "Done"
                          : "Deleted"}
              </button>
            ))}
          </div>

          {loading && (
            <p className="text-gray-500">Loading…</p>
          )}

          {error && !loading && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {!loading && !error && jobs.length === 0 && (
            <p className="text-gray-500">You have no jobs yet. Create one to get started.</p>
          )}

          {!loading && !error && jobs.length > 0 && (
            <ul className="divide-y divide-gray-200">
              {jobs.map((job) => {
                const id = job.id;
                const title = jobTitle(job);
                const status = jobStatus(job);
                const moderationStatus = (job.moderation_status ?? "").toLowerCase();
                const moderationNote = job.moderation_note ?? "";
                const city = jobCity(job);
                const category = jobCategory(job);
                const createdStr = jobCreatedAt(job);
                const meta = [city, category].filter(Boolean).join(" · ") || null;
                const assignedTo = job.accepted_provider_name?.trim() || null;

                return (
                  <li key={id ?? title} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-gray-200 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium text-gray-900">{title}</span>
                          <span
                            className={
                              (status ?? "").toLowerCase() === "cancelled"
                                ? "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                                : (status ?? "").toLowerCase() === "deleted"
                                  ? "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                                  : (status ?? "").toLowerCase() === "assigned"
                                    ? "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
                                    : (status ?? "").toLowerCase() === "closed"
                                      ? "inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                                      : "inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                            }
                            aria-label="Status"
                          >
                            {(status ?? "").toLowerCase() === "cancelled"
                              ? "Cancelled"
                              : (status ?? "").toLowerCase() === "deleted"
                                ? "Deleted"
                                : (status ?? "").toLowerCase() === "assigned"
                                  ? "Assigned"
                                  : (status ?? "").toLowerCase() === "closed"
                                    ? "Done"
                                    : status}
                          </span>
                        </div>
                        {assignedTo && (
                          <p className="mt-1 text-sm text-gray-600">
                            Assigned to: <span className="font-medium">{assignedTo}</span>
                          </p>
                        )}
                        {moderationStatus && (
                          <p
                            className={`mt-1 text-xs ${
                              moderationStatus === "rejected"
                                ? "text-red-600"
                                : moderationStatus === "pending"
                                  ? "text-amber-700"
                                  : "text-gray-500"
                            }`}
                          >
                            {moderationStatus === "pending"
                              ? "Pending admin review – not yet visible to executors."
                              : moderationStatus === "approved"
                                ? "Approved by admin."
                                : moderationStatus === "rejected"
                                  ? `Rejected by admin${moderationNote ? `: ${moderationNote}` : ""}`
                                  : null}
                          </p>
                        )}
                        {meta && (
                          <p className="mt-1 text-sm text-gray-500">{meta}</p>
                        )}
                        {createdStr && (
                          <p className="mt-0.5 text-xs text-gray-400">{createdStr}</p>
                        )}
                      </div>
                      {id != null && (
                        <div className="flex shrink-0 gap-2">
                          <Link
                            href={`/client/jobs/${id}`}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                          >
                            View
                          </Link>
                          <Link
                            href={`/client/create?duplicate=${encodeURIComponent(String(id))}`}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                          >
                            Duplicate
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
