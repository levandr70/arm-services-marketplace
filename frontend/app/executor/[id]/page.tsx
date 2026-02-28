"use client";

import { apiFetch, ApiError } from "@/lib/api";
import { useCategories } from "@/lib/categoriesCities";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PortfolioItem = { url?: string; title?: string };

type PublicExecutor = {
  id?: number;
  full_name?: string;
  city?: string;
  company_name?: string;
  description?: string;
  tags?: string[];
  portfolio?: PortfolioItem[];
  verification_status?: string;
  completed_jobs_count?: number;
  rating_avg?: number | null;
};

export default function ExecutorProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id != null ? String(params.id) : null;
  const fromJobId = searchParams.get("from_job");
  const { categories: categoryOptions } = useCategories();
  const [profile, setProfile] = useState<PublicExecutor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(() => {
    if (!id || !/^\d+$/.test(id)) return Promise.resolve();
    return apiFetch<PublicExecutor>(`/api/executors/${id}/`, { method: "GET" })
      .then((data) => {
        setProfile(data ?? null);
        setError("");
      })
      .catch((err) => {
        setProfile(null);
        setError(err instanceof ApiError && err.status === 404 ? "Executor not found." : "Failed to load profile.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Invalid executor.");
      return;
    }
    setLoading(true);
    fetchProfile();
  }, [id, fetchProfile]);

  const categoryLabel = (value: string) =>
    categoryOptions.find((c) => c.value === value)?.label ?? value;

  if (!id) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-red-600">Invalid executor.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {fromJobId ? (
            <Link
              href={`/client/jobs/${fromJobId}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              ← Back to job
            </Link>
          ) : null}
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            {fromJobId ? "Home" : "← Back to home"}
          </Link>
        </div>

        {loading && <p className="text-gray-500">Loading…</p>}

        {error && !loading && (
          <>
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            {fromJobId && (
              <Link href={`/client/jobs/${fromJobId}`} className="mr-3 text-sm font-medium text-blue-600 hover:text-blue-800">
                Back to job
              </Link>
            )}
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Back to home
            </Link>
          </>
        )}

        {!loading && !error && profile && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {profile.company_name?.trim() || profile.full_name || "Executor"}
                </h1>
                {profile.full_name && profile.company_name?.trim() && (
                  <p className="mt-1 text-sm text-gray-600">{profile.full_name}</p>
                )}
                {profile.city && (
                  <p className="mt-1 text-sm text-gray-500">{profile.city}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.verification_status === "verified" && (
                  <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    Verified
                  </span>
                )}
                {profile.completed_jobs_count != null && profile.completed_jobs_count > 0 && (
                  <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {profile.completed_jobs_count} tasks completed
                  </span>
                )}
                {profile.rating_avg != null && (
                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                    Rating: {profile.rating_avg.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {profile.description?.trim() && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900">About</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{profile.description}</p>
              </div>
            )}

            {Array.isArray(profile.tags) && profile.tags.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Service categories</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {profile.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {categoryLabel(tag)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(profile.portfolio) && profile.portfolio.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Portfolio</h2>
                <ul className="mt-2 space-y-2">
                  {profile.portfolio
                    .filter((p) => (p.url ?? "").trim() || (p.title ?? "").trim())
                    .map((item, i) => (
                      <li key={i}>
                        <a
                          href={(item.url ?? "").trim() || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {item.title?.trim() || item.url?.trim() || "Link"}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
