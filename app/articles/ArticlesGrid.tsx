"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import ArticleCard from "@/components/public/ArticleCard";

interface Article {
  id: string;
  article_id: string;
  h1_title: string;
  content_type: string;
  primary_keyword: string;
  core_id: string;
  bridge_id: string;
  slug: string;
  body_markdown: string;
  is_core_article: boolean;
  published_at: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
}

interface ArticlesGridProps {
  articles: Article[];
  coreKeywords: Array<{ core_id: string; keyword: string }>;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export default function ArticlesGrid({
  articles,
  coreKeywords,
  currentPage,
  totalPages,
  totalCount,
}: ArticlesGridProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedCore, setSelectedCore] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  // Sync search state if the URL param changes externally
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  function handleSearchChange(value: string) {
    setSearch(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    // Remove page param when searching
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleClearSearch() {
    handleSearchChange("");
  }

  const filtered = articles.filter((a) => {
    const matchesCore = selectedCore === "" || a.core_id === selectedCore;
    const matchesSearch =
      search === "" ||
      a.h1_title.toLowerCase().includes(search.toLowerCase()) ||
      a.primary_keyword.toLowerCase().includes(search.toLowerCase());
    return matchesCore && matchesSearch;
  });

  return (
    <div>
      {/* Core topic buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCore("")}
          className={`px-3 py-1.5 text-xs font-light rounded-full border transition-colors ${
            selectedCore === ""
              ? "border-foreground bg-foreground text-background"
              : "border-border text-foreground/60 hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          all topics
        </button>
        {coreKeywords.map((c) => (
          <button
            key={c.core_id}
            onClick={() => setSelectedCore(selectedCore === c.core_id ? "" : c.core_id)}
            className={`px-3 py-1.5 text-xs font-light rounded-full border transition-colors ${
              selectedCore === c.core_id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground/60 hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {c.keyword}
          </button>
        ))}
      </div>

      {/* Search + count */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="search articles..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 w-72"
        />
        {search && (
          <button
            onClick={handleClearSearch}
            className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            clear
          </button>
        )}
        <span className="text-xs font-light text-muted-foreground ml-auto">
          {search || selectedCore
            ? `${filtered.length} of ${articles.length}`
            : `${totalCount} total`}{" "}
          article{totalCount !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-light text-muted-foreground">no articles found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* Pagination — only when not actively filtering */}
      {totalPages > 1 && !search && !selectedCore && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {currentPage > 1 && (
            <Link
              href={`/articles?page=${currentPage - 1}`}
              className="px-4 py-2 text-xs font-light border border-border rounded-md text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              ← prev
            </Link>
          )}
          <span className="text-xs font-light text-muted-foreground">
            page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/articles?page=${currentPage + 1}`}
              className="px-4 py-2 text-xs font-light border border-border rounded-md text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
