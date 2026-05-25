"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import StatusBadge from "./StatusBadge";

interface SkeletonData {
  article_id: string;
  content_type: string;
  is_core_article: boolean;
  primary_keyword: string;
  slug: string;
  h1_suggestion?: string;
  meta_title?: string;
  meta_description?: string;
  key_messages?: string[];
  suggested_word_count_min?: number;
  suggested_word_count_max?: number;
  internal_link_targets?: Array<{
    article_id: string;
    slug: string;
    anchor_phrase: string;
    direction: string;
  }>;
  schema_type?: string;
}

interface SkeletonCardProps {
  skeleton: SkeletonData;
  onChange?: (updated: SkeletonData) => void;
  saved?: boolean;
}

export default function SkeletonCard({ skeleton, onChange, saved }: SkeletonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(skeleton);

  function update(field: keyof SkeletonData, value: unknown) {
    const updated = { ...data, [field]: value };
    setData(updated);
    onChange?.(updated);
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={data.content_type.toLowerCase()} />
          {data.is_core_article && <StatusBadge status="core" />}
          <span className="text-xs font-light text-foreground">{data.primary_keyword}</span>
          <span className="text-[10px] text-muted-foreground">{data.article_id}</span>
        </div>
        <div className="flex items-center gap-3">
          {data.suggested_word_count_min && (
            <span className="text-[10px] text-muted-foreground">
              {data.suggested_word_count_min}–{data.suggested_word_count_max} words
            </span>
          )}
          {saved && (
            <span className="text-[9px] tracking-widest uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              saved
            </span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-4 py-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
                h1 suggestion
              </label>
              <input
                type="text"
                value={data.h1_suggestion ?? ""}
                onChange={(e) => update("h1_suggestion", e.target.value)}
                className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
                slug
              </label>
              <input
                type="text"
                value={data.slug}
                onChange={(e) => update("slug", e.target.value)}
                className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
              meta title
            </label>
            <input
              type="text"
              value={data.meta_title ?? ""}
              onChange={(e) => update("meta_title", e.target.value)}
              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
            />
            <span className="text-[10px] text-muted-foreground">
              {(data.meta_title ?? "").length}/60 chars
            </span>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
              meta description
            </label>
            <textarea
              value={data.meta_description ?? ""}
              onChange={(e) => update("meta_description", e.target.value)}
              rows={2}
              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
            />
            <span className="text-[10px] text-muted-foreground">
              {(data.meta_description ?? "").length}/155 chars
            </span>
          </div>

          {data.key_messages && data.key_messages.length > 0 && (
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
                key messages
              </label>
              <ul className="space-y-1">
                {data.key_messages.map((msg, i) => (
                  <li key={i} className="text-xs font-light text-foreground/80 flex gap-2">
                    <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.internal_link_targets && data.internal_link_targets.length > 0 && (
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
                internal link targets
              </label>
              <div className="space-y-1">
                {data.internal_link_targets.map((link, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs font-light text-foreground/70">
                    <span className="text-muted-foreground">{link.direction}</span>
                    <span className="text-foreground">&ldquo;{link.anchor_phrase}&rdquo;</span>
                    <span className="text-muted-foreground">→ {link.slug}</span>
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
