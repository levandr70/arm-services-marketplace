"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CreditsResponse = { credits_balance?: number };

const TABS = [
  { href: "/provider", label: "Overview", match: (path: string) => path === "/provider" },
  { href: "/provider/feed", label: "Feed", match: (path: string) => path.startsWith("/provider/feed") },
  { href: "/provider/my-responses", label: "My Responses", match: (path: string) => path.startsWith("/provider/my-responses") },
  { href: "/provider/credits", label: "Credits", match: (path: string) => path.startsWith("/provider/credits") },
  { href: "/provider/profile", label: "My Profile", match: (path: string) => path.startsWith("/provider/profile") },
] as const;

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { tokens } = useAuth();
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  const fetchCredits = useCallback(() => {
    if (!tokens?.access) return Promise.resolve();
    return apiFetch<CreditsResponse>("/api/credits/", { method: "GET", token: tokens.access }).then(
      (data) => {
        const n = data?.credits_balance;
        setCreditsBalance(n != null && Number.isFinite(n) ? n : null);
      }
    );
  }, [tokens?.access]);

  useEffect(() => {
    if (!tokens?.access) return;
    let cancelled = false;
    fetchCredits().catch(() => {
      if (!cancelled) setCreditsBalance(null);
    });
    return () => {
      cancelled = true;
    };
  }, [tokens?.access, fetchCredits]);

  return (
    <RequireAuth role="provider">
      <div className="space-y-0">
        {/* Sticky tab bar */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <nav className="flex flex-wrap items-center gap-1" aria-label="Provider dashboard tabs">
              {TABS.map((tab) => {
                const isActive = tab.match(pathname ?? "");
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/provider/credits"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Credits: {creditsBalance != null ? creditsBalance : "—"}
              </Link>
              <Link href="/choose-role" className="text-sm text-gray-500 hover:text-gray-700">
                Switch mode
              </Link>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
