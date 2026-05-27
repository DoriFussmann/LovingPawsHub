import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ArticlePromptConfig,
  defaultArticleConfig,
  interpolate,
  ARTICLE_SETTINGS_KEY,
  WRITING_STYLES,
  pickWritingStyle,
  DEFAULT_TYPE_ADDONS,
} from "@/lib/promptTemplates";

// Word count targets per content type — mirrors DEFAULT_TYPE_ADDONS descriptions
const WORD_TARGETS: Record<string, { min: number; max: number }> = {
  CORE:       { min: 2500, max: 4000 },
  HUB:        { min: 500,  max: 800  },
  FAQ:        { min: 800,  max: 1200 },
  COMPARISON: { min: 1000, max: 1500 },
  RISK:       { min: 800,  max: 1200 },
  GUIDE:      { min: 1200, max: 1800 },
};

interface ArticleOutput {
  article_id: string;
  h1_title: string;
  table_of_contents: Array<{ heading_level: string; text: string; anchor: string }>;
  body_markdown: string;
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  schema_type: string;
  schema_markup: Record<string, unknown>;
  key_highlights: string[];
  related_articles: Array<{ article_id: string; title: string; slug: string }>;
  external_links: Array<{ url: string; anchor: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const { article_id } = await request.json();
    if (!article_id) {
      return NextResponse.json({ error: "article_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the existing article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("article_id", article_id)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: "article not found" }, { status: 404 });
    }

    const contentType = article.content_type as string;
    const target = WORD_TARGETS[contentType];

    // Fetch the linked skeleton (may be null for older articles)
    const { data: skeleton } = article.skeleton_id
      ? await supabase
          .from("article_skeletons")
          .select("*")
          .eq("id", article.skeleton_id)
          .single()
      : { data: null };

    // Resolve core/bridge keyword text
    const { data: coreKw } = await supabase
      .from("core_keywords")
      .select("keyword")
      .eq("core_id", article.core_id)
      .maybeSingle();

    const { data: bridgeKw } = await supabase
      .from("bridge_keywords")
      .select("keyword")
      .eq("bridge_id", article.bridge_id)
      .maybeSingle();

    const coreKeyword = (coreKw?.keyword as string) ?? article.core_id;
    const bridgeKeyword = (bridgeKw?.keyword as string) ?? article.bridge_id;

    // Fetch sibling articles for internal linking context
    const { data: siblings } = await supabase
      .from("articles")
      .select("article_id, h1_title, slug")
      .eq("core_id", article.core_id)
      .eq("bridge_id", article.bridge_id)
      .eq("status", "published")
      .neq("article_id", article_id)
      .limit(10);

    // Fetch resources
    const { data: resources } = await supabase
      .from("resources")
      .select("url, title, notes")
      .limit(10);

    // Fetch site config
    const { data: siteConfigRow } = await supabase
      .from("site_config")
      .select("industry_name")
      .limit(1)
      .maybeSingle();
    const industryName = (siteConfigRow?.industry_name as string) || "";

    const siblingContext = (siblings ?? [])
      .map((s) => `- ${s.h1_title} (/${article.core_id}/${article.bridge_id}/${s.slug}/)`)
      .join("\n") || "none";

    const resourceContext = (resources ?? [])
      .map((r) => r.url ?? r.title ?? "")
      .filter(Boolean)
      .join(", ") || "none";

    // Word count target — use type target if available, otherwise skeleton suggestion
    const wordCountMin = target?.min ?? (skeleton?.suggested_word_count_min as number) ?? 800;
    const wordCountMax = target?.max ?? (skeleton?.suggested_word_count_max as number) ?? 1800;

    // Current word count for context
    const currentWordCount = article.body_markdown
      ? article.body_markdown.trim().split(/\s+/).filter(Boolean).length
      : 0;

    // Build skeleton-like context (use existing skeleton or synthesise from article)
    const skeletonContext = skeleton
      ? JSON.stringify(skeleton, null, 2)
      : JSON.stringify({
          article_id: article.article_id,
          content_type: article.content_type,
          primary_keyword: article.primary_keyword,
          slug: article.slug,
          h1_suggestion: article.h1_title,
          meta_title: article.meta_title,
          meta_description: article.meta_description,
          suggested_word_count_min: wordCountMin,
          suggested_word_count_max: wordCountMax,
          schema_type: article.schema_type ?? "Article",
        }, null, 2);

    // Type-specific instruction addon
    const typeAddon = DEFAULT_TYPE_ADDONS[contentType] ?? "";

    // Load prompt config from DB
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", ARTICLE_SETTINGS_KEY)
      .maybeSingle();

    const promptConfig: ArticlePromptConfig =
      (settingsRow?.value as ArticlePromptConfig) ?? defaultArticleConfig();

    const writingStyleKey = pickWritingStyle(article.article_id as string);
    const writingStyleText = WRITING_STYLES[writingStyleKey];

    // Augment the user prompt with explicit rewrite instruction
    const rewritePrefix = `REWRITE TASK: This article currently has ${currentWordCount} words and must reach a MINIMUM of ${wordCountMin} words (target range ${wordCountMin}–${wordCountMax} words).

ARTICLE TYPE: ${contentType}
TYPE REQUIREMENTS: ${typeAddon}

Expand and enrich the content — add more depth, examples, expert insights, and actionable detail to every section. Do NOT pad with filler. Every added word must earn its place. Keep the same primary topic and keyword focus.

`;

    const vars: Record<string, string> = {
      skeleton_json: skeletonContext,
      industry_name: industryName,
      core_keyword: coreKeyword,
      bridge_keyword: bridgeKeyword,
      resources: resourceContext,
      siblings: siblingContext,
      word_count_min: String(wordCountMin),
      article_id: article.article_id,
      schema_type: (article.schema_type as string) ?? skeleton?.schema_type ?? "Article",
      current_year: String(new Date().getFullYear()),
      writing_style: writingStyleText,
    };

    const systemPrompt = interpolate(promptConfig.systemPrompt, vars);
    const userPrompt = rewritePrefix + interpolate(promptConfig.userPromptTemplate, vars);

    const articleOutput = await callClaudeJSON<ArticleOutput>(systemPrompt, userPrompt, 16000);

    // Update the article — preserve status, internal_links_injected, image, and reviewer
    const { data: saved, error: saveError } = await supabase
      .from("articles")
      .update({
        h1_title: articleOutput.h1_title,
        body_markdown: articleOutput.body_markdown,
        table_of_contents: articleOutput.table_of_contents,
        meta_title: articleOutput.meta_title,
        meta_description: articleOutput.meta_description,
        og_title: articleOutput.og_title,
        og_description: articleOutput.og_description,
        schema_markup: articleOutput.schema_markup,
        key_highlights: articleOutput.key_highlights ?? [],
        related_articles: articleOutput.related_articles,
        external_links: articleOutput.external_links,
        updated_at: new Date().toISOString(),
      })
      .eq("article_id", article_id)
      .select()
      .single();

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    const newWordCount = articleOutput.body_markdown
      ? articleOutput.body_markdown.trim().split(/\s+/).filter(Boolean).length
      : 0;

    return NextResponse.json({
      article: saved,
      stats: {
        before: currentWordCount,
        after: newWordCount,
        target_min: wordCountMin,
        gap_before: currentWordCount - wordCountMin,
        gap_after: newWordCount - wordCountMin,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
