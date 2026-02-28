"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { useCategoriesAndCities } from "@/lib/categoriesCities";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

/** Backend JobRequestCreateSerializer: title, description (required); category, city (choice keys), budget_*, deadline_date, response_price_credits (optional).
 * For moderation: visibility not sent — backend defaults to PUBLIC, but jobs are only shown to providers/visitors after admin approval.
 */

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

/** Build payload with exactly the keys the backend expects. Omit optional fields when empty; never send empty strings. */
function buildJobsPayload(opts: {
  title: string;
  description: string;
  category: string;
  city: string;
  budgetMinAmd: string;
  budgetMaxAmd: string;
  deadlineDate: string;
  responsePriceCredits?: string;
}): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    title: opts.title.trim(),
    description: opts.description.trim(),
  };
  const cat = opts.category.trim();
  payload.category = cat || "other";
  const cityVal = opts.city.trim();
  payload.city = cityVal || "other";
  const minN = opts.budgetMinAmd.trim() ? parseInt(opts.budgetMinAmd, 10) : NaN;
  if (Number.isFinite(minN) && minN >= 0) payload.budget_min_amd = minN;
  const maxN = opts.budgetMaxAmd.trim() ? parseInt(opts.budgetMaxAmd, 10) : NaN;
  if (Number.isFinite(maxN) && maxN >= 0) payload.budget_max_amd = maxN;
  const date = opts.deadlineDate.trim();
  if (date) payload.deadline_date = date;
  // MVP: do not send visibility — backend defaults to PUBLIC; verified_only postponed
  const credits = opts.responsePriceCredits?.trim();
  if (credits) {
    const n = parseInt(credits, 10);
    if (Number.isFinite(n) && n >= 0) payload.response_price_credits = n;
  }
  return payload;
}

/** Minimal job shape for duplicate prefill (GET /api/jobs/{id}/) */
interface JobForDuplicate {
  id?: number;
  title?: string;
  description?: string;
  category?: string;
  city?: string;
  budget_min_amd?: number | null;
  budget_max_amd?: number | null;
  deadline_date?: string | null;
}

export default function CreateJobPage() {
  const { tokens } = useAuth();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const { categories: categoryOptions, cities: cityOptions } = useCategoriesAndCities();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [city, setCity] = useState("other");
  const [budgetMinAmd, setBudgetMinAmd] = useState("");
  const [budgetMaxAmd, setBudgetMaxAmd] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [duplicatedFromId, setDuplicatedFromId] = useState<number | null>(null);
  const [duplicateLoadError, setDuplicateLoadError] = useState("");

  useEffect(() => {
    if (!duplicateId || !tokens?.access) return;
    const id = parseInt(duplicateId, 10);
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    setDuplicateLoadError("");
    apiFetch<JobForDuplicate>(`/api/jobs/${id}/`, { token: tokens.access })
      .then((job) => {
        if (cancelled) return;
        const origTitle = (job.title ?? "").trim() || "Untitled";
        setTitle(origTitle.startsWith("Copy of ") ? origTitle : `Copy of ${origTitle}`);
        setDescription((job.description ?? "").trim());
        setCategory((job.category ?? "").trim() || "other");
        setCity((job.city ?? "").trim() || "other");
        setBudgetMinAmd(job.budget_min_amd != null && Number.isFinite(job.budget_min_amd) ? String(job.budget_min_amd) : "");
        setBudgetMaxAmd(job.budget_max_amd != null && Number.isFinite(job.budget_max_amd) ? String(job.budget_max_amd) : "");
        setDeadlineDate((job.deadline_date ?? "").trim());
        setDuplicatedFromId(job.id ?? id);
      })
      .catch(() => {
        if (!cancelled) setDuplicateLoadError("Could not load job to duplicate.");
      });
    return () => {
      cancelled = true;
    };
  }, [duplicateId, tokens?.access]);

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
    if (!accessToken) {
      setServerError("Not authenticated. Please log in again.");
      return;
    }

    const body = buildJobsPayload({
      title: titleTrimmed,
      description: descriptionTrimmed,
      category,
      city,
      budgetMinAmd,
      budgetMaxAmd,
      deadlineDate,
    });

    setSubmitting(true);
    try {
      await apiFetch("/api/jobs/", {
        method: "POST",
        token: accessToken,
        body,
      });
      setSuccessMessage("Job submitted for admin review. You will see it in the public list after approval.");
      setTimeout(() => {
        router.replace("/client/jobs");
      }, 500);
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

  return (
    <RequireAuth role="client">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link
              href="/client"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Create New Job</h1>

          {duplicatedFromId != null && (
            <p className="text-sm text-gray-600">
              Duplicated from job #{duplicatedFromId}. Edit and publish to create a new job.
            </p>
          )}
          {duplicateLoadError && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{duplicateLoadError}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {validationError && (
              <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {validationError}
              </p>
            )}
            {successMessage && (
              <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
                {successMessage}
              </p>
            )}
            {serverError && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </p>
            )}
            {hasFieldErrors && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                Please fix the errors below.
              </p>
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

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
              <Link
                href="/client"
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </RequireAuth>
  );
}
