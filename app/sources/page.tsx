import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sources",
  robots: "noindex",
};

export default function SourcesPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">sources</p>
      <h1 className="text-2xl font-extralight tracking-tight text-foreground">Coming soon</h1>
    </div>
  );
}
