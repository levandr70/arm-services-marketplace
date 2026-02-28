"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACTIVE_MODE_KEY = "active_mode";

type RequireAuthProps = {
  children: React.ReactNode;
  /** "any" = only require authenticated; "client" | "provider" = require that mode and capability */
  role?: "client" | "provider" | "any";
};

export function RequireAuth({ children, role = "client" }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    setActiveMode(localStorage.getItem(ACTIVE_MODE_KEY));
  }, [mounted]);

  useEffect(() => {
    if (loading || !mounted) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role === "any") return;

    const mode = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_MODE_KEY) : null;

    if (role === "client") {
      if (user.is_client !== true) {
        router.replace("/choose-role");
        return;
      }
      if (mode !== "client") {
        router.replace("/choose-role");
        return;
      }
      return;
    }

    if (role === "provider") {
      if (user.is_provider !== true) {
        router.replace("/choose-role");
        return;
      }
      if (mode !== "provider") {
        router.replace("/choose-role");
        return;
      }
    }
  }, [user, loading, role, router, mounted, activeMode]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (role === "any") {
    return <>{children}</>;
  }

  if (role === "client") {
    if (user.is_client !== true) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-gray-500">Redirecting...</p>
        </div>
      );
    }
    if (typeof window !== "undefined" && localStorage.getItem(ACTIVE_MODE_KEY) !== "client") {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-gray-500">Redirecting...</p>
        </div>
      );
    }
  }

  if (role === "provider") {
    if (user.is_provider !== true) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-gray-500">Redirecting...</p>
        </div>
      );
    }
    if (typeof window !== "undefined" && localStorage.getItem(ACTIVE_MODE_KEY) !== "provider") {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-gray-500">Redirecting...</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
