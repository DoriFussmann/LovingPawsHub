"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { GlossaryTermPublic } from "@/app/glossary/page";

interface Props {
  terms: GlossaryTermPublic[];
  initialSlug: string | null;
}

export default function GlossaryPageClient({ terms, initialSlug }: Props) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug);
  const [query, setQuery] = useState("");
  const detailRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredTerms = query.trim()
    ? terms.filter(
        (t) =>
          t.term.toLowerCase().includes(query.toLowerCase()) ||
          t.description?.toLowerCase().includes(query.toLowerCase())
      )
    : terms;

  const selectedTerm = terms.find((t) => t.slug === selectedSlug) ?? terms[0] ?? null;

  // Keep selectedSlug in sync when navigating between /glossary/[slug] pages
  useEffect(() => {
    setSelectedSlug(initialSlug);
  }, [initialSlug]);

  function handleSelect(slug: string) {
    setSelectedSlug(slug);
    router.push(`/glossary/${slug}`, { scroll: false });
    // On mobile, scroll the detail panel into view
    if (window.innerWidth < 768) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
      {/* Page heading */}
      <div className="mb-10">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">reference</p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">glossary.</h1>
        {terms.length > 0 && (
          <p className="text-sm font-light text-muted-foreground mt-1">
            {query.trim() && filteredTerms.length !== terms.length
              ? `${filteredTerms.length} of ${terms.length} term${terms.length !== 1 ? "s" : ""}`
              : `${terms.length} term${terms.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* Search bar */}
      {terms.length > 0 && (
        <div className="mb-8 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30 pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms…"
            className="w-full pl-9 pr-8 py-2 text-sm font-light bg-transparent border border-border rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {terms.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-sm font-light text-muted-foreground">No glossary terms published yet.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left: 60% grid of term names */}
          <div className="w-full md:w-[60%] shrink-0">
            {filteredTerms.length === 0 ? (
              <p className="text-sm font-light text-muted-foreground py-4">
                No terms match &ldquo;{query}&rdquo;.
              </p>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredTerms.map((term) => {
                const isActive = term.slug === selectedTerm?.slug;
                return (
                  <button
                    key={term.slug}
                    onClick={() => handleSelect(term.slug)}
                    className={`text-left px-4 py-3 rounded-lg border text-sm font-light transition-all duration-150 ${
                      isActive
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-foreground/70 hover:text-foreground hover:border-foreground/30 hover:bg-muted/50"
                    }`}
                  >
                    {term.term}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* Right: 40% detail panel */}
          <div ref={detailRef} className="w-full md:w-[40%]">
            {selectedTerm ? (
              <div className="md:sticky md:top-24">
                <div className="border border-border rounded-xl p-6 space-y-5">
                  {/* Term name */}
                  <div className="border-b border-border/50 pb-4">
                    <Link
                      href={`/glossary/${selectedTerm.slug}`}
                      className="text-lg font-light text-foreground hover:text-foreground/70 transition-colors"
                    >
                      {selectedTerm.term}
                    </Link>
                  </div>

                  {/* Description */}
                  {selectedTerm.description && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-2">definition</p>
                      <p className="text-sm font-light text-foreground/80 leading-relaxed">
                        {selectedTerm.description}
                      </p>
                    </div>
                  )}

                  {/* Examples */}
                  {selectedTerm.examples?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-2">examples</p>
                      <ul className="space-y-2">
                        {selectedTerm.examples.map((ex, i) => (
                          <li key={i} className="flex gap-2 text-sm font-light text-foreground/70">
                            <span className="text-foreground/30 shrink-0 mt-0.5">—</span>
                            <span className="leading-relaxed">{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resources */}
                  {selectedTerm.resources?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-2">resources</p>
                      <ul className="space-y-1.5">
                        {selectedTerm.resources.map((r, i) => (
                          <li key={i}>
                            {r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-light text-foreground/60 hover:text-foreground transition-colors underline underline-offset-2"
                              >
                                {r.title || r.url}
                              </a>
                            ) : (
                              <span className="text-sm font-light text-foreground/60">{r.title}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl p-8 text-center">
                <p className="text-sm font-light text-muted-foreground">Select a term to view its definition.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
