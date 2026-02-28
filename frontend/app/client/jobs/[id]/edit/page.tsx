"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { useCategoriesAndCities } from "@/lib/categoriesCities";
import { VISIBILITY_OPTIONS } from "@/lib/jobFormOptions";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** Shape from backend JobRequestDetailSerializer (for GET prefill). response_price_credits not editable by client. */
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
};

function fieldErrorsToMessages(body: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value)) {
      out[key] = value.map((v) => (typeof v === "string" ? v : String(v)));
    } else if (typeof value === "string") {
      out[key] = [value];
    }
  }
  return out;
}

/** Build PATCH payload: only keys the backend allows for client. response_price_credits is not included. */
function buildPatchPayload(opts: {
  title: string;
  description: string;
  category: string;
  city: string;
  budgetMinAmd: string;
  budgetMaxAmd: string;
  deadlineDate: string;
  visibility: string;
}): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    title: opts.title.trim(),
    description: opts.description.trim(),
    category: opts.category.trim() || "other",
    city: opts.city.trim() || "other",
    visibility: opts.visibility.trim() || "public",
  };
  const minN = opts.budgetMinAmd.trim() ? parseInt(opts.budgetMinAmd, 10) : NaN;
  if (Number.isFinite(minN) && minN >= 0) payload.budget_min_amd = minN;
  const maxN = opts.budgetMaxAmd.trim() ? parseInt(opts.budgetMaxAmd, 10) : NaN;
  if (Number.isFinite(maxN) && maxN >= 0) payload.budget_max_amd = maxN;
  const date = opts.deadlineDate.trim();
  if (date) payload.deadline_date = date;
  return payload;
}

export default function ClientJobEditPage() {
  const params = useParams();
  const id = params?.id != null ? String(params.id) : null;
  const router = useRouter();
  const { tokens } = useAuth();
  const { categories: categoryOptions, cities: cityOptions } = useCategoriesAndCities();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [city, setCity] = useState("other");
  const [budgetMinAmd, setBudgetMinAmd] = useState("");
  const [budgetMaxAmd, setBudgetMaxAmd] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const fetchJob = useCallback(() => {
    if (!id || !tokens?.access) return Promise.resolve();
    return apiFetch<JobDetail>(`/api/jobs/${id}/`, { method: "GET", token: tokens.access })
      .then((data) => {
        if (data) {
          setTitle(data.title ?? "");
          setDescription(data.description ?? "");
          setCategory((data.category ?? "").trim() || "other");
          setCity((data.city ?? "").trim() || "other");
          setBudgetMinAmd(
            data.budget_min_amd != null && Number.isFinite(data.budget_min_amd)
              ? String(data.budget_min_amd)
              : ""
          );
          setBudgetMaxAmd(
            data.budget_max_amd != null && Number.isFinite(data.budget_max_amd)
              ? String(data.budget_max_amd)
              : ""
          );
          setDeadlineDate(data.deadline_date ?? "");
          setVisibility((data.visibility ?? "public").trim() || "public");
        }
        setLoadError("");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setLoadError("Job not found.");
        } else if (err instanceof ApiError && err.status === 403) {
          setLoadError("You don't have permission to edit this job.");
        } else {
          setLoadError("Failed to load job.");
        }
      });
  }, [id, tokens?.access]);

  useEffect(() => {
    if (!id || !tokens?.access) {
      setLoading(false);
      if (!tokens?.access) setLoadError("Not authenticated.");
      else if (!id) setLoadError("Invalid job.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchJob().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, tokens?.access, fetchJob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    setServerError("");
    setFieldErrors({});

    const titleTrimmed = title.trim();
    const descriptionTrimmed = description.trim();

    if (!titleTrimmed) {
      setValidationError("Title is required.");
      return;
    }
    if (!descriptionTrimmed) {
      setValidationError("Description is required.");
      return;
    }

    const accessToken = tokens?.access ?? null;
    if (!accessToken || !id) {
      setServerError("Not authenticated or invalid job.");
      return;
    }

    const body = buildPatchPayload({
      title: titleTrimmed,
      description: descriptionTrimmed,
      category,
      city,
      budgetMinAmd,
      budgetMaxAmd,
      deadlineDate,
      visibility,
    });

    setSubmitting(true);
    try {
      await apiFetch(`/api/jobs/${id}/`, {
        method: "PATCH",
        token: accessToken,
        body,
      });
      router.replace(`/client/jobs/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.body && typeof err.body === "object" && err.body !== null) {
          setFieldErrors(fieldErrorsToMessages(err.body as Record<string, unknown>));
          setServerError("");
        } else {
          setFieldErrors({});
          const msg = err.status != null ? `(${err.status}) ${err.message}` : err.message;
          setServerError(msg);
        }
      } else {
        setFieldErrors({});
        setServerError("Server error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldError = (name: string) => fieldErrors[name];
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

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
          <div className="flex items-center gap-4">
            <Link
              href={`/client/jobs/${id}`}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to Job
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Edit Job</h1>

          {loading && <p className="text-gray-500">Loading…</p>}

          {loadError && !loading && (
            <>
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
              <Link href="/client/jobs" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
                ← Back to My Jobs
              </Link>
            </>
          )}

          {!loading && !loadError && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {validationError && (
                <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{validationError}</p>
              )}
              {serverError && (
                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
              )}
              {hasFieldErrors && (
                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">Please fix the errors below.</p>
              )}

              <div>
                <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                {getFieldError("title")?.length ? (
                  <p className="mt-1 text-sm text-red-600">{getFieldError("title").join(" ")}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                {getFieldError("description")?.length ? (
                  <p className="mt-1 text-sm text-red-600">{getFieldError("description").join(" ")}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {getFieldError("category")?.length ? (
                  <p className="mt-1 text-sm text-red-600">{getFieldError("category").join(" ")}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
                  City
                </label>
                <select
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  {cityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {getFieldError("city")?.length ? (
                  <p className="mt-1 text-sm text-red-600">{getFieldError("city").join(" ")}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="budget_min_amd" className="mb-1 block text-sm font-medium text-gray-700">
                    Budget min (AMD)
                  </label>
                  <input
                    id="budget_min_amd"
                    type="number"
                    min={0}
                    value={budgetMinAmd}
                    onChange={(e) => setBudgetMinAmd(e.target.value)}
                    disabled={submitting}
                    placeholder="Optional"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {getFieldError("budget_min_amd")?.length ? (
                    <p className="mt-1 text-sm text-red-600">{getFieldError("budget_min_amd").join(" ")}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="budget_max_amd" className="mb-1 block text-sm font-medium text-gray-700">
                    Budget max (AMD)
                  </label>
                  <input
                    id="budget_max_amd"
                    type="number"
                    min={0}
                    value={budgetMaxAmd}
                    onChange={(e) => setBudgetMaxAmd(e.target.value)}
                    disabled={submitting}
                    placeholder="Optional"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {getFieldError("budget_max_amd")?.length ? (
                    <p className="mt-1 text-sm text-red-600">{getFieldError("budget_max_amd").join(" ")}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <label htmlFor="deadline_date" className="mb-1 block text-sm font-medium text-gray-700">
                  Deadline date
                </label>
                <input
                  id="deadline_date"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                {getFieldError("deadline_date")?.length ? (
                  <p className="mt-1 text-sm text-red-600">{getFieldError("deadline_date").join(" ")}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="visibility" className="mb-1 block text-sm font-medium text-gray-700">
                  Visibility
                </label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {getFieldError("visibility")?.length ? (
                  <p className="mt-1 text-sm text-red-600">{getFieldError("visibility").join(" ")}</p>
                ) : null}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <Link
                  href={`/client/jobs/${id}`}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
