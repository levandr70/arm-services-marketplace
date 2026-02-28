"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { useCategories } from "@/lib/categoriesCities";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PortfolioItem = { url?: string; title?: string };

type ProviderProfilePayload = {
  company_name?: string;
  description?: string;
  tags?: string[];
  portfolio?: PortfolioItem[];
  verification_status?: string;
  completed_jobs_count?: number;
  rating_avg?: number | null;
  credits_balance?: number;
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

export default function ProviderProfilePage() {
  const { tokens } = useAuth();
  const { categories: categoryOptions } = useCategories();
  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const fetchProfile = useCallback(() => {
    if (!tokens?.access) return Promise.resolve();
    return apiFetch<ProviderProfilePayload>("/api/provider-profile/", {
      method: "GET",
      token: tokens.access,
    })
      .then((data) => {
        setProfile(data ?? null);
        setCompanyName(data?.company_name ?? "");
        setDescription(data?.description ?? "");
        setTags(Array.isArray(data?.tags) ? data.tags : []);
        setPortfolio(Array.isArray(data?.portfolio) ? data.portfolio : []);
      })
      .catch(() => setProfile(null));
  }, [tokens?.access]);

  useEffect(() => {
    if (!tokens?.access) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchProfile().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tokens?.access, fetchProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");
    setFieldErrors({});
    if (!tokens?.access) return;
    setSubmitting(true);
    try {
      const body = {
        company_name: companyName.trim() || "",
        description: description.trim() || "",
        tags,
        portfolio: portfolio.filter((p) => (p.url ?? "").trim() || (p.title ?? "").trim()),
      };
      const isCreate = !profile?.company_name && !profile?.description;
      await apiFetch("/api/provider-profile/", {
        method: isCreate ? "POST" : "PATCH",
        token: tokens.access,
        body,
      });
      setSuccessMessage(isCreate ? "Profile created." : "Profile saved.");
      fetchProfile();
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        setFieldErrors(fieldErrorsToMessages(err.body as Record<string, unknown>));
        setErrorMessage("");
      } else {
        setErrorMessage(err instanceof ApiError ? err.message : "Failed to save profile.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (value: string) => {
    setTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const addPortfolioItem = () => {
    setPortfolio((prev) => [...prev, { url: "", title: "" }]);
  };

  const updatePortfolioItem = (index: number, field: "url" | "title", value: string) => {
    setPortfolio((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removePortfolioItem = (index: number) => {
    setPortfolio((prev) => prev.filter((_, i) => i !== index));
  };

  const getFieldError = (name: string) => fieldErrors[name];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">
            {profile && (companyName.trim() || description.trim()) ? "My Profile" : "Create your profile"}
          </h1>

          {!loading && !(companyName.trim() || description.trim()) && (
            <p className="text-sm text-gray-600">
              Create your executor profile so clients can find you. Add your company name, description, and service categories.
            </p>
          )}

          {loading && <p className="text-gray-500">Loading…</p>}

          {!loading && (
            <>
              {profile && (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <p>
                    Verification: <strong>{profile.verification_status ?? "—"}</strong>
                    {profile.completed_jobs_count != null && (
                      <> · Completed jobs: {profile.completed_jobs_count}</>
                    )}
                    {profile.rating_avg != null && (
                      <> · Rating: {profile.rating_avg.toFixed(1)}</>
                    )}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {successMessage && (
                  <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{successMessage}</p>
                )}
                {errorMessage && (
                  <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
                )}

                <div>
                  <label htmlFor="company_name" className="mb-1 block text-sm font-medium text-gray-700">
                    Company / display name
                  </label>
                  <input
                    id="company_name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {getFieldError("company_name")?.length ? (
                    <p className="mt-1 text-sm text-red-600">{getFieldError("company_name").join(" ")}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
                    Bio / description
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                    placeholder="Introduce yourself and your services…"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {getFieldError("description")?.length ? (
                    <p className="mt-1 text-sm text-red-600">{getFieldError("description").join(" ")}</p>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 block text-sm font-medium text-gray-700">Service categories</p>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleTag(opt.value)}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          tags.includes(opt.value)
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Portfolio (links)</p>
                    <button
                      type="button"
                      onClick={addPortfolioItem}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Add link
                    </button>
                  </div>
                  {portfolio.length === 0 && (
                    <p className="text-sm text-gray-500">No portfolio links yet.</p>
                  )}
                  {portfolio.map((item, index) => (
                    <div key={index} className="mb-3 flex flex-wrap gap-2 rounded border border-gray-200 p-2">
                      <input
                        type="url"
                        placeholder="URL"
                        value={item.url ?? ""}
                        onChange={(e) => updatePortfolioItem(index, "url", e.target.value)}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Title"
                        value={item.title ?? ""}
                        onChange={(e) => updatePortfolioItem(index, "title", e.target.value)}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removePortfolioItem(index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Save profile"}
                  </button>
                  <Link
                    href="/provider"
                    className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
  );
}
