"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-100 bg-white px-6 pb-10 pt-20 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 grid grid-cols-2 gap-12 md:grid-cols-4">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">For executors</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="/login" className="text-sm text-slate-500 transition-colors hover:text-primary">
                  Find tasks
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">Support</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="/contact" className="text-sm text-slate-500 transition-colors hover:text-primary">
                  Contact support
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">Company</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <span className="text-sm text-slate-500">About us</span>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">Legal</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <span className="text-sm text-slate-500">Terms of service</span>
              </li>
              <li>
                <span className="text-sm text-slate-500">Privacy policy</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-50 pt-10 md:flex-row">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Armenia Services Marketplace. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 transition-colors hover:text-primary" aria-label="Website">
              <span className="material-symbols-outlined">public</span>
            </a>
            <Link href="/contact" className="text-slate-400 transition-colors hover:text-primary" aria-label="Contact">
              <span className="material-symbols-outlined">chat</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
