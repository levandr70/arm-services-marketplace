"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { useCategoriesAndCities } from "@/lib/categoriesCities";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type FeedJobItem = {
  id?: number;
  title?: string;
  category?: string;
  city?: string;
  status?: string;
  response_price_credits?: number;
  responses_count?: number;
  created_at?: string | null;
  budget_min_amd?: number | null;
  budget_max_amd?: number | null;
};

type FeedResponse = {
  results?: FeedJobItem[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

function jobTitle(job: FeedJobItem): string {
  return job.title ?? "Untitled";
}
function jobCity(job: FeedJobItem): string {
  return job.city ?? "";
}
function jobCategory(job: FeedJobItem): string {
  return job.category ?? "";
}
function jobBudgetRange(job: FeedJobItem): string | null {
  const min = job.budget_min_amd;
  const max = job.budget_max_amd;
  if (min != null && max != null) return `${min} – ${max} AMD`;
  if (min != null) return `From ${min} AMD`;
  if (max != null) return `Up to ${max} AMD`;
  return null;
}
function jobCredits(job: FeedJobItem): number | null {
  const c = job.response_price_credits;
  return c != null && Number.isFinite(c) ? c : null;
}

function buildFeedUrl(params: { category?: string; city?: string; search?: string; page?: number }): string {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.city) q.set("city", params.city);
  if (params.search) q.set("search", params.search);
  if (params.page != null && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `/api/feed/?${s}` : "/api/feed/";
}

export default function ProviderFeedPage() {
  const { tokens } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories: categoryOptions, cities: cityOptions } = useCategoriesAndCities();

  const category = searchParams.get("category") ?? "";
  const city = searchParams.get("city") ?? "";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [jobs, setJobs] = useState<FeedJobItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchInput, setSearchInput] = useState(search);

  const setFilters = useCallback(
    (updates: { category?: string; city?: string; search?: string; page?: number }) => {
      const p = new URLSearchParams(searchParams.toString());
      if (updates.category !== undefined) (updates.category ? p.set("category", updates.category) : p.delete("category"));
      if (updates.city !== undefined) (updates.city ? p.set("city", updates.city) : p.delete("city"));
      if (updates.search !== undefined) (updates.search ? p.set("search", updates.search) : p.delete("search"));
      if (updates.page !== undefined) (updates.page != null && updates.page > 1 ? p.set("page", String(updates.page)) : p.delete("page"));
      router.replace(`/provider/feed?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const accessToken = tokens?.access ?? null;
    if (!accessToken) {
      setLoading(false);
      setFeedError("Not authenticated.");
      return;
    }

    let cancelled = false;
    setAccessDenied(false);
    setLoading(true);

    const feed403Sentinel = { __feed403: true } as const;
    apiFetch<FeedResponse>(buildFeedUrl({ category: category || undefined, city: city || undefined, search: search || undefined, page }), {
      method: "GET",
      token: accessToken,
    })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) return feed403Sentinel as unknown as FeedResponse;
        throw err;
      })
      .then((feedData) => {
        if (cancelled) return;
        if (feedData && (feedData as unknown as { __feed403?: boolean }).__feed403) {
          setAccessDenied(true);
          setJobs([]);
          setFeedError("");
        } else {
          const list = Array.isArray((feedData as FeedResponse)?.results) ? (feedData as FeedResponse).results ?? [] : [];
          setJobs(list);
          setTotalCount((feedData as FeedResponse)?.count ?? null);
          setNextUrl((feedData as FeedResponse)?.next ?? null);
          setPrevUrl((feedData as FeedResponse)?.previous ?? null);
          setFeedError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeedError("Failed to load feed.");
          setJobs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokens?.access, category, city, search, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ search: searchInput.trim() || undefined, page: 1 });
  };

  const isEmpty = !loading && !feedError && !accessDenied && jobs.length === 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Provider Feed</h1>

          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
            <label htmlFor="provider-feed-search" className="sr-only">
              Search by keywords
            </label>
            <input
              id="provider-feed-search"
              type="search"
              placeholder="Search by keywords"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Find
            </button>
            {totalCount != null && (
              <span className="text-sm text-gray-500">Found {totalCount} task{totalCount !== 1 ? "s" : ""}</span>
            )}
          </form>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1">
              {loading && <p className="text-gray-500">Loading…</p>}

              {accessDenied && (
                <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Access denied — provider role required.
                </p>
              )}

              {feedError && !loading && (
                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{feedError}</p>
              )}

              {isEmpty && !loading && (
                <p className="text-gray-500">No open jobs right now. Try changing filters or check back later.</p>
              )}

              {!loading && !feedError && !accessDenied && jobs.length > 0 && (
                <ul className="space-y-4">
                  {jobs.map((job) => {
                    const id = job.id;
                    const title = jobTitle(job);
                    const cityVal = jobCity(job);
                    const categoryVal = jobCategory(job);
                    const budgetStr = jobBudgetRange(job);
                    const credits = jobCredits(job);

                    return (
                      <li key={id ?? title} className="rounded-md border border-gray-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h2 className="font-medium text-gray-900">{title}</h2>
                            <p className="mt-1 text-sm text-gray-500">
                              {[cityVal, categoryVal].filter(Boolean).join(" · ") || "—"}
                            </p>
                            {budgetStr && (
                              <p className="mt-0.5 text-sm text-gray-600">{budgetStr}</p>
                            )}
                            {credits != null && (
                              <p className="mt-0.5 text-xs text-gray-500">
                                {credits} credit{credits !== 1 ? "s" : ""} to respond
                              </p>
                            )}
                          </div>
                          {id != null && (
                            <Link
                              href={`/provider/respond/${id}`}
                              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              Respond
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!loading && !feedError && !accessDenied && (nextUrl || prevUrl) && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
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
                  <span className="text-sm text-gray-500">Page {page}</span>
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

            <aside className="w-full shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:w-72">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Filters</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setFilters({ category: e.target.value || undefined, page: 1 })}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All categories</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">City</label>
                  <select
                    value={city}
                    onChange={(e) => setFilters({ city: e.target.value || undefined, page: 1 })}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All cities</option>
                    {cityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {(category || city) && (
                  <button
                    type="button"
                    onClick={() => setFilters({ category: undefined, city: undefined, page: 1 })}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
  );
}
