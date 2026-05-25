"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Search, UserX, Check } from "lucide-react";
import StatusBadge from "@/components/admin/StatusBadge";

interface ArticleRow {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  content_type: string;
  is_core_article: boolean;
  primary_keyword: string;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  robots_directive: string | null;
  schema_type: string | null;
  schema_markup: unknown;
  body_markdown: string;
  table_of_contents: unknown;
  internal_links_injected: unknown;
  related_articles: unknown;
  external_links: unknown;
  link_status: string;
  reviewer_name: string | null;
  author_url: string | null;
  published_at: string | null;
  generated_at: string | null;
  updated_at: string | null;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image_url: string;
}

interface PublishedClientProps {
  articles: ArticleRow[];
  coreKeywords: Array<{ id: string; keyword: string; core_id: string }>;
  teamMembers: TeamMember[];
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">{label}</p>
      <div className="text-xs font-light text-foreground leading-relaxed">{value}</div>
    </div>
  );
}

function JsonField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  const isEmpty = Array.isArray(value) ? value.length === 0 : Object.keys(value as object).length === 0;
  if (isEmpty) return null;
  return (
    <div>
      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">{label}</p>
      <pre className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function PublishedClient({ articles, coreKeywords, teamMembers }: PublishedClientProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedCore, setSelectedCore] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Per-article author state: maps article.id → { reviewer_name, saving, saved, error }
  const [authorState, setAuthorState] = useState<Record<string, {
    reviewer_name: string;
    saving: boolean;
    saved: boolean;
    error: string | null;
  }>>({});

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function getAuthorValue(article: ArticleRow): string {
    return authorState[article.id]?.reviewer_name ?? article.reviewer_name ?? "";
  }

  async function saveAuthor(article: ArticleRow, name: string) {
    const member = teamMembers.find((m) => m.name === name);
    const authorUrl = member ? `/authors/${nameToSlug(member.name)}/` : null;

    setAuthorState((prev) => ({
      ...prev,
      [article.id]: { reviewer_name: name, saving: true, saved: false, error: null },
    }));

    try {
      const res = await fetch("/api/admin/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id, reviewer_name: name || null, author_url: authorUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setAuthorState((prev) => ({
        ...prev,
        [article.id]: { reviewer_name: name, saving: false, saved: true, error: null },
      }));
    } catch (e) {
      setAuthorState((prev) => ({
        ...prev,
        [article.id]: {
          reviewer_name: name,
          saving: false,
          saved: false,
          error: e instanceof Error ? e.message : "save failed",
        },
      }));
    }
  }

  const filtered = useMemo(() => {
    let result = articles;
    if (selectedCore) result = result.filter((a) => a.core_id === selectedCore);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((a) => a.h1_title.toLowerCase().includes(q));
    }
    return result;
  }, [articles, selectedCore, search]);

  if (articles.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">no published articles yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="space-y-3">
        {/* Core keyword filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCore(null)}
            className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
              selectedCore === null
                ? "bg-foreground text-background border-foreground"
                : "border-border text-foreground/70 hover:bg-muted/40"
            }`}
          >
            all cores
          </button>
          {coreKeywords.map((core) => (
            <button
              key={core.id}
              onClick={() => setSelectedCore(selectedCore === core.core_id ? null : core.core_id)}
              className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                selectedCore === core.core_id
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-foreground/70 hover:bg-muted/40"
              }`}
            >
              {core.keyword}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search by title..."
            className="w-full pl-8 pr-4 py-2 text-xs font-light rounded-md border border-border bg-background focus:outline-none focus:border-foreground/50 text-foreground placeholder:text-foreground/30"
          />
        </div>

        {/* Count */}
        {(selectedCore || search) && (
          <p className="text-[10px] text-muted-foreground">
            {filtered.length} of {articles.length} articles
          </p>
        )}
      </div>

      {/* Grid — 3 per row */}
      {filtered.length === 0 ? (
        <p className="text-xs font-light text-muted-foreground py-4">no articles match the current filter.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((article) => {
            const isOpen = openIds.has(article.id);
            return (
              <div key={article.id} className={`border rounded-md overflow-hidden ${!article.reviewer_name && !authorState[article.id]?.reviewer_name ? "border-orange-200 dark:border-orange-900/50" : "border-border"}`}>
                {/* Title row */}
                <button
                  onClick={() => toggle(article.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  {isOpen
                    ? <ChevronDown size={12} className="text-foreground/40 shrink-0" />
                    : <ChevronRight size={12} className="text-foreground/40 shrink-0" />}
                  <span className="text-xs font-light text-foreground truncate flex-1">{article.h1_title}</span>
                  {!article.reviewer_name && !authorState[article.id]?.reviewer_name && (
                    <span title="missing author" className="shrink-0 text-orange-400">
                      <UserX size={11} />
                    </span>
                  )}
                  <a
                    href={`/${article.core_id}/${article.bridge_id}/${article.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="view on site"
                  >
                    <ExternalLink size={10} />
                  </a>
                </button>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-border/30 px-5 py-4 space-y-4">
                    {/* Identifiers */}
                    <div>
                      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-3">identifiers</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="article id" value={<span className="font-mono">{article.article_id}</span>} />
                        <Field label="content type" value={article.content_type} />
                        <Field label="primary keyword" value={article.primary_keyword} />
                        <Field label="slug" value={<span className="font-mono">{article.slug}</span>} />
                        <Field label="core" value={<span className="font-mono">{article.core_id}</span>} />
                        <Field label="bridge" value={<span className="font-mono">{article.bridge_id}</span>} />
                        <Field label="core article" value={article.is_core_article ? "yes" : "no"} />
                        <Field label="link status" value={<StatusBadge status={article.link_status} />} />
                      </div>
                    </div>

                    {/* SEO */}
                    <div>
                      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-3">seo</p>
                      <div className="space-y-2">
                        <Field label="h1 title" value={article.h1_title} />
                        <Field label="meta title" value={article.meta_title} />
                        <Field label="meta description" value={article.meta_description} />
                        <Field label="og title" value={article.og_title} />
                        <Field label="og description" value={article.og_description} />
                        <Field label="canonical url" value={article.canonical_url} />
                        <Field label="robots" value={article.robots_directive} />
                        <Field label="schema type" value={article.schema_type} />

                        {/* Author assignment */}
                        <div>
                          <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">author</p>
                          {teamMembers.length === 0 ? (
                            <p className="text-xs font-light text-muted-foreground italic">
                              add team members in site settings first
                            </p>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={getAuthorValue(article)}
                                onChange={(e) => saveAuthor(article, e.target.value)}
                                disabled={authorState[article.id]?.saving}
                                className="flex-1 text-xs font-light rounded-md border border-border px-2 py-1.5 bg-background text-foreground focus:outline-none focus:border-foreground/50 disabled:opacity-50"
                              >
                                <option value="">— no author —</option>
                                {teamMembers.map((m) => (
                                  <option key={m.name} value={m.name}>{m.name}{m.role ? ` — ${m.role}` : ""}</option>
                                ))}
                              </select>
                              {authorState[article.id]?.saving && (
                                <span className="text-[10px] text-muted-foreground">saving…</span>
                              )}
                              {authorState[article.id]?.saved && (
                                <Check size={12} className="text-green-500 shrink-0" />
                              )}
                              {authorState[article.id]?.error && (
                                <span className="text-[10px] text-red-500">{authorState[article.id].error}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-2">body</p>
                      <div className="bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto">
                        <pre className="text-[10px] font-light text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {article.body_markdown}
                        </pre>
                      </div>
                    </div>

                    {/* Structured data */}
                    <div className="space-y-3">
                      <JsonField label="table of contents" value={article.table_of_contents} />
                      <JsonField label="internal links" value={article.internal_links_injected} />
                      <JsonField label="related articles" value={article.related_articles} />
                      <JsonField label="external links" value={article.external_links} />
                      <JsonField label="schema markup" value={article.schema_markup} />
                    </div>

                    {/* Timestamps */}
                    <div>
                      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-2">timestamps</p>
                      <div className="space-y-2">
                        <Field label="published" value={formatDate(article.published_at)} />
                        <Field label="generated" value={formatDate(article.generated_at)} />
                        <Field label="updated" value={formatDate(article.updated_at)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
