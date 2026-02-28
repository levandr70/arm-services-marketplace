"use client";

import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

type ReviewCard = {
  taskTitle: string;
  foundIn: string;
  price: string;
  review: string;
  date: string;
  executorName: string;
  rating: number;
  completedTasks: number;
};

const FALLBACK_REVIEWS: ReviewCard[] = [
  {
    taskTitle: "Plumbing repair",
    foundIn: "Found in 15 mins",
    price: "15,000 AMD",
    review:
      "Fast and professional service. The leaking pipe was fixed within an hour of the call. Highly recommended for urgent fixes.",
    date: "Jan 2025",
    executorName: "Alex M.",
    rating: 5,
    completedTasks: 42,
  },
  {
    taskTitle: "Apartment cleaning",
    foundIn: "Found in 1 hour",
    price: "8,000 AMD",
    review:
      "Very thorough cleaning. Every corner was sparkling. Maria was very polite and organized.",
    date: "Jan 2025",
    executorName: "Maria K.",
    rating: 5,
    completedTasks: 128,
  },
  {
    taskTitle: "Furniture assembly",
    foundIn: "Found in 30 mins",
    price: "12,000 AMD",
    review:
      "Assembled correctly and quickly. Brought all the necessary tools. Very satisfied with the David's work.",
    date: "Dec 2024",
    executorName: "David S.",
    rating: 4.9,
    completedTasks: 89,
  },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewCard[]>(FALLBACK_REVIEWS);

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/choose-role");
  }, [user, loading, router]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ReviewCard[]>("/api/public-reviews/")
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setReviews(data);
        }
      })
      .catch(() => {
        // keep fallback reviews on error
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-8">
      {/* Hero */}
      <section className="relative min-h-[42vh] overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[50vh] lg:py-20 lg:px-20">
        <Image
          src="/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/40 to-white/80" />
        <div className="relative z-10 mx-auto flex min-h-[38vh] max-w-4xl flex-col items-center justify-center text-center lg:min-h-[44vh]">
          <h1 className="mb-4 text-4xl font-black tracking-tight text-slate-900 sm:mb-6 sm:text-5xl lg:text-7xl">
            We take care of <span className="text-primary">the hassle</span>
          </h1>
          <p className="mb-8 max-w-2xl text-base text-slate-600 sm:mb-10 sm:text-lg lg:text-xl">
            Find a reliable executor for any task across Armenia. From plumbing to professional consulting.
          </p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-100 px-4 py-10 sm:px-6 sm:py-16 lg:px-20">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
          <div className="text-center">
            <div className="mb-1 text-3xl font-black text-primary sm:text-4xl">6+</div>
            <div className="text-sm font-bold text-slate-900">Service categories</div>
          </div>
          <div className="text-center">
            <div className="mb-1 text-4xl font-black text-primary">Armenia</div>
            <div className="text-sm font-bold text-slate-900">Clients and executors across regions</div>
          </div>
          <div className="text-center">
            <div className="mb-1 text-3xl font-black text-primary sm:text-4xl">Verified</div>
            <div className="text-sm font-bold text-slate-900">Ratings and badges for executors</div>
          </div>
          <div className="text-center">
            <div className="mb-1 text-3xl font-black text-primary sm:text-4xl">Secure</div>
            <div className="text-sm font-bold text-slate-900">Safe payment and trusted deals</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-black text-slate-900 sm:mb-4 sm:text-3xl lg:text-4xl">How does it work?</h2>
            <p className="mx-auto max-w-xl text-slate-500">
              You choose only among interested executors by reviews, prices and work samples
            </p>
          </div>
          <div className="mb-10 grid gap-8 sm:mb-16 sm:gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative flex flex-col items-center rounded-2xl bg-slate-50 p-8 text-center">
              <div className="absolute -top-6 flex size-12 items-center justify-center rounded-full bg-primary text-xl font-black text-white shadow-lg">
                1
              </div>
              <h3 className="mt-4 mb-3 text-lg font-bold text-slate-900">Clients post a job (free)</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Describe what you need, choose category and city. Your job appears in the provider feed.
              </p>
            </div>
            <div className="relative flex flex-col items-center rounded-2xl bg-slate-50 p-8 text-center">
              <div className="absolute -top-6 flex size-12 items-center justify-center rounded-full bg-primary text-xl font-black text-white shadow-lg">
                2
              </div>
              <h3 className="mt-4 mb-3 text-lg font-bold text-slate-900">Providers pay credits to respond</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Each response costs a small number of credits. Providers submit their offer, price, and timeline.
              </p>
            </div>
            <div className="relative flex flex-col items-center rounded-2xl bg-slate-50 p-8 text-center">
              <div className="absolute -top-6 flex size-12 items-center justify-center rounded-full bg-primary text-xl font-black text-white shadow-lg">
                3
              </div>
              <h3 className="mt-4 mb-3 text-lg font-bold text-slate-900">Client accepts or rejects</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                You choose the provider you prefer. Once accepted, the job is assigned to them.
              </p>
            </div>
            <div className="relative flex flex-col items-center rounded-2xl bg-slate-50 p-8 text-center">
              <div className="absolute -top-6 flex size-12 items-center justify-center rounded-full bg-primary text-xl font-black text-white shadow-lg">
                4
              </div>
              <h3 className="mt-4 mb-3 text-lg font-bold text-slate-900">Contact and complete the work</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                After acceptance, client and provider can contact each other. You coordinate and complete the work outside the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 flex items-center gap-3 text-2xl font-black text-slate-900 sm:mb-12 sm:text-3xl">
            <span className="material-symbols-outlined scale-125 text-primary">star</span>
            Reviews about executors
          </h2>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
            {reviews.map((card, i) => (
              <article
                key={i}
                className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{card.taskTitle}</h3>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {card.foundIn}
                    </span>
                  </div>
                  <div className="text-right font-black text-primary">{card.price}</div>
                </div>
                <p className="mb-6 flex-grow text-sm italic text-slate-600">&quot;{card.review}&quot;</p>
                <div className="flex items-center gap-4 border-t border-slate-50 pt-6">
                  <div className="flex size-10 items-center justify-center rounded-full bg-slate-100">
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{card.executorName}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span className="font-bold text-amber-500">Rating: {card.rating}</span>
                      <span>•</span>
                      <span>{card.date}</span>
                      <span>•</span>
                      <span>{card.completedTasks} tasks</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
