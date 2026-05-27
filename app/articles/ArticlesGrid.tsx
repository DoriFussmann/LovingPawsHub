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
  selectedCore: string;
}

export default function ArticlesGrid({
  articles,
  coreKeywords,
  currentPage,
  totalPages,
  totalCount,
  selectedCore,
}: ArticlesGridProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  // Build a lookup map for core keyword labels
  const coreLabelMap = Object.fromEntries(
    coreKeywords.map((c) => [c.core_id, c.keyword])
  );

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
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleClearSearch() {
    handleSearchChange("");
  }

  function handleCoreSelect(coreId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (coreId && coreId !== selectedCore) {
      params.set("core", coreId);
    } else {
      params.delete("core");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search is the only remaining client-side filter (core is server-side)
  const filtered = articles.filter((a) => {
    if (search === "") return true;
    return (
      a.h1_title.toLowerCase().includes(search.toLowerCase()) ||
      a.primary_keyword.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      {/* Core topic filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => handleCoreSelect("")}
          className={selectedCore === "" ? "tag tag-ink" : "tag tag-ghost hover:tag"}
        >
          All topics
        </button>
        {coreKeywords.map((c) => (
          <button
            key={c.core_id}
            onClick={() => handleCoreSelect(c.core_id)}
            className={selectedCore === c.core_id ? "tag tag-ink" : "tag tag-ghost"}
          >
            {c.keyword}
          </button>
        ))}
      </div>

      {/* Search + count */}
      <div className="flex items-center gap-3 mb-7">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-text-muted"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input pl-9 h-9 text-sm w-72"
          />
        </div>
        {search && (
          <button
            onClick={handleClearSearch}
            className="text-sm text-ds-text-muted hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
        <span className="text-meta ml-auto">
          {search
            ? `${filtered.length} of ${articles.length}`
            : `${totalCount} total`}{" "}
          article{totalCount !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center card">
          <p className="text-body text-ds-text-muted">No articles found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              coreLabel={coreLabelMap[article.core_id]}
            />
          ))}
        </div>
      )}

      {/* Pagination — hidden while searching; core filter resets to page 1 so pagination still works */}
      {totalPages > 1 && !search && (
        <div className="flex items-center justify-center gap-3 mt-12">
          {currentPage > 1 && (
            <Link
              href={selectedCore ? `/articles?core=${selectedCore}&page=${currentPage - 1}` : `/articles?page=${currentPage - 1}`}
              className="btn btn-secondary btn-sm"
            >
              ← Prev
            </Link>
          )}
          <span className="text-meta">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={selectedCore ? `/articles?core=${selectedCore}&page=${currentPage + 1}` : `/articles?page=${currentPage + 1}`}
              className="btn btn-secondary btn-sm"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
