import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Pet Owner Tools",
  description: "Free calculators and AI-powered tools to help pet owners understand costs, check pet health, find the right breed, and build a care plan.",
  alternates: { canonical: `${siteUrl}/tools/` },
};

const TOOLS = [
  {
    href: "/tools/pet-age-calculator",
    name: "Pet Age Calculator",
    description: "Convert your dog or cat's age to human years — with breed-specific adjustments so the result is actually accurate.",
    tag: "Calculator",
  },
  {
    href: "/tools/pet-food-calculator",
    name: "Pet Food Portion Calculator",
    description: "Get a daily feeding recommendation based on your pet's species, weight, age, and activity level — no guesswork.",
    tag: "Calculator",
  },
  {
    href: "/tools/pet-cost-estimator",
    name: "Annual Pet Cost Estimator",
    description: "See a full breakdown of what owning your specific pet actually costs per year — food, vet bills, grooming, and more.",
    tag: "Calculator",
  },
  {
    href: "/tools/pet-insurance-advisor",
    name: "Pet Insurance Advisor",
    description: "Describe your pet and your budget. Get a plain-English recommendation on what type of coverage actually makes sense for you.",
    tag: "AI-Powered",
  },
  {
    href: "/tools/symptom-checker",
    name: "Symptom Urgency Checker",
    description: "Describe what you're noticing in your pet and get an honest read on whether it's a wait-and-watch situation or a same-day vet call.",
    tag: "AI-Powered",
  },
  {
    href: "/tools/adoption-readiness",
    name: '"Am I Ready?" Pet Quiz',
    description: "A 10-question quiz that gives you a straight verdict on whether your lifestyle, budget, and home are a real fit for a new pet.",
    tag: "AI-Powered",
  },
  {
    href: "/tools/breed-finder",
    name: "Breed Compatibility Finder",
    description: "Tell us about your living situation, activity level, and preferences. Get matched with breeds that actually suit your life.",
    tag: "AI-Powered",
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">tools</p>
      <h1 className="text-2xl md:text-3xl font-extralight tracking-tight text-foreground mb-2">
        Pet owner tools
      </h1>
      <p className="text-sm font-light text-muted-foreground mb-10 max-w-xl">
        Calculators and AI-powered tools that give you straight answers about your pet's health, costs, and care.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col border border-border rounded-md p-5 hover:border-foreground/30 hover:bg-muted/30 hover:shadow-sm transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="text-sm font-light text-foreground leading-snug group-hover:text-foreground transition-colors">
                {tool.name}
              </span>
              <span
                className={`shrink-0 text-[9px] tracking-widest uppercase border rounded px-1.5 py-0.5 ${
                  tool.tag === "AI-Powered"
                    ? "border-foreground/20 text-foreground/50"
                    : "border-border text-muted-foreground"
                }`}
              >
                {tool.tag}
              </span>
            </div>
            <p className="text-xs font-light text-muted-foreground leading-relaxed flex-1">
              {tool.description}
            </p>
            <div className="mt-4 text-[10px] tracking-widest uppercase text-foreground/30 group-hover:text-foreground/60 transition-colors">
              open →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
