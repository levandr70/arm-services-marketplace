"use client";

import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Allow redirect only to same-origin paths (start with /, not //). */
function isSafeNext(next: string | null): boolean {
  if (!next || typeof next !== "string") return false;
  const t = next.trim();
  return t.startsWith("/") && !t.startsWith("//");
}

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (loading || !user) return;
    const destination = isSafeNext(nextParam) ? nextParam! : "/choose-role";
    router.replace(destination);
  }, [loading, user, router, nextParam]);

  if (!loading && user) {
    return (
      <div className="py-12 text-center text-gray-500">Redirecting...</div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-gray-900 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link
          href={nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : "/register"}
          className="font-medium text-gray-900 underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
