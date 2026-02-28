"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ProfileResponse = {
  company_name?: string;
  description?: string;
  verification_status?: string;
  completed_jobs_count?: number;
  rating_avg?: number | null;
  credits_balance?: number;
};

function isProfileIncomplete(profile: ProfileResponse | null): boolean {
  if (!profile) return true;
  const name = (profile.company_name ?? "").trim();
  const desc = (profile.description ?? "").trim();
  return !name && !desc;
}

export default function ProviderDashboardPage() {
  const { tokens } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(() => {
    if (!tokens?.access) return Promise.resolve();
    return apiFetch<ProfileResponse>("/api/provider-profile/", {
      method: "GET",
      token: tokens.access,
    }).then((data) => setProfile(data ?? null)).catch(() => setProfile(null));
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

  const incomplete = isProfileIncomplete(profile);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>

        {loading && <p className="text-gray-500">Loading…</p>}

        {!loading && (
          <>
            {/* Profile summary card */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold text-gray-700">Your profile at a glance</h2>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="text-gray-600">
                  Verification:{" "}
                  <span
                    className={
                      (profile?.verification_status ?? "").toLowerCase() === "verified"
                        ? "font-medium text-green-700"
                        : "text-amber-700"
                    }
                  >
                    {(profile?.verification_status ?? "pending").replace("_", " ")}
                  </span>
                </span>
                <span className="text-gray-600">
                  Completed jobs: {profile?.completed_jobs_count ?? 0}
                </span>
                <span className="text-gray-600">
                  Rating: {profile?.rating_avg != null ? `${Number(profile.rating_avg).toFixed(1)} ★` : "—"}
                </span>
              </div>
            </div>

            {/* Complete your profile CTA */}
            {incomplete && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Complete your profile</p>
                <p className="mt-1 text-sm text-amber-800">
                  Add your company name and description so clients can find you.
                </p>
                <Link
                  href="/provider/profile"
                  className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  Set up profile
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
