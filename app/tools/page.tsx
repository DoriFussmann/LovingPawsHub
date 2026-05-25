import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

// When this page has real content, remove `robots: "noindex"` below and
// uncomment the /tools/ entry in app/sitemap.ts to start indexing it.
export const metadata: Metadata = {
  title: "Tools",
  description: "Free tools and calculators.",
  alternates: { canonical: `${siteUrl}/tools/` },
  robots: "noindex",
};

export default function ToolsPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-3">tools</p>
      <h1 className="text-2xl font-extralight tracking-tight text-foreground">Coming soon</h1>
    </div>
  );
}
