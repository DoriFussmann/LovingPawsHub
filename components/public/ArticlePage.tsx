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
      <p className="text-caption mb-4">In this article</p>
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
                  isH3 ? "text-[11px] pl-5" : "text-xs pl-3"
                } ${
                  isActive
                    ? "border-accent text-foreground font-medium"
                    : "border-transparent text-ds-text-muted hover:text-foreground font-light"
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
    <div className="card mb-8 lg:hidden overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3"
      >
        <span className="text-caption">In this article</span>
        {open ? <ChevronUp size={13} className="text-ds-text-muted" /> : <ChevronDown size={13} className="text-ds-text-muted" />}
      </button>
      {open && (
        <nav className="border-t border-border px-4 py-3 space-y-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => scrollTo(item.text)}
              className={`block w-full text-left text-xs text-ds-text-muted hover:text-foreground transition-colors ${
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
    <div className="max-w-[1280px] mx-auto px-6 md:px-14 py-12">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-10 flex-wrap">
        <Link href="/" className="hover:text-accent transition-colors">Home</Link>
        <span className="text-border-strong">/</span>
        <Link href={`/${article.core_id}/`} className="hover:text-accent transition-colors capitalize">{coreLabel}</Link>
        <span className="text-border-strong">/</span>
        <Link href={`/${article.core_id}/${article.bridge_id}/`} className="hover:text-accent transition-colors capitalize">{bridgeLabel}</Link>
        <span className="text-border-strong">/</span>
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
            <h1 className="text-h1 text-foreground mb-4">
              {article.h1_title}
            </h1>
            {article.reviewer_name && (
              <p className="text-meta mt-2">
                by {article.reviewer_name}
              </p>
            )}
            {article.updated_at &&
              article.published_at &&
              article.updated_at !== article.published_at && (
                <p className="text-meta mt-1">
                  Updated {formatDate(article.updated_at)}
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
            <div
              className="rounded-lg px-5 py-5 mb-8"
              style={{ background: "var(--primary-soft)" }}
            >
              <p className="text-caption mb-4" style={{ color: "var(--primary-strong)" }}>
                Key highlights
              </p>
              <ul className="list-disc list-outside pl-5 space-y-2">
                {article.key_highlights.map((point, i) => (
                  <li key={i} className="text-body-sm text-foreground">
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
                      className={`text-h2 mt-10 mb-3 scroll-mt-24 transition-colors duration-300 ${
                        isActive ? "text-accent" : "text-foreground"
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
                      className={`text-h3 mt-7 mb-2 scroll-mt-24 transition-colors duration-300 ${
                        isActive ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="text-body text-ds-text mb-4">
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
                      className="text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent transition-colors"
                    >
                      {children}
                    </a>
                  );
                },
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
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
                  <blockquote
                    className="border-l-2 pl-4 italic my-4 rounded-r-md px-4 py-3"
                    style={{
                      borderColor: "var(--accent)",
                      background: "var(--primary-soft)",
                      color: "var(--primary-strong)",
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 mb-4 space-y-1 text-body text-ds-text">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 mb-4 space-y-1 text-body text-ds-text">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4 card overflow-hidden">
                    <table className="w-full text-sm border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ background: "var(--muted)" }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="text-left px-4 py-3 text-caption text-ds-text-muted border-b border-border">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-3 border-b border-border text-ds-text text-sm">{children}</td>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <code className="block rounded-lg p-4 text-xs overflow-x-auto mb-4" style={{ background: "var(--foreground)", color: "var(--card)" }}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="rounded px-1.5 py-0.5 text-xs font-medium"
                      style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}
                    >
                      {children}
                    </code>
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
            <div className="border-t border-border mt-12 pt-8">
              <p className="text-caption mb-5">Related articles</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {article.related_articles.map((related) => (
                  <Link
                    key={related.article_id}
                    href={`/${related.core_id ?? article.core_id}/${related.bridge_id ?? article.bridge_id}/${related.slug}/`}
                    className="card card-hover p-4 block"
                  >
                    <p className="text-body-sm text-foreground leading-snug">{related.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Author box */}
          {author && (
            <div className="border-t border-border mt-12 pt-8">
              <p className="text-caption mb-5">About the author</p>
              <div className="flex gap-4 items-start">
                {author.image_url ? (
                  <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-border">
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
                  <span className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>
                    {author.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="text-h4 text-foreground mb-0.5">{author.name}</p>
                  {author.role && (
                    <p className="text-meta mb-2">{author.role}</p>
                  )}
                  {author.bio && (
                    <p className="text-body-sm text-ds-text max-w-lg">
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
              className="btn btn-secondary btn-sm w-full justify-center"
            >
              ↑ Back to top
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}
