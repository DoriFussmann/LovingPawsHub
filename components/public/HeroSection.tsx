"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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

const PET_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=900&h=700&fit=crop",
    alt: "Happy golden retriever looking up",
  },
  {
    src: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900&h=700&fit=crop",
    alt: "Beautiful tabby cat resting",
  },
  {
    src: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&h=700&fit=crop",
    alt: "Puppy playing outdoors",
  },
  {
    src: "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=900&h=700&fit=crop",
    alt: "Playful kitten on a soft surface",
  },
  {
    src: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=900&h=700&fit=crop",
    alt: "Two dogs running together",
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function HeroSection({
  recentArticles: _recentArticles,
  siteName: siteNameProp,
  industryName: industryNameProp,
  headline: headlineProp,
  subheadline: subheadlineProp,
  bodyText: bodyTextProp,
  ctaPrimary: ctaPrimaryProp,
  ctaSecondary: ctaSecondaryProp,
}: HeroSectionProps) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((i) => (i + 1) % PET_IMAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const industryName = (industryNameProp || "pet care").toLowerCase();
  const siteName = siteNameProp || "Loving Paws Hub";
  const headline =
    headlineProp || "Pet care information grounded in science.";
  const subheadline =
    subheadlineProp ||
    "Every article on Loving Paws Hub is written and reviewed by licensed veterinarians, so you can make confident decisions for the animals you love.";
  const bodyText = bodyTextProp || "";
  const ctaPrimary = ctaPrimaryProp || "Find care for your pet";
  const ctaSecondary = ctaSecondaryProp || "Browse articles";

  return (
    <section className="pt-16 pb-20 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-center">

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
            {bodyText && (
              <p className="text-body-sm max-w-md text-ds-text-muted mb-10">
                {bodyText}
              </p>
            )}

            {/* CTAs */}
            <div className={`flex items-center gap-3 flex-wrap ${bodyText ? "" : "mt-10"}`}>
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

          {/* ── Right column — pet photo carousel ── */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease, delay: 0.25 }}
          >
            <div
              className="relative overflow-hidden shadow-sh2"
              style={{ borderRadius: "1rem", aspectRatio: "4/3" }}
            >
              <AnimatePresence mode="sync">
                <motion.div
                  key={currentImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={PET_IMAGES[currentImage].src}
                    alt={PET_IMAGES[currentImage].alt}
                    fill
                    className="object-cover"
                    priority={currentImage === 0}
                    sizes="(max-width: 1280px) 50vw, 560px"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Subtle gradient overlay at the bottom */}
              <div
                className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
                style={{
                  background: "linear-gradient(to top, rgba(0,0,0,0.25), transparent)",
                }}
              />

              {/* Dot indicators */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {PET_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    aria-label={`Show image ${i + 1}`}
                    className="transition-all duration-300"
                    style={{
                      width: i === currentImage ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === currentImage ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              {/* Badge */}
              <div
                className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(8px)",
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                {siteName}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
