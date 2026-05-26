import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Tools",
  description: "Free calculators and AI-powered tools to help first-time homebuyers understand costs, check readiness, and build a plan.",
  alternates: { canonical: `${siteUrl}/tools/` },
};

const TOOLS = [
  {
    href: "/tools/mortgage-breakdown",
    name: "Mortgage Payment Breakdown",
    description: "See exactly where your monthly payment goes — principal, interest, PMI, taxes, and insurance.",
    tag: "Calculator",
  },
  {
    href: "/tools/closing-cost-estimator",
    name: "Closing Cost Estimator",
    description: "Itemized estimate of every closing cost with a plain-English explanation of what each one actually is.",
    tag: "Calculator",
  },
  {
    href: "/tools/rent-vs-buy",
    name: "Rent vs. Buy (Honest Edition)",
    description: "The real math on renting vs. buying over your timeline. No cheerleading — if renting wins, it'll say so.",
    tag: "Calculator",
  },
  {
    href: "/tools/credit-score-translator",
    name: "Credit Score Translator",
    description: "Enter your score and get a plain-English breakdown of what it means for loan types, rates, and your options.",
    tag: "AI-Powered",
  },
  {
    href: "/tools/affordability-check",
    name: "Affordability Reality Check",
    description: "Plug in your income, debt, and savings. Get an honest picture of what you can actually afford.",
    tag: "AI-Powered",
  },
  {
    href: "/tools/ready-assessment",
    name: '"Am I Ready?" Assessment',
    description: "A 10-question quiz that produces the most honest readiness verdict you'll get from anyone in real estate.",
    tag: "AI-Powered",
  },
  {
    href: "/tools/timeline-builder",
    name: "Timeline Builder",
    description: "Tell us your move-in goal. Get a month-by-month action plan built specifically for your situation.",
    tag: "AI-Powered",
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">tools</p>
      <h1 className="text-2xl md:text-3xl font-extralight tracking-tight text-foreground mb-2">
        Homebuyer tools
      </h1>
      <p className="text-sm font-light text-muted-foreground mb-10 max-w-xl">
        Calculators and AI-powered tools that give you straight answers — no sales pitch, no fluff.
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
