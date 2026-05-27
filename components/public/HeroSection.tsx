"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import JourneyModal from "@/components/public/JourneyModal";

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
  { label: "guide",      title: "the complete guide to pet nutrition" },
  { label: "faq",        title: "how often should I take my dog to the vet?" },
  { label: "comparison", title: "wet food vs dry food: what vets recommend" },
  { label: "hub",        title: "cat behavior explained by behaviorists" },
  { label: "guide",      title: "senior pet care: signs to watch for" },
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
  const [journeyOpen, setJourneyOpen] = useState(false);

  const industryName = (industryNameProp || "pet care").toLowerCase();
  const siteName = siteNameProp || "Loving Paws Hub";
  const headline =
    headlineProp ||
    "The kindest, most useful pet care guide on the internet.";
  const subheadline = subheadlineProp || "";
  const bodyText =
    bodyTextProp ||
    `Practical, expert-backed answers about food, behavior and wellness — for the dogs and cats who run our lives.`;
  const ctaPrimary = ctaPrimaryProp || "Start with your pet";
  const ctaSecondary = ctaSecondaryProp || "Browse topics";

  const previewRows =
    recentArticles.length > 0
      ? recentArticles.map((a) => ({
          label: CONTENT_TYPE_LABELS[a.content_type] ?? a.content_type.toLowerCase(),
          title: a.h1_title,
          href: `/${a.core_id}/${a.bridge_id}/${a.slug}`,
        }))
      : FALLBACK_ROWS.map((r) => ({ ...r, href: "/articles" }));

  return (
    <section className="pt-16 pb-20 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">

          {/* ── Left column ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            {/* Eyebrow */}
            <p className="text-eyebrow mb-7">{industryName} · vet-reviewed</p>

            {/* Headline */}
            <h1
              className="text-display-xl text-foreground mb-6"
              style={{ color: "var(--foreground)" }}
            >
              {headline}
            </h1>

            {/* Sub-headline */}
            {subheadline && (
              <p className="text-lead mb-5 whitespace-pre-line">{subheadline}</p>
            )}

            {/* Body */}
            <p className="text-body-sm max-w-md text-ds-text-muted mb-10">
              {bodyText}
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setJourneyOpen(true)}
                className="btn btn-primary btn-lg"
              >
                {ctaPrimary}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>

              <Link href="/articles" className="btn btn-ghost btn-lg">
                {ctaSecondary}
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 mt-8 text-ds-text-muted text-sm">
              <div className="flex">
                {["DR", "MK", "JC", "SO"].map((initials, i) => (
                  <span
                    key={initials}
                    className="avatar"
                    style={{
                      width: 30,
                      height: 30,
                      fontSize: 10,
                      marginLeft: i > 0 ? -8 : 0,
                      border: "2px solid var(--background)",
                    }}
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <span>Expert-reviewed content from working vets.</span>
            </div>

            <JourneyModal
              open={journeyOpen}
              onClose={() => setJourneyOpen(false)}
            />
          </motion.div>

          {/* ── Right column — article preview card ── */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease, delay: 0.25 }}
          >
            <div
              className="card shadow-sh2 overflow-hidden"
              style={{ borderRadius: "0.75rem" }}
            >
              {/* Mini header */}
              <div
                className="flex items-center justify-between px-5 py-3 border-b border-border"
                style={{ background: "var(--muted)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <span className="text-[11px] font-medium text-foreground tracking-[-0.01em]">
                    {siteName}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {["articles", "glossary", "tools"].map((l) => (
                    <span key={l} className="text-[10px] text-ds-text-muted">
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Content label */}
              <div className="px-5 pt-4 pb-2">
                <p className="text-eyebrow mb-3">latest articles</p>

                {/* Filter pills */}
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="tag">all topics</span>
                  <span className="tag tag-ghost">dogs</span>
                  <span className="tag tag-ghost">cats</span>
                </div>
              </div>

              {/* Article rows */}
              <div className="px-5 pb-1">
                {previewRows.slice(0, 5).map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                  >
                    <span
                      className="tag tag-ghost shrink-0"
                      style={{ fontSize: "9px", padding: "2px 6px" }}
                    >
                      {row.label}
                    </span>
                    <span className="text-[12px] font-light text-foreground/70 line-clamp-1 leading-snug">
                      {row.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Card footer */}
              <div
                className="px-5 py-3 flex items-center justify-between border-t border-border"
                style={{ background: "var(--muted)" }}
              >
                <span className="text-[10px] text-ds-text-muted">
                  {recentArticles.length > 0
                    ? `${recentArticles.length} article${recentArticles.length !== 1 ? "s" : ""}`
                    : "articles"}
                </span>
                <div className="flex items-center gap-1">
                  <div
                    className="w-8 h-0.5 rounded-full"
                    style={{ background: "var(--border-strong)" }}
                  />
                  <div
                    className="w-4 h-0.5 rounded-full"
                    style={{ background: "var(--border)" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
