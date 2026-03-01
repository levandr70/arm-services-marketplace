"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useCategoriesAndCities } from "@/lib/categoriesCities";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** GET /api/tasks/ — PublicJobListSerializer */
type TaskListItem = {
  id?: number;
  title?: string;
  category?: string;
  city?: string;
  budget_min_amd?: number | null;
  budget_max_amd?: number | null;
  deadline_date?: string | null;
  responses_count?: number;
  created_at?: string | null;
};

/** GET /api/tasks/{id}/ — JobRequestFeedDetailSerializer */
type TaskDetail = TaskListItem & {
  description?: string;
  status?: string;
  response_price_credits?: number;
};

type TasksListResponse = {
  results?: TaskListItem[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return val;
  }
}

function budgetString(task: TaskListItem): string | null {
  const min = task.budget_min_amd;
  const max = task.budget_max_amd;
  if (min != null && max != null) return `${min} – ${max} AMD`;
  if (min != null) return `From ${min} AMD`;
  if (max != null) return `Up to ${max} AMD`;
  return null;
}

function buildTasksQuery(params: { category?: string; city?: string; search?: string; page?: number }): string {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.city) q.set("city", params.city);
  if (params.search) q.set("search", params.search);
  if (params.page != null && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `/api/tasks/?${s}` : "/api/tasks/";
}

export default function FindTasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, tokens } = useAuth();
  const { categories: categoryOptions, cities: cityOptions } = useCategoriesAndCities();

  const category = searchParams.get("category") ?? "";
  const city = searchParams.get("city") ?? "";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(search);

  const setFilters = useCallback(
    (updates: { category?: string; city?: string; search?: string; page?: number }) => {
      const p = new URLSearchParams(searchParams.toString());
      if (updates.category !== undefined) (updates.category ? p.set("category", updates.category) : p.delete("category"));
      if (updates.city !== undefined) (updates.city ? p.set("city", updates.city) : p.delete("city"));
      if (updates.search !== undefined) (updates.search ? p.set("search", updates.search) : p.delete("search"));
      if (updates.page !== undefined) (updates.page != null && updates.page > 1 ? p.set("page", String(updates.page)) : p.delete("page"));
      router.replace(`/find-tasks?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError("");
    const url = buildTasksQuery({ category: category || undefined, city: city || undefined, search: search || undefined, page });
    apiFetch<TasksListResponse>(url)
      .then((data) => {
        if (cancelled) return;
        setTasks(Array.isArray(data?.results) ? data.results : []);
        setTotalCount(data?.count ?? null);
        setNextUrl(data?.next ?? null);
        setPrevUrl(data?.previous ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setListError("Failed to load tasks.");
          setTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, city, search, page]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    apiFetch<TaskDetail>(`/api/tasks/${selectedId}/`)
      .then((data) => {
        if (!cancelled) setDetail(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleTakeTask = (taskId: number) => {
    const respondPath = `/provider/respond/${taskId}`;
    if (user?.is_provider && tokens?.access) {
      router.push(respondPath);
      setSelectedId(null);
      return;
    }
    router.push(`/login?next=${encodeURIComponent(respondPath)}`);
    setSelectedId(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ search: searchInput.trim() || undefined, page: 1 });
  };

  const isProvider = Boolean(user?.is_provider);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Find tasks</h1>
        <p className="mt-1 text-sm text-gray-500">Browse open tasks. Sign in as a provider to respond.</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="find-tasks-search" className="sr-only">
          Search by keywords
        </label>
        <input
          id="find-tasks-search"
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
        {/* Left: task list */}
        <div className="min-w-0 flex-1">
          {loading && <p className="text-gray-500">Loading…</p>}
          {listError && !loading && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</p>
          )}
          {!loading && !listError && tasks.length === 0 && (
            <p className="rounded border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500">
              No tasks match your filters. Try changing category or search.
            </p>
          )}
          {!loading && !listError && tasks.length > 0 && (
            <ul className="space-y-3">
              {tasks.map((task, index) => {
                const id = task.id;
                const title = task.title ?? "Untitled";
                const cat = task.category ?? "";
                const cityName = task.city ?? "";
                const budgetStr = budgetString(task);
                const createdStr = task.created_at ? formatDate(task.created_at) : "";
                const catLabel = categoryOptions.find((c) => c.value === cat)?.label ?? cat;
                const cityLabel = cityOptions.find((c) => c.value === cityName)?.label ?? cityName;
                const isEven = index % 2 === 0;

                return (
                  <li
                    key={id ?? `${title}-${index}`}
                    className={`cursor-pointer rounded-2xl border p-4 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      isEven ? "border-sky-100 bg-sky-50/70" : "border-gray-200 bg-white"
                    }`}
                    onClick={() => id != null && setSelectedId(id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
                          {title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 sm:text-sm">
                          {(catLabel || cityLabel) && (
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                location_on
                              </span>
                              <span>{[cityLabel, catLabel].filter(Boolean).join(" · ")}</span>
                            </span>
                          )}
                          {budgetStr && (
                            <span className="inline-flex items-center gap-1 text-gray-700">
                              <span className="material-symbols-outlined text-[16px] text-amber-500">
                                payments
                              </span>
                              <span>{budgetStr}</span>
                            </span>
                          )}
                          {createdStr && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <span className="material-symbols-outlined text-[16px]">
                                schedule
                              </span>
                              <span>{createdStr}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {task.responses_count != null && task.responses_count > 0 && (
                        <div className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                          {task.responses_count} response
                          {task.responses_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          {!loading && !listError && (nextUrl || prevUrl || (totalCount != null && totalCount > 0)) && (
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

        {/* Right: filters */}
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

      {/* Task detail modal */}
      {selectedId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 id="task-modal-title" className="text-lg font-semibold text-gray-900">
                Task details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto bg-slate-50 px-4 py-5">
              {detailLoading && <p className="text-gray-500">Loading…</p>}
              {!detailLoading && detail && (
                <div className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {detail.title ?? "Untitled"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {[
                        cityOptions.find((c) => c.value === detail.city)?.label ?? detail.city,
                        categoryOptions.find((c) => c.value === detail.category)?.label ?? detail.category,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                    {budgetString(detail) && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                        <span className="material-symbols-outlined text-[20px] text-amber-500">
                          payments
                        </span>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                            Budget
                          </div>
                          <div>{budgetString(detail)}</div>
                        </div>
                      </div>
                    )}
                    {detail.deadline_date && (
                      <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2">
                        <span className="material-symbols-outlined text-[20px] text-sky-600">
                          event
                        </span>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-sky-700">
                            Deadline
                          </div>
                          <div>{formatDate(detail.deadline_date)}</div>
                        </div>
                      </div>
                    )}
                    {detail.response_price_credits != null && detail.response_price_credits > 0 && (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:col-span-2">
                        <span className="material-symbols-outlined text-[20px] text-slate-600">
                          toll
                        </span>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-700">
                            Response cost
                          </div>
                          <div className="text-xs text-gray-600">
                            {detail.response_price_credits} credit
                            {detail.response_price_credits !== 1 ? "s" : ""} will be charged when you
                            respond to this task.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {detail.description && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold text-gray-800">What client needs</h4>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {detail.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!detailLoading && !detail && <p className="text-gray-500">Could not load task.</p>}
            </div>
            <div className="border-t border-gray-200 px-4 py-3">
              {detail && (
                <button
                  type="button"
                  onClick={() => handleTakeTask(detail.id!)}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {isProvider ? "Take this task" : "Sign in to take this task"}
                </button>
              )}
              {!isProvider && selectedId != null && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  New?{" "}
                  <Link
                    href={`/register?next=${encodeURIComponent("/provider/respond/" + selectedId)}`}
                    className="text-primary hover:underline"
                  >
                    Register as executor
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
