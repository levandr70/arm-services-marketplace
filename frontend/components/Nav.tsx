"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

function LogoIcon() {
  return <span className="material-symbols-outlined text-[20px]">handyman</span>;
}

const navLinkClass = "block py-2 text-slate-600 hover:text-primary md:inline-block md:py-0";

export function Nav() {
  const { user, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  // Top main menu: Find tasks, Post a task. Client/Provider dashboards are reached from within their area.
  const navLinks = (
    <>
      <Link href="/find-tasks" className={navLinkClass} onClick={closeMenu}>Find tasks</Link>
      <Link href={user ? "/client/create" : "/login"} className={navLinkClass} onClick={closeMenu}>Post a task</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur-md lg:px-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-initial">
          <span className="shrink-0 rounded-lg bg-primary p-2 text-white">
            <LogoIcon />
          </span>
          <span className="min-w-0 text-sm font-bold leading-tight tracking-tight text-slate-900 line-clamp-2 sm:line-clamp-none sm:truncate sm:text-base md:text-xl">
            Armenia Services Marketplace
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex lg:gap-8">
          {navLinks}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {loading ? (
            <span className="text-sm text-slate-500">...</span>
          ) : user ? (
            <>
              <span className="hidden truncate max-w-[120px] text-sm text-slate-500 sm:inline lg:max-w-[180px]">{user.email}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:px-4"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:px-4">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 sm:px-5"
              >
                Join as Executor
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span className="material-symbols-outlined">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-slate-100 bg-white/95 backdrop-blur-md md:hidden">
          <div className="mx-auto max-w-7xl flex flex-col gap-1 px-4 py-4">
            {navLinks}
          </div>
        </div>
      )}
    </header>
  );
}
