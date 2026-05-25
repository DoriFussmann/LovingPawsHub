"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface RecentArticle {
  id: string;
  article_id: string;
  h1_title: string;
  content_type: string;
  core_id: string;
  bridge_id: string;
  slug: string;
}

interface HeroSectionProps {
  recentArticles: RecentArticle[];
  siteName?: string;
  industryName?: string;
  headline?: string;
  subheadline?: string;
  bodyText?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  HUB: "hub",
  FAQ: "faq",
  COMPARISON: "comparison",
  RISK: "risk",
  GUIDE: "guide",
  CORE: "core",
};

const FALLBACK_ROWS = [
  { label: "hub", title: "the complete guide to [your topic]" },
  { label: "guide", title: "how to get started with [your topic]" },
  { label: "comparison", title: "top options compared: [your topic]" },
  { label: "faq", title: "frequently asked questions about [your topic]" },
  { label: "risk", title: "common mistakes to avoid with [your topic]" },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function HeroSection({
  recentArticles,
  siteName: siteNameProp,
  industryName: industryNameProp,
  headline: headlineProp,
  subheadline: subheadlineProp,
  bodyText: bodyTextProp,
  ctaPrimary: ctaPrimaryProp,
  ctaSecondary: ctaSecondaryProp,
}: HeroSectionProps) {
  const industryName = (industryNameProp || "your industry").toLowerCase();
  const siteName = (siteNameProp || "").toLowerCase();
  const headline = (headlineProp || siteName).toLowerCase();
  const subheadline = subheadlineProp || "expert resources,\nClearly explained.";
  const bodyText =
    bodyTextProp ||
    `in-depth guides, comparisons, and analysis covering everything you need to navigate ${industryName}. written for clarity, optimised for depth.`;
  const ctaPrimary = ctaPrimaryProp || "read the guide";
  const ctaSecondary = ctaSecondaryProp || "browse articles";

  const previewRows =
    recentArticles.length > 0
      ? recentArticles.map((a) => ({
          label: CONTENT_TYPE_LABELS[a.content_type] ?? a.content_type.toLowerCase(),
          title: a.h1_title.toLowerCase(),
          href: `/${a.core_id}/${a.bridge_id}/${a.slug}`,
        }))
      : FALLBACK_ROWS.map((r) => ({ ...r, href: "/articles" }));

  return (
    <section className="flex items-start pt-24 pb-20 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* ── Left column ── */}
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease }}
          >
            <p className="text-[10px] tracking-widest uppercase text-foreground/30 mb-7">
              {industryName}
            </p>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extralight leading-[1.1] tracking-tight text-foreground mb-5">
              {headline}
            </h1>

            <p className="text-xl md:text-2xl font-thin text-muted-foreground/70 mb-7 leading-snug whitespace-pre-line">
              {subheadline}
            </p>

            <p className="text-sm font-light max-w-md leading-relaxed text-foreground/50 mb-10">
              {bodyText}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-foreground/30 text-sm font-light text-foreground hover:border-foreground/70 transition-colors"
              >
                {ctaPrimary}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 6h8M7 3l3 3-3 3" />
                </svg>
              </Link>

              <Link
                href="/articles"
                className="inline-flex items-center px-4 py-1.5 rounded-md border border-border text-sm font-light text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                {ctaSecondary}
              </Link>
            </div>
          </motion.div>

          {/* ── Right column — app preview card (desktop only) ── */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease, delay: 0.3 }}
          >
            <div className="border border-border rounded-xl shadow-sm bg-card overflow-hidden">

              {/* Mini navbar */}
              <div className="border-b border-border/40 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] font-light tracking-wide text-foreground/50">
                  {siteName}
                  <span className="text-muted-foreground/30">.</span>
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-light text-muted-foreground/40">resources</span>
                  <span className="text-[9px] font-light text-muted-foreground/40">about</span>
                  <span className="text-[8px] font-light px-2 py-0.5 rounded border border-muted-foreground/20 text-muted-foreground/40">
                    read articles
                  </span>
                </div>
              </div>

              {/* Page label */}
              <div className="px-4 pt-4 pb-2">
                <p className="text-[9px] tracking-widest uppercase text-foreground/25 mb-3">
                  articles.
                </p>

                {/* Filter pills */}
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="text-[8px] font-light px-2 py-0.5 rounded border border-foreground/25 text-foreground/60">
                    all topics
                  </span>
                  <span className="text-[8px] font-light px-2 py-0.5 rounded border border-border/50 text-muted-foreground/40">
                    guides
                  </span>
                  <span className="text-[8px] font-light px-2 py-0.5 rounded border border-border/50 text-muted-foreground/40">
                    faqs
                  </span>
                </div>
              </div>

              {/* Article rows */}
              <div className="px-4 pb-1">
                {previewRows.slice(0, 5).map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 py-2.5 border-b border-border/20 last:border-0"
                  >
                    <span className="shrink-0 text-[7px] tracking-widest uppercase font-medium text-muted-foreground/40 border border-border/40 rounded px-1 py-0.5">
                      {row.label}
                    </span>
                    <span className="text-[10px] font-light text-foreground/65 line-clamp-1 leading-snug">
                      {row.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Card footer */}
              <div className="px-4 py-3 border-t border-border/20 flex items-center justify-between">
                <span className="text-[8px] text-muted-foreground/30 font-light">
                  {recentArticles.length > 0
                    ? `${recentArticles.length} article${recentArticles.length !== 1 ? "s" : ""}`
                    : "articles"}
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-0.5 rounded-full bg-border/40" />
                  <div className="w-4 h-0.5 rounded-full bg-border/20" />
                </div>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
