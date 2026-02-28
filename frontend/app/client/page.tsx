"use client";

import { RequireAuth } from "@/components/RequireAuth";
import Link from "next/link";

export default function ClientDashboardPage() {
  return (
    <RequireAuth role="client">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Client Dashboard</h1>
            <Link href="/choose-role" className="text-sm text-gray-500 hover:text-gray-700">
              Switch mode
            </Link>
          </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/client/create"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create New Job
          </Link>
          <Link
            href="/client/jobs"
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            My Jobs
          </Link>
        </div>
        </div>
      </div>
    </RequireAuth>
  );
}
