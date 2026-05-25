import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "resources",
  description: "Free tools and resources for content research, SEO, and editorial planning.",
  alternates: { canonical: `${siteUrl}/resources/` },
  robots: { index: false, follow: true },
};

const TOOLS = [
  {
    name: "Readability Analyzer",
    category: "content",
    description:
      "Score your writing for clarity and reading level across Flesch-Kincaid, Gunning Fog, and SMOG indexes.",
  },
  {
    name: "Keyword Density Checker",
    category: "seo",
    description:
      "Measure keyword frequency and distribution across your article to avoid over-optimisation.",
  },
  {
    name: "SERP Preview Tool",
    category: "seo",
    description:
      "See exactly how your title tag and meta description appear in Google desktop and mobile results.",
  },
  {
    name: "Schema Markup Generator",
    category: "technical",
    description:
      "Build Article, FAQ, and BreadcrumbList JSON-LD structured data without writing code.",
  },
  {
    name: "Internal Link Mapper",
    category: "seo",
    description:
      "Visualise your site's internal linking structure and identify orphaned pages or link gaps.",
  },
  {
    name: "Page Speed Estimator",
    category: "technical",
    description:
      "Estimate Core Web Vitals impact before publishing based on asset size and layout shift patterns.",
  },
  {
    name: "Content Brief Builder",
    category: "content",
    description:
      "Generate a structured editorial brief from a target keyword, including angle, headings, and suggested sources.",
  },
];

export default function ResourcesPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-16">
      <p className="text-[10px] tracking-widest uppercase text-foreground/30 mb-1">tools</p>
      <h1 className="text-2xl font-extralight tracking-tight text-foreground">resources</h1>
      <p className="text-xs font-light text-muted-foreground mt-1 mb-12">
        free tools for content research and editorial planning.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <div key={tool.name} className="border border-border rounded-md px-5 py-4">
            <span className="inline-block text-[9px] tracking-widest uppercase font-medium text-foreground/30 border border-border/50 rounded px-1.5 py-0.5 mb-3">
              {tool.category}
            </span>
            <p className="text-sm font-light text-foreground mb-2">{tool.name}</p>
            <p className="text-xs font-light leading-relaxed text-muted-foreground">
              {tool.description}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-light text-foreground/30 mt-8">
        tools launching soon — check back shortly.
      </p>
    </div>
  );
}
