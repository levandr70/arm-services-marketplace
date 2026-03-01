"use client";

import { apiFetch } from "@/lib/api";
import { useCategories } from "@/lib/categoriesCities";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ReviewListItem = {
  id?: number;
  taskTitle?: string;
  rating?: number;
  comment?: string;
  created_at?: string | null;
  executorName?: string;
  completedTasks?: number;
};

type ReviewsResponse = {
  results?: ReviewListItem[];
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

export default function ReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories: categoryOptions } = useCategories();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const minRating = searchParams.get("min_rating") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(search);
  const [categoryInput, setCategoryInput] = useState(category);
  const [ratingInput, setRatingInput] = useState(minRating);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (minRating) params.set("min_rating", minRating);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    const url = query ? `/api/reviews/?${query}` : "/api/reviews/";

    apiFetch<ReviewsResponse>(url)
      .then((data) => {
        if (cancelled) return;
        setReviews(Array.isArray(data?.results) ? data.results : []);
        setTotalCount(data?.count ?? null);
        setNextUrl(data?.next ?? null);
        setPrevUrl(data?.previous ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load reviews.");
          setReviews([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, category, minRating, page]);

  const setFilters = (updates: { search?: string; category?: string; min_rating?: string; page?: number }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (updates.search !== undefined) {
      updates.search ? p.set("search", updates.search) : p.delete("search");
    }
    if (updates.category !== undefined) {
      updates.category ? p.set("category", updates.category) : p.delete("category");
    }
    if (updates.min_rating !== undefined) {
      updates.min_rating ? p.set("min_rating", updates.min_rating) : p.delete("min_rating");
    }
    if (updates.page !== undefined) {
      updates.page != null && updates.page > 1 ? p.set("page", String(updates.page)) : p.delete("page");
    }
    const q = p.toString();
    router.replace(q ? `/reviews?${q}` : "/reviews", { scroll: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      search: searchInput.trim() || undefined,
      category: categoryInput || undefined,
      min_rating: ratingInput || undefined,
      page: 1,
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reviews about executors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Read what clients say about their executors. Use search to find reviews by executor name.
          </p>
        </div>
        <Link
          href="/find-tasks"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back to Find tasks
        </Link>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
        <label htmlFor="reviews-search" className="sr-only">
          Search by executor name or email
        </label>
        <input
          id="reviews-search"
          type="search"
          placeholder="Search by executor name or email"
          autoComplete="off"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={categoryInput}
          onChange={(e) => setCategoryInput(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-52"
        >
          <option value="">All categories</option>
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={ratingInput}
          onChange={(e) => setRatingInput(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-40"
        >
          <option value="">All ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4+ stars</option>
          <option value="3">3+ stars</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Apply
        </button>
        {totalCount != null && (
          <span className="text-sm text-gray-500">
            {totalCount} review{totalCount !== 1 ? "s" : ""} found
          </span>
        )}
      </form>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && !loading && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && reviews.length === 0 && (
        <p className="rounded border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500">
          No reviews match your search yet.
        </p>
      )}

      {!loading && !error && reviews.length > 0 && (
        <ul className="space-y-3">
          {reviews.map((rev) => (
            <li
              key={rev.id ?? `${rev.executorName}-${rev.taskTitle}-${rev.created_at}`}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
                    {rev.taskTitle ?? "Task"}
                  </h2>
                  {rev.executorName && (
                    <p className="mt-0.5 text-xs text-gray-600 sm:text-sm">
                      Executor: <span className="font-medium">{rev.executorName}</span>
                      {typeof rev.completedTasks === "number" && rev.completedTasks > 0 && (
                        <span className="text-xs text-gray-400">
                          {" "}
                          · {rev.completedTasks} completed task{rev.completedTasks !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  )}
                  {rev.created_at && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDate(rev.created_at)}
                    </p>
                  )}
                </div>
                {typeof rev.rating === "number" && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    <span className="material-symbols-outlined text-[18px] text-amber-500">
                      star
                    </span>
                    <span>{rev.rating.toFixed(1)} / 5</span>
                  </div>
                )}
              </div>
              {rev.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{rev.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && (nextUrl || prevUrl || (totalCount != null && totalCount > 0)) && (
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
  );
}

