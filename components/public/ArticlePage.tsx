"use client";

import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { siteUrl } from "@/lib/site-url";
import ShareButtons from "@/components/public/ShareButtons";

interface TOCItem {
  heading_level: string;
  text: string;
  anchor: string;
}

interface RelatedArticle {
  article_id: string;
  title: string;
  slug: string;
  core_id?: string;
  bridge_id?: string;
}

interface AuthorInfo {
  name: string;
  role?: string;
  bio?: string;
  image_url?: string;
  profile_url: string;
}

interface ArticlePageProps {
  article: {
    h1_title: string;
    content_type: string;
    body_markdown: string;
    key_highlights?: string[];
    table_of_contents?: TOCItem[];
    related_articles?: RelatedArticle[];
    primary_keyword: string;
    core_id: string;
    bridge_id: string;
    slug: string;
    published_at?: string;
    updated_at?: string;
    reviewer_name?: string | null;
    author_url?: string | null;
    featured_image_url?: string | null;
    featured_image_alt?: string | null;
  };
  coreLabel: string;
  bridgeLabel: string;
  author?: AuthorInfo | null;
}

function slugify(text: string): string {
  return String(text).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function estimateReadingTime(markdown: string): string {
  const words = markdown.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 230));
  return `${mins} min read`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Sticky TOC sidebar ────────────────────────────────────────────────────────

function TOCSidebar({ items, activeAnchor }: { items: TOCItem[]; activeAnchor: string }) {
  function scrollTo(text: string) {
    const el = document.getElementById(slugify(text));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-label="Table of contents">
      <p className="text-[9px] tracking-widest uppercase text-foreground/30 mb-4">contents</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => {
          const anchor = slugify(item.text);
          const isActive = activeAnchor === anchor;
          const isH3 = item.heading_level === "h3";
          return (
            <li key={i}>
              <button
                onClick={() => scrollTo(item.text)}
                className={`w-full text-left transition-colors duration-200 leading-snug py-1 border-l-2 ${
                  isH3 ? "text-[11px]" : "text-xs"
                } ${
                  isActive
                    ? "border-foreground/50 pl-3 text-foreground"
                    : "border-transparent pl-3 text-foreground/35 hover:text-foreground/60 font-light"
                }`}
              >
                {item.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── Inline mobile TOC ─────────────────────────────────────────────────────────

function MobileTOC({ items }: { items: TOCItem[]; activeAnchor?: string }) {
  const [open, setOpen] = useState(false);

  function scrollTo(text: string) {
    const el = document.getElementById(slugify(text));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="border border-border rounded-md mb-8 lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3"
      >
        <span className="text-[10px] tracking-widest uppercase text-foreground/40">contents</span>
        {open ? <ChevronUp size={13} className="text-foreground/40" /> : <ChevronDown size={13} className="text-foreground/40" />}
      </button>
      {open && (
        <nav className="border-t border-border/50 px-4 py-3 space-y-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => scrollTo(item.text)}
              className={`block w-full text-left text-xs font-light text-foreground/60 hover:text-foreground transition-colors ${
                item.heading_level === "h3" ? "pl-4" : ""
              }`}
            >
              {item.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArticlePage({ article, coreLabel, bridgeLabel, author }: ArticlePageProps) {
  const readingTime = estimateReadingTime(article.body_markdown);
  const hasTOC = article.table_of_contents && article.table_of_contents.length > 0;
  const articleUrl = `${siteUrl}/${article.core_id}/${article.bridge_id}/${article.slug}/`;

  const [activeAnchor, setActiveAnchor] = useState<string>("");

  useEffect(() => {
    const TRIGGER = 140;
    function onScroll() {
      const headings = Array.from(document.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
      if (headings.length === 0) return;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= TRIGGER) current = heading.id;
      }
      setActiveAnchor(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-light text-muted-foreground mb-10 flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors">home</Link>
        <span>/</span>
        <Link href={`/${article.core_id}/`} className="hover:text-foreground transition-colors capitalize">{coreLabel}</Link>
        <span>/</span>
        <Link href={`/${article.core_id}/${article.bridge_id}/`} className="hover:text-foreground transition-colors capitalize">{bridgeLabel}</Link>
        <span>/</span>
        <span className="text-foreground line-clamp-1">{article.h1_title}</span>
      </nav>

      {/* Two-column layout: article + sticky TOC */}
      <div className="flex gap-16 items-start">

        {/* ── Article content ── */}
        <div className="flex-1 min-w-0">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
              {article.content_type} &nbsp;·&nbsp; {readingTime}
              {article.published_at && (
                <> &nbsp;·&nbsp; {formatDate(article.published_at)}</>
              )}
            </p>
            <h1 className="text-3xl md:text-4xl font-extralight leading-[1.2] tracking-tight text-foreground">
              {article.h1_title}
            </h1>
            {article.reviewer_name && (
              <p className="text-xs font-light text-foreground/50 mt-2">
                by <span>{article.reviewer_name}</span>
              </p>
            )}
            {article.updated_at &&
              article.published_at &&
              article.updated_at !== article.published_at && (
                <p className="text-[10px] tracking-widest uppercase text-foreground/30 mt-1">
                  updated {formatDate(article.updated_at)}
                </p>
              )}
          </div>

          {/* Featured image */}
          {article.featured_image_url && (
            <div className="relative w-full mb-8 rounded-md overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <Image
                src={article.featured_image_url}
                alt={article.featured_image_alt || article.h1_title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 800px"
                unoptimized={
                  !article.featured_image_url.includes(".supabase.co") &&
                  !article.featured_image_url.includes("images.unsplash.com") &&
                  !article.featured_image_url.includes(".blob.core.windows.net")
                }
              />
            </div>
          )}

          {/* Share buttons */}
          <ShareButtons url={articleUrl} title={article.h1_title} variant="inline" />

          {/* Mobile-only inline TOC */}
          {hasTOC && <MobileTOC items={article.table_of_contents!} activeAnchor={activeAnchor} />}

          {/* Key Highlights */}
          {article.key_highlights && article.key_highlights.length > 0 && (
            <div className="border border-border rounded-md px-5 py-4 mb-8 bg-muted/20">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">key highlights</p>
              <ul className="list-disc list-outside pl-5 space-y-1.5">
                {article.key_highlights.map((point, i) => (
                  <li key={i} className="text-sm font-light text-foreground/80 leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Body */}
          <div className="prose-article">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const anchor = slugify(String(children));
                  const isActive = activeAnchor === anchor;
                  return (
                    <h2
                      id={anchor}
                      className={`text-xl font-light mt-10 mb-3 scroll-mt-20 transition-colors duration-300 ${
                        isActive ? "text-blue-600/80" : "text-foreground"
                      }`}
                    >
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const anchor = slugify(String(children));
                  const isActive = activeAnchor === anchor;
                  return (
                    <h3
                      id={anchor}
                      className={`text-base font-light mt-7 mb-2 scroll-mt-20 transition-colors duration-300 ${
                        isActive ? "text-blue-500/70" : "text-foreground"
                      }`}
                    >
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="text-base font-light leading-relaxed mb-4 text-foreground/90">
                    {children}
                  </p>
                ),
                a: ({ href, children }) => {
                  const isValid = !!href && (href.startsWith("/") || href.startsWith("http"));
                  if (!isValid) return <>{children}</>;
                  const isInternal =
                    href.startsWith("/") ||
                    href.startsWith(siteUrl);
                  return (
                    <a
                      href={href}
                      {...(!isInternal
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-foreground underline underline-offset-2 hover:text-foreground/70 transition-colors"
                    >
                      {children}
                    </a>
                  );
                },
                strong: ({ children }) => (
                  <strong className="font-medium text-foreground">{children}</strong>
                ),
                img: ({ src, alt }) => {
                  if (!src) return null;
                  const isSupabase = src.includes(".supabase.co");
                  return (
                    <span className="block relative w-full my-4" style={{ minHeight: 200 }}>
                      <Image
                        src={src}
                        alt={alt ?? ""}
                        fill
                        className="object-contain rounded-md"
                        loading="lazy"
                        unoptimized={!isSupabase}
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    </span>
                  );
                },
                em: ({ children }) => (
                  <em className="italic">{children}</em>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-border pl-4 text-muted-foreground font-light italic my-4">
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 mb-4 space-y-1 text-base font-light text-foreground/90">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 mb-4 space-y-1 text-base font-light text-foreground/90">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm font-light border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="border-b border-border">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground/40">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border-b border-border/20 text-foreground/90">{children}</td>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <code className="block bg-muted rounded-md p-3 text-xs font-light overflow-x-auto mb-4">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="bg-muted rounded px-1 py-0.5 text-xs font-light">{children}</code>
                  );
                },
              }}
            >
              {
                // Collapse [[text](url1)](url2) double-bracket patterns left in
                // the DB when wire-cluster injected into an already-bare-slug-linked
                // phrase. Keep the inner (correct) link, discard the outer bad href.
                article.body_markdown.replace(
                  /\[\[([^\]]+)\]\(([^)]*)\)\]\([^)]*\)/g,
                  "[$1]($2)"
                )
              }
            </ReactMarkdown>
          </div>

          {/* Related Articles */}
          {article.related_articles && article.related_articles.length > 0 && (
            <div className="border-t border-border/30 mt-12 pt-8">
              <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">related articles</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {article.related_articles.map((related) => (
                  <Link
                    key={related.article_id}
                    href={`/${related.core_id ?? article.core_id}/${related.bridge_id ?? article.bridge_id}/${related.slug}/`}
                    className="border border-border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-xs font-light text-foreground leading-snug">{related.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Author box */}
          {author && (
            <div className="border-t border-border/30 mt-12 pt-8">
              <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-5">about the author</p>
              <div className="flex gap-4 items-start">
                {author.image_url ? (
                  <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden border border-border/40">
                    <Image
                      src={author.image_url}
                      alt={author.name}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full object-top"
                      unoptimized={!author.image_url.includes(".supabase.co")}
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-14 h-14 rounded-md bg-foreground/5 border border-border/40 flex items-center justify-center">
                    <span className="text-lg font-light text-foreground/40">
                      {author.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-light text-foreground mb-0.5">{author.name}</p>
                  {author.role && (
                    <p className="text-[11px] font-light text-foreground/40 mb-1.5">{author.role}</p>
                  )}
                  {author.bio && (
                    <p className="text-xs font-light leading-relaxed text-foreground/55 max-w-lg">
                      {author.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky TOC sidebar (desktop only) ── */}
        <aside className="hidden lg:flex w-52 shrink-0 sticky top-12 self-start max-h-[calc(100vh-6rem)] flex-col justify-between overflow-y-auto">
          {hasTOC && <TOCSidebar items={article.table_of_contents!} activeAnchor={activeAnchor} />}
          <div className="mt-8 flex flex-col gap-4">
            <ShareButtons url={articleUrl} title={article.h1_title} variant="sidebar" />
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-light rounded-md border border-border text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
            >
              ↑ back to top
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}
