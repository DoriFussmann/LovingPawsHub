"use client";

import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import {
  PromptConfig,
  ArticlePromptConfig,
  CoreArticlePromptConfig,
  defaultConfig,
  defaultArticleConfig,
  defaultCoreArticleConfig,
  extractVariables,
  saveSettingsToDB,
  SKELETON_SETTINGS_KEY,
  ARTICLE_SETTINGS_KEY,
  CORE_ARTICLE_SETTINGS_KEY,
} from "@/lib/promptTemplates";

// ── Skeleton variant ──────────────────────────────────────────────────────────

interface SkeletonModalProps {
  variant: "skeleton";
  config: PromptConfig;
  onSave: (config: PromptConfig) => void;
  onClose: () => void;
}

// ── Article variant ───────────────────────────────────────────────────────────

interface ArticleModalProps {
  variant: "article";
  config: ArticlePromptConfig;
  onSave: (config: ArticlePromptConfig) => void;
  onClose: () => void;
}

// ── Core article variant ──────────────────────────────────────────────────────

interface CoreArticleModalProps {
  variant: "core_article";
  config: CoreArticlePromptConfig;
  onSave: (config: CoreArticlePromptConfig) => void;
  onClose: () => void;
}

type Props = SkeletonModalProps | ArticleModalProps | CoreArticleModalProps;

// ── Shared helpers ────────────────────────────────────────────────────────────

const TYPE_ORDER = ["CORE", "HUB", "FAQ", "COMPARISON", "RISK", "GUIDE"];

function VariablePills({ template }: { template: string }) {
  const vars = extractVariables(template);
  if (vars.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {vars.map((v) => (
        <span
          key={v}
          className="inline-flex items-center px-2 py-0.5 text-[9px] font-mono tracking-wide rounded border border-border bg-muted/60 text-foreground/60"
        >
          {"{{"}{v}{"}}"}
        </span>
      ))}
    </div>
  );
}

function PromptTextarea({
  label,
  description,
  value,
  onChange,
  rows = 12,
}: {
  label?: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      {label && (
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">{label}</p>
      )}
      {description && (
        <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">{description}</p>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full text-xs font-mono font-light rounded-md border border-border px-3 py-2.5 bg-background focus:outline-none focus:border-foreground/50 resize-y leading-relaxed"
      />
      <VariablePills template={value} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PromptControlsModal(props: Props) {
  const isSkeleton = props.variant === "skeleton";
  const isCoreArticle = props.variant === "core_article";

  const [draft, setDraft] = useState(
    JSON.parse(JSON.stringify(props.config)) as typeof props.config
  );
  const [activeTab, setActiveTab] = useState<string>("system prompt");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const tabs = isSkeleton
    ? ["system prompt", "user prompt", "type add-ons"]
    : ["system prompt", "user prompt"];

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const key = isSkeleton
        ? SKELETON_SETTINGS_KEY
        : isCoreArticle
        ? CORE_ARTICLE_SETTINGS_KEY
        : ARTICLE_SETTINGS_KEY;
      await saveSettingsToDB(key, draft);
      (props.onSave as (c: typeof draft) => void)(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("save failed — check connection");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (isSkeleton) {
      setDraft(defaultConfig() as typeof draft);
    } else if (isCoreArticle) {
      setDraft(defaultCoreArticleConfig() as typeof draft);
    } else {
      setDraft(defaultArticleConfig() as typeof draft);
    }
  }

  const skeletonDraft = draft as PromptConfig;
  const articleDraft = draft as ArticlePromptConfig;
  const coreArticleDraft = draft as CoreArticlePromptConfig;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-start justify-center z-50 pt-16 px-4">
      <div className="bg-background border border-border rounded-md w-full max-w-3xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">
              {isSkeleton ? "skeletons" : isCoreArticle ? "core articles" : "articles"}
            </p>
            <h2 className="text-sm font-light text-foreground">prompt controls</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={11} />
              reset to defaults
            </button>
            <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 gap-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 text-[10px] tracking-widest uppercase transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {activeTab === "system prompt" && (
            <PromptTextarea
              description={
                isSkeleton
                  ? `Sets Claude's persona and output format for skeleton generation. {{type_addon}} is replaced with the per-type instruction before each call.`
                  : isCoreArticle
                  ? `Sets Claude's persona and output format for core pillar article generation. This article establishes topical authority for the entire core keyword.`
                  : `Sets Claude's persona and output format for article writing. Keep this focused on quality and output format.`
              }
              value={
                isSkeleton
                  ? skeletonDraft.systemPrompt
                  : isCoreArticle
                  ? coreArticleDraft.systemPrompt
                  : articleDraft.systemPrompt
              }
              onChange={(v) => setDraft({ ...draft, systemPrompt: v } as typeof draft)}
              rows={10}
            />
          )}

          {activeTab === "user prompt" && (
            <PromptTextarea
              description={
                isSkeleton
                  ? `The generation instruction sent per skeleton. All {{variables}} are interpolated from cluster context before the API call.`
                  : isCoreArticle
                  ? `The writing instruction for core pillar articles. Available variables: {{core_keyword}}, {{industry_name}}, {{h1_title}}, {{word_count}}, {{notes}}, {{related_topics}}, {{resources}}, {{article_id}}.`
                  : `The writing instruction sent per article. {{skeleton_json}} injects the full skeleton brief. All other {{variables}} are filled from context.`
              }
              value={
                isSkeleton
                  ? skeletonDraft.userPromptTemplate
                  : isCoreArticle
                  ? coreArticleDraft.userPromptTemplate
                  : articleDraft.userPromptTemplate
              }
              onChange={(v) =>
                setDraft({ ...draft, userPromptTemplate: v } as typeof draft)
              }
              rows={22}
            />
          )}

          {activeTab === "type add-ons" && isSkeleton && (
            <div className="space-y-5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Injected into the system prompt via{" "}
                <code className="text-[9px] bg-muted px-1 py-0.5 rounded">{"{{type_addon}}"}</code>{" "}
                when generating that article type. Each call gets only its type&apos;s add-on.
              </p>
              {TYPE_ORDER.map((type) => (
                <PromptTextarea
                  key={type}
                  label={type}
                  value={skeletonDraft.typeAddons[type] ?? ""}
                  onChange={(v) =>
                    setDraft({
                      ...skeletonDraft,
                      typeAddons: { ...skeletonDraft.typeAddons, [type]: v },
                    } as typeof draft)
                  }
                  rows={4}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            {saveError
              ? <span className="text-red-500">{saveError}</span>
              : "changes are saved to the database — apply on all machines"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={props.onClose}
              className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted"
            >
              cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
            >
              {saving ? "saving..." : saved ? "saved ✓" : "save prompts"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
