"use client";

import { useState } from "react";
import { FileText, ExternalLink, RefreshCw, Zap, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CoreKeywordData, CoreArticleData } from "./page";

interface Props {
  keywords: CoreKeywordData[];
  articlesByCore: Record<string, CoreArticleData | null>;
}

const WORD_COUNT_OPTIONS = [1500, 2000, 2500, 3000];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    drafted: "bg-amber-50 text-amber-600 border-amber-200",
    reviewed: "bg-blue-50 text-blue-600 border-blue-200",
    published: "bg-emerald-50 text-emerald-600 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function WordCount({ body }: { body: string }) {
  const count = body.trim().split(/\s+/).filter(Boolean).length;
  return <span className="text-[10px] text-muted-foreground font-mono">{count.toLocaleString()} words</span>;
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] tracking-widest uppercase text-foreground/35 font-medium pt-0.5">{label}</span>
      <span className="text-xs font-light text-foreground/80 leading-relaxed break-words">{value}</span>
    </div>
  );
}

function FieldsPanel({ article }: { article: CoreArticleData }) {
  const [open, setOpen] = useState(false);
  const wordCount = article.body_markdown.trim().split(/\s+/).filter(Boolean).length;
  const tocCount = article.table_of_contents?.length ?? 0;
  const extCount = article.external_links?.length ?? 0;

  return (
    <div className="border border-border/40 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <span className="text-[10px] tracking-widest uppercase text-foreground/40">fields</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-light">
            {wordCount.toLocaleString()} words · {tocCount} headings · {extCount} external links
          </span>
          {open ? <ChevronDown size={12} className="text-foreground/40" /> : <ChevronRight size={12} className="text-foreground/40" />}
        </div>
      </button>
      {open && (
        <div className="px-4 py-2">
          <FieldRow label="article id"      value={article.article_id} />
          <FieldRow label="primary keyword" value={article.primary_keyword} />
          <FieldRow label="slug"            value={`/${article.core_id}/${article.bridge_id}/${article.slug}/`} />
          <FieldRow label="status"          value={article.status} />
          <FieldRow label="link status"     value={article.link_status} />
          <FieldRow label="meta title"      value={article.meta_title} />
          <FieldRow label="meta description" value={article.meta_description} />
          <FieldRow label="og title"        value={article.og_title} />
          <FieldRow label="og description"  value={article.og_description} />
          <FieldRow label="schema type"     value={article.schema_markup?.["@type"] as string} />
          <FieldRow label="published"       value={article.published_at ? new Date(article.published_at).toLocaleString() : "not published"} />
          <FieldRow label="last updated"    value={article.updated_at ? new Date(article.updated_at).toLocaleString() : undefined} />
          {(article.external_links ?? []).length > 0 && (
            <div className="grid grid-cols-[160px_1fr] gap-3 py-2">
              <span className="text-[10px] tracking-widest uppercase text-foreground/35 font-medium pt-0.5">external links</span>
              <div className="space-y-1">
                {article.external_links!.map((l, i) => (
                  <div key={i} className="text-[11px] font-light">
                    <span className="text-foreground/50">{l.anchor}</span>
                    <span className="text-foreground/30 mx-1">→</span>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-500/70 underline underline-offset-2 break-all">{l.url}</a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArticlePreview({ body }: { body: string }) {
  return (
    <div className="border border-border/40 rounded-md overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/20 border-b border-border/40">
        <span className="text-[10px] tracking-widest uppercase text-foreground/40">article preview</span>
      </div>
      <div className="px-6 py-5 max-h-[600px] overflow-y-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="text-xl font-light mt-6 mb-3 text-foreground">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-light mt-6 mb-2 text-foreground border-b border-border/20 pb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-light mt-4 mb-1.5 text-foreground">{children}</h3>,
            p: ({ children }) => <p className="text-sm font-light leading-relaxed mb-3 text-foreground/80">{children}</p>,
            a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-500/80 underline underline-offset-2">{children}</a>,
            ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-sm font-light text-foreground/80">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-sm font-light text-foreground/80">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-normal text-foreground">{children}</strong>,
            table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full text-sm font-light border-collapse">{children}</table></div>,
            th: ({ children }) => <th className="text-left px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground/40 border-b border-border">{children}</th>,
            td: ({ children }) => <td className="px-3 py-1.5 border-b border-border/20 text-foreground/80">{children}</td>,
            blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-4 text-muted-foreground italic my-3">{children}</blockquote>,
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function CoreArticlesClient({ keywords, articlesByCore }: Props) {
  const [selectedCoreId, setSelectedCoreId] = useState<string | null>(
    keywords[0]?.core_id ?? null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [localArticles, setLocalArticles] = useState<Record<string, CoreArticleData | null>>(articlesByCore);
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [generateError, setGenerateError] = useState("");

  // Generate form state
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [wordCount, setWordCount] = useState(2000);

  const selectedKeyword = keywords.find((k) => k.core_id === selectedCoreId);
  const selectedArticle = selectedCoreId ? localArticles[selectedCoreId] : null;

  function handleSelectKeyword(coreId: string) {
    const kw = keywords.find((k) => k.core_id === coreId);
    setSelectedCoreId(coreId);
    setDetailOpen(false);
    setGenerateError("");
    if (kw && !localArticles[coreId]) {
      setTitle(`${kw.keyword}: The Complete Guide`);
    }
  }

  async function handleGenerate() {
    if (!selectedKeyword) return;
    setGenerating(true);
    setGenerateError("");
    setElapsed(0);

    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const res = await fetch("/api/generate-core-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          core_keyword_id: selectedKeyword.id,
          title: title || `${selectedKeyword.keyword}: The Complete Guide`,
          notes,
          word_count: wordCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? "generation failed");
      } else {
        setLocalArticles((prev) => ({
          ...prev,
          [selectedCoreId!]: data.article as CoreArticleData,
        }));
        setTitle("");
        setNotes("");
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "generation failed");
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  async function handlePublish(article: CoreArticleData) {
    const newStatus = article.status === "published" ? "drafted" : "published";
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: article.article_id, action: newStatus === "published" ? "publish" : "unpublish" }),
      });
      if (res.ok) {
        setLocalArticles((prev) => ({
          ...prev,
          [article.core_id]: { ...article, status: newStatus },
        }));
      }
    } catch { /* non-fatal */ }
  }

  if (keywords.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">no core keywords found — add them in research first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Keyword chips */}
      <div>
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-3">core topics</p>
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => {
            const hasArticle = !!localArticles[kw.core_id];
            const isSelected = selectedCoreId === kw.core_id;
            return (
              <button
                key={kw.core_id}
                onClick={() => handleSelectKeyword(kw.core_id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                  isSelected
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-foreground/70 hover:border-foreground/40 hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {hasArticle && localArticles[kw.core_id]?.status === "published" && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
                )}
                {hasArticle && localArticles[kw.core_id]?.status === "drafted" && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
                )}
                {kw.keyword}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedKeyword && (
        <div className="border border-border rounded-md overflow-hidden">
          {/* Panel header — acts as collapsible toggle */}
          <button
            onClick={() => setDetailOpen((o) => !o)}
            className="w-full px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              {detailOpen
                ? <ChevronDown size={13} className="text-foreground/40" />
                : <ChevronRight size={13} className="text-foreground/40" />}
              <div className="text-left">
                <p className="text-[10px] tracking-widests uppercase text-foreground/40">core pillar article</p>
                <p className="text-sm font-light text-foreground mt-0.5">{selectedKeyword.keyword}</p>
              </div>
            </div>
            {selectedArticle && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <StatusBadge status={selectedArticle.status} />
                <a
                  href={`/${selectedArticle.core_id}/${selectedArticle.bridge_id}/${selectedArticle.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink size={10} />
                  view
                </a>
              </div>
            )}
          </button>

          {/* Body — only shown when expanded */}
          {detailOpen && (selectedArticle ? (
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-light text-foreground leading-snug">{selectedArticle.h1_title}</h2>
                  {selectedArticle.meta_description && (
                    <p className="text-[11px] font-light text-muted-foreground mt-1 leading-relaxed">
                      {selectedArticle.meta_description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <WordCount body={selectedArticle.body_markdown} />
                    <span className="text-[10px] text-muted-foreground font-mono">/{selectedArticle.core_id}/{selectedArticle.bridge_id}/{selectedArticle.slug}/</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handlePublish(selectedArticle)}
                  className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                    selectedArticle.status === "published"
                      ? "border-border text-foreground/70 hover:bg-muted"
                      : "bg-foreground text-background border-foreground hover:opacity-80"
                  }`}
                >
                  {selectedArticle.status === "published" ? "unpublish" : "publish"}
                </button>
                <button
                  onClick={() => {
                    setTitle(selectedArticle.h1_title);
                    setLocalArticles((prev) => ({ ...prev, [selectedKeyword.core_id]: null }));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-border text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                >
                  <RefreshCw size={11} />
                  regenerate
                </button>
              </div>

              {/* Fields panel — collapsed by default */}
              <FieldsPanel article={selectedArticle} />

              {/* Rendered article */}
              <ArticlePreview body={selectedArticle.body_markdown} />
            </div>
          ) : generating ? (
            /* Generation in progress overlay */
            <div className="px-5 py-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <Zap size={14} className="text-blue-500 animate-pulse" />
                <p className="text-sm font-light text-foreground">generating core article...</p>
              </div>
              <p className="text-[10px] font-mono text-blue-400">{elapsed}s elapsed</p>
              <div className="w-64 h-0.5 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(90, (elapsed / 240) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center max-w-xs">
                claude is writing a comprehensive pillar article — typically 2–4 min for 3,000 words
              </p>
            </div>
          ) : (
            /* Generate form */
            <div className="px-5 py-5 space-y-4">
              <p className="text-[11px] font-light text-muted-foreground">
                no core article exists yet for <strong className="font-normal text-foreground">{selectedKeyword.keyword}</strong>. generate a comprehensive pillar article below.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1.5 block">
                    h1 title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`${selectedKeyword.keyword}: The Complete Guide`}
                    className="w-full text-xs font-light rounded-md border border-border px-3 py-2.5 bg-background focus:outline-none focus:border-foreground/50"
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1.5 block">
                    additional notes for claude <span className="normal-case text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. focus on small business owners, include regulatory considerations, emphasise comparison with alternatives..."
                    className="w-full text-xs font-light rounded-md border border-border px-3 py-2.5 bg-background focus:outline-none focus:border-foreground/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1.5 block">
                    target word count
                  </label>
                  <div className="flex gap-2">
                    {WORD_COUNT_OPTIONS.map((wc) => (
                      <button
                        key={wc}
                        onClick={() => setWordCount(wc)}
                        className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                          wordCount === wc
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-foreground/70 hover:bg-muted"
                        }`}
                      >
                        {wc.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {generateError && (
                <p className="text-[11px] text-red-500">{generateError}</p>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-xs font-light rounded-md border bg-foreground text-background border-foreground hover:opacity-80 disabled:opacity-50 transition-opacity"
              >
                <FileText size={12} />
                generate core article
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
