"use client";

import Link from "next/link";

export function ManifestoPage() {
  const latestIssue = {
    title: "People First Agenda",
    label: "Latest issue",
    summary:
      "A fresh update on the party’s current priorities, community delivery, and national focus areas.",
    updatedAt: "Updated today",
  };

  const focusAreas = [
    "Community service and local development",
    "Youth opportunity and skills growth",
    "Affordable access to essentials",
    "Better public accountability",
  ];

  return (
    <div className="pt-20 pb-8">
      {/* Gradient Header - Full Width */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-green-500 px-5 py-8 text-white sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">
          {latestIssue.label}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{latestIssue.title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">
          {latestIssue.summary}
        </p>
        <div className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-emerald-50">
          {latestIssue.updatedAt}
        </div>
      </div>

      {/* Content Section - Full Width */}
      <div className="px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/news"
            className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View latest issue
          </Link>
          <a
            href="#focus-areas"
            className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
          >
            See priority areas
          </a>
        </div>

        {/* Focus Areas - Full Width */}
        <div id="focus-areas" className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Current focus areas
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {focusAreas.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-600 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
