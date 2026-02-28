"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * POST /api/my-responses/ expects: job_id, cover_message (required), timeline_text, proposed_price_amd (optional).
 * Job details loaded from GET /api/feed/{id}/ (JobRequestFeedDetailSerializer) so providers see the job; 404 if job not in feed (e.g. assigned/cancelled).
 */

type JobDetail = {
  id?: number;
  title?: string;
  description?: string;
  category?: string;
  city?: string;
  response_price_credits?: number;
  [key: string]: unknown;
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

export default function ProviderRespondPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? String(params.id) : null;
  const jobId = id ? parseInt(id, 10) : NaN;
  const { tokens } = useAuth();

  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(true);
  const [coverMessage, setCoverMessage] = useState("");
  const [timelineText, setTimelineText] = useState("");
  const [proposedPriceAmd, setProposedPriceAmd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [bannerAmber, setBannerAmber] = useState("");
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setBannerError("");
    setBannerAmber("");
    setInsufficientCredits(false);
    setFieldErrors({});
  }, [id]);

  useEffect(() => {
    if (!id || !tokens?.access || !Number.isFinite(jobId)) {
      setJobDetailLoading(false);
      return;
    }
    let cancelled = false;
    setJobDetailLoading(true);
    apiFetch<JobDetail>(`/api/feed/${id}/`, { method: "GET", token: tokens.access })
      .then((data) => {
        if (cancelled) return;
        setJobDetail(data ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setJobDetail(null);
      })
      .finally(() => {
        if (!cancelled) setJobDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, jobId, tokens?.access]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError("");
    setBannerAmber("");
    setInsufficientCredits(false);
    setFieldErrors({});

    const messageTrimmed = coverMessage.trim();
    if (!messageTrimmed) {
      setFieldErrors({ cover_message: ["Message is required."] });
      return;
    }
    if (!Number.isFinite(jobId)) {
      setBannerError("Invalid job.");
      return;
    }
    const accessToken = tokens?.access ?? null;
    if (!accessToken) {
      setBannerError("Not authenticated.");
      return;
    }

    const payload: Record<string, unknown> = {
      job_id: jobId,
      cover_message: messageTrimmed,
    };
    if (timelineText.trim()) payload.timeline_text = timelineText.trim();
    const price = proposedPriceAmd.trim() ? parseInt(proposedPriceAmd, 10) : undefined;
    if (price != null && Number.isFinite(price) && price >= 0) payload.proposed_price_amd = price;

    setSubmitting(true);
    try {
      await apiFetch("/api/my-responses/", {
        method: "POST",
        token: accessToken,
        body: payload,
      });
      setSuccess(true);
      setTimeout(() => {
        router.replace("/provider/feed");
      }, 600);
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.message || "";
        if (/only verified providers can respond/i.test(msg)) {
          setBannerAmber(msg);
          setBannerError("");
          setInsufficientCredits(false);
        } else if (/not enough credits/i.test(msg) || err.status === 402) {
          setInsufficientCredits(true);
          setBannerError(msg || "Not enough credits.");
          setBannerAmber("");
        } else if (/already responded/i.test(msg)) {
          setBannerAmber(msg);
          setBannerError("");
          setInsufficientCredits(false);
        } else if (err.status === 400 && err.body && typeof err.body === "object") {
          setFieldErrors(fieldErrorsToMessages(err.body as Record<string, unknown>));
          setBannerError("");
          setBannerAmber("");
        } else {
          setBannerError(msg || `Request failed (${err.status ?? ""}).`);
          setBannerAmber("");
        }
      } else {
        setBannerError("Request failed.");
        setBannerAmber("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldError = (name: string) => fieldErrors[name];

  const title = jobDetail?.title ?? null;
  const city = jobDetail?.city ?? null;
  const category = jobDetail?.category ?? null;
  const description = jobDetail?.description ?? null;
  const costCredits = jobDetail?.response_price_credits != null && Number.isFinite(jobDetail.response_price_credits)
    ? jobDetail.response_price_credits
    : null;

  if (!id) {
    return (
      <RequireAuth role="provider">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-red-600">Invalid job.</p>
          <Link href="/provider/feed" className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900">
            ← Back to Feed
          </Link>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth role="provider">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <Link
            href="/provider/feed"
            className="inline-block text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to Feed
          </Link>

          <h1 className="text-2xl font-semibold text-gray-900">Respond to Job</h1>

          {jobDetailLoading && (
            <p className="text-gray-500">Loading job…</p>
          )}

          {!jobDetailLoading && (title != null || city != null || category != null || description != null || costCredits != null) && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              {title != null && title !== "" && (
                <h2 className="font-medium text-gray-900">{title}</h2>
              )}
              {(city != null && city !== "") || (category != null && category !== "") ? (
                <p className="mt-1 text-sm text-gray-600">
                  {[city, category].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {costCredits != null && (
                <p className="mt-1 text-sm text-gray-700">
                  Cost to respond: <strong>{costCredits}</strong> credit{costCredits !== 1 ? "s" : ""}
                </p>
              )}
              {description != null && description !== "" && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-500">Description</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{description}</p>
                </div>
              )}
            </div>
          )}

          {!jobDetailLoading && jobDetail == null && (
            <p className="text-gray-500">Job not found or no longer available.</p>
          )}

          {success && (
            <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
              Response sent. Redirecting to feed…
            </div>
          )}

          {bannerAmber && (
            <div className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {bannerAmber}
            </div>
          )}

          {bannerError && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {bannerError}
              {insufficientCredits && (
                <span className="ml-2">
                  <Link href="/provider/credits" className="font-medium underline hover:no-underline">
                    Go to Credits
                  </Link>
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="cover_message" className="mb-1 block text-sm font-medium text-gray-700">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="cover_message"
                rows={5}
                required
                value={coverMessage}
                onChange={(e) => setCoverMessage(e.target.value)}
                disabled={submitting || success}
                placeholder="Introduce yourself and your offer…"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              {getFieldError("cover_message")?.length ? (
                <p className="mt-1 text-sm text-red-600">{getFieldError("cover_message").join(" ")}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="timeline_text" className="mb-1 block text-sm font-medium text-gray-700">
                Timeline (optional)
              </label>
              <input
                id="timeline_text"
                type="text"
                value={timelineText}
                onChange={(e) => setTimelineText(e.target.value)}
                disabled={submitting || success}
                placeholder="e.g. 2–3 days"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              {getFieldError("timeline_text")?.length ? (
                <p className="mt-1 text-sm text-red-600">{getFieldError("timeline_text").join(" ")}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="proposed_price_amd" className="mb-1 block text-sm font-medium text-gray-700">
                Proposed price (AMD, optional)
              </label>
              <input
                id="proposed_price_amd"
                type="number"
                min={0}
                value={proposedPriceAmd}
                onChange={(e) => setProposedPriceAmd(e.target.value)}
                disabled={submitting || success}
                placeholder="e.g. 15000"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              {getFieldError("proposed_price_amd")?.length ? (
                <p className="mt-1 text-sm text-red-600">{getFieldError("proposed_price_amd").join(" ")}</p>
              ) : null}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || success}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send Response"}
              </button>
              <Link
                href="/provider/feed"
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
