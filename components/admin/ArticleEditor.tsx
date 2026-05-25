"use client";

import { useState } from "react";
import { ImageIcon, RefreshCw } from "lucide-react";
import StatusBadge from "./StatusBadge";

interface InternalLink {
  anchor_phrase: string;
  target_slug: string;
  found: boolean;
}

interface ArticleEditorProps {
  article: {
    id: string;
    article_id: string;
    h1_title: string;
    meta_title?: string;
    meta_description?: string;
    og_title?: string | null;
    og_description?: string | null;
    canonical_url?: string | null;
    robots_directive?: string | null;
    body_markdown: string;
    status: string;
    link_status: string;
    reviewer_name?: string | null;
    featured_image_url?: string | null;
    featured_image_alt?: string | null;
    internal_links_injected?: InternalLink[];
    related_articles?: Array<{ article_id: string; title: string; slug: string }>;
  };
  onSave: (updated: Partial<ArticleEditorProps["article"]>) => Promise<void>;
  onPublish: (opts?: { publishedAt?: string }) => Promise<void>;
}

export default function ArticleEditor({ article, onSave, onPublish }: ArticleEditorProps) {
  const todayISO = new Date().toISOString().split("T")[0];

  const [h1, setH1] = useState(article.h1_title);
  const [metaTitle, setMetaTitle] = useState(article.meta_title ?? "");
  const [metaDesc, setMetaDesc] = useState(article.meta_description ?? "");
  const [ogTitle, setOgTitle] = useState(article.og_title ?? "");
  const [ogDesc, setOgDesc] = useState(article.og_description ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(article.canonical_url ?? "");
  const [robotsDirective, setRobotsDirective] = useState(article.robots_directive ?? "");
  const [reviewerName, setReviewerName] = useState(article.reviewer_name ?? "");
  const [body, setBody] = useState(article.body_markdown);
  const [imageUrl, setImageUrl] = useState(article.featured_image_url ?? "");
  const [imageAlt, setImageAlt] = useState(article.featured_image_alt ?? "");
  const [publishDate, setPublishDate] = useState(todayISO);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        h1_title: h1,
        meta_title: metaTitle,
        meta_description: metaDesc,
        og_title: ogTitle || null,
        og_description: ogDesc || null,
        canonical_url: canonicalUrl || null,
        robots_directive: robotsDirective || null,
        body_markdown: body,
        reviewer_name: reviewerName,
        featured_image_url: imageUrl || null,
        featured_image_alt: imageAlt || null,
      });
      setMessage("saved.");
    } catch {
      setMessage("save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage("");
    try {
      const publishedAt = publishDate ? new Date(publishDate + "T12:00:00").toISOString() : undefined;
      await onPublish({ publishedAt });
      setMessage("published.");
    } catch {
      setMessage("publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleRegenerateImage() {
    setRegeneratingImage(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: article.article_id, title: h1 }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "failed");
      if (json.url) {
        setImageUrl(json.url);
        setImageAlt(json.alt ?? h1);
        setMessage("image regenerated.");
      } else {
        setMessage("no image returned — check provider settings.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "regenerate failed.");
    } finally {
      setRegeneratingImage(false);
    }
  }

  const wordCount = body.trim().split(/\s+/).length;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={article.status} />
          <StatusBadge status={article.link_status} />
          <span className="text-[10px] text-muted-foreground">{wordCount.toLocaleString()} words</span>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs font-light text-muted-foreground">{message}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {saving ? "saving..." : "save changes"}
          </button>
          {article.status !== "published" && (
            <>
              <input
                type="date"
                value={publishDate}
                max={todayISO}
                min={(() => { const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().split("T")[0]; })()}
                onChange={(e) => setPublishDate(e.target.value)}
                title="Publish date — can be backdated up to 60 days"
                className="px-2 py-1.5 text-xs font-light rounded-md border border-border bg-background focus:outline-none focus:border-foreground/50"
              />
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50 transition-colors"
              >
                {publishing ? "publishing..." : "publish"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* SEO fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
            h1 title
          </label>
          <input
            type="text"
            value={h1}
            onChange={(e) => setH1(e.target.value)}
            className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
            meta title <span className="text-muted-foreground normal-case">{metaTitle.length}/60</span>
          </label>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
          meta description <span className="text-muted-foreground normal-case">{metaDesc.length}/155</span>
        </label>
        <textarea
          value={metaDesc}
          onChange={(e) => setMetaDesc(e.target.value)}
          rows={2}
          className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
        />
      </div>

      {/* OG overrides */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
            og title override <span className="text-muted-foreground normal-case">{ogTitle.length}/60</span>
          </label>
          <input
            type="text"
            value={ogTitle}
            onChange={(e) => setOgTitle(e.target.value)}
            placeholder="Defaults to meta title"
            className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
            robots directive
          </label>
          <select
            value={robotsDirective}
            onChange={(e) => setRobotsDirective(e.target.value)}
            className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
          >
            <option value="">index, follow (default)</option>
            <option value="noindex, follow">noindex, follow</option>
            <option value="noindex, nofollow">noindex, nofollow</option>
            <option value="index, nofollow">index, nofollow</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
          og description override <span className="text-muted-foreground normal-case">{ogDesc.length}/155</span>
        </label>
        <textarea
          value={ogDesc}
          onChange={(e) => setOgDesc(e.target.value)}
          placeholder="Defaults to meta description"
          rows={2}
          className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
        />
      </div>

      <div>
        <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
          canonical url override <span className="text-muted-foreground normal-case font-light">optional — leave blank to use the default self-referencing canonical</span>
        </label>
        <input
          type="url"
          value={canonicalUrl}
          onChange={(e) => setCanonicalUrl(e.target.value)}
          placeholder="https://..."
          className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
        />
      </div>

      <div>
        <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
          reviewer name <span className="text-muted-foreground normal-case font-light">optional — shown as &quot;reviewed by&quot;</span>
        </label>
        <input
          type="text"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          placeholder="e.g. Jane Smith, CFA"
          className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
        />
      </div>

      {/* Featured image */}
      <div>
        <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
          featured image <span className="text-muted-foreground normal-case font-light">used as article hero and OG image</span>
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="flex-1 text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
          />
          <button
            type="button"
            onClick={handleRegenerateImage}
            disabled={regeneratingImage}
            title="Re-fetch or regenerate image using current provider setting"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-border text-foreground/60 hover:border-foreground/40 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {regeneratingImage ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            regenerate
          </button>
        </div>
        <input
          type="text"
          value={imageAlt}
          onChange={(e) => setImageAlt(e.target.value)}
          placeholder="Alt text description"
          className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50 mb-2"
        />
        {imageUrl && (
          <div className="rounded-md overflow-hidden border border-border/50 w-full max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={imageAlt || "preview"} className="w-full h-auto object-cover" />
          </div>
        )}
        {!imageUrl && (
          <div className="flex items-center gap-2 text-[11px] font-light text-foreground/30">
            <ImageIcon size={12} />
            no image set — paste a URL above or use regenerate
          </div>
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
          body (markdown)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={24}
          className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50 font-mono"
        />
      </div>

      {/* Internal links preview */}
      {article.internal_links_injected && article.internal_links_injected.length > 0 && (
        <div>
          <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-2">
            internal links
          </p>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">anchor phrase</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">target</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">status</th>
                </tr>
              </thead>
              <tbody>
                {article.internal_links_injected.map((link, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0 text-xs font-light">
                    <td className="px-3 py-2">&ldquo;{link.anchor_phrase}&rdquo;</td>
                    <td className="px-3 py-2 text-muted-foreground">{link.target_slug}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={link.found ? "wired" : "broken"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Related articles */}
      {article.related_articles && article.related_articles.length > 0 && (
        <div>
          <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-2">
            related articles
          </p>
          <div className="space-y-1">
            {article.related_articles.map((r) => (
              <div key={r.article_id} className="text-xs font-light text-foreground/70 flex gap-3">
                <span className="text-muted-foreground">{r.article_id}</span>
                <span>{r.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
