import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import {
  CoreArticlePromptConfig,
  defaultCoreArticleConfig,
  interpolate,
  CORE_ARTICLE_SETTINGS_KEY,
  WRITING_STYLES,
  pickWritingStyle,
} from "@/lib/promptTemplates";
import { fetchImageForArticle } from "@/lib/image-provider";

export const maxDuration = 300;

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
  related_articles: Array<{ article_id: string; title: string; slug: string }>;
  external_links: Array<{ url: string; anchor: string }>;
}

export async function GET(request: NextRequest) {
  const coreKeywordId = request.nextUrl.searchParams.get("core_keyword_id");
  if (!coreKeywordId) {
    return NextResponse.json({ error: "core_keyword_id required" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data: kw } = await supabase
      .from("core_keywords")
      .select("id, core_id, keyword")
      .eq("id", coreKeywordId)
      .single();

    if (!kw) return NextResponse.json({ error: "core keyword not found" }, { status: 404 });

    // Core pillar articles use bridge_id = 'overview'
    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("core_id", kw.core_id)
      .eq("is_core_article", true)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ article: article ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { core_keyword_id, title, notes, word_count } = await request.json();

    if (!core_keyword_id) {
      return NextResponse.json({ error: "core_keyword_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the core keyword
    const { data: kw } = await supabase
      .from("core_keywords")
      .select("id, core_id, keyword")
      .eq("id", core_keyword_id)
      .single();

    if (!kw) {
      return NextResponse.json({ error: "core keyword not found" }, { status: 404 });
    }

    const coreId = kw.core_id as string;
    const coreKeyword = kw.keyword as string;

    // Fetch related bridge keywords for context
    const { data: bridges } = await supabase
      .from("bridge_keywords")
      .select("keyword")
      .eq("core_id", coreId)
      .limit(20);

    // Fetch resources for external link suggestions
    const { data: resources } = await supabase
      .from("resources")
      .select("url, title, notes")
      .limit(10);

    // Load prompt config
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", CORE_ARTICLE_SETTINGS_KEY)
      .maybeSingle();

    const promptConfig: CoreArticlePromptConfig =
      (settingsRow?.value as CoreArticlePromptConfig) ?? defaultCoreArticleConfig();

    // Fetch site config for industry name and image provider
    const { data: siteConfigRow } = await supabase
      .from("site_config")
      .select("industry_name, image_provider")
      .limit(1)
      .maybeSingle();
    const industryName = (siteConfigRow?.industry_name as string) || process.env.NEXT_PUBLIC_INDUSTRY_NAME || "";
    const h1Title = title || `${coreKeyword}: The Complete Guide`;
    const targetWordCount = word_count ?? 2000;

    const relatedTopics = (bridges ?? [])
      .map((b) => `- ${b.keyword}`)
      .join("\n") || "none available";

    const resourceContext = (resources ?? [])
      .map((r) => r.url ?? r.title ?? "")
      .filter(Boolean)
      .join(", ") || "none";

    // Derive article_id and slug from core_id
    const articleId = `${coreId}_core_pillar`;
    const slug = coreKeyword
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    const writingStyleKey = pickWritingStyle(articleId);
    const writingStyleText = WRITING_STYLES[writingStyleKey];

    const vars: Record<string, string> = {
      core_keyword: coreKeyword,
      industry_name: industryName,
      h1_title: h1Title,
      word_count: String(targetWordCount),
      notes: notes || "none",
      related_topics: relatedTopics,
      resources: resourceContext,
      article_id: articleId,
      current_year: String(new Date().getFullYear()),
      writing_style: writingStyleText,
    };

    const systemPrompt = interpolate(promptConfig.systemPrompt, vars);
    const userPrompt = interpolate(promptConfig.userPromptTemplate, vars);

    const articleOutput = await callClaudeJSON<ArticleOutput>(systemPrompt, userPrompt, 16000);

    // Fetch an image for the article based on the configured provider
    const imageProvider = (siteConfigRow?.image_provider as string) || "none";
    const imageResult = await fetchImageForArticle(
      imageProvider,
      articleOutput.h1_title ?? h1Title
    );

    // Ensure the 'overview' bridge_keywords row exists for this core.
    // Core pillar articles always use bridge_id = 'overview' so the URL is
    // /[core]/overview/[slug]/ rather than the redundant /[core]/[core]/[slug]/.
    await supabase.from("bridge_keywords").upsert(
      {
        core_keyword_id: kw.id,
        keyword: `${coreKeyword} Overview`,
        bridge_id: "overview",
        search_volume: 0,
        cpc: 0,
        keyword_difficulty: 0,
      },
      { onConflict: "core_keyword_id,bridge_id", ignoreDuplicates: true }
    );

    // Save — bridge_id = 'overview' is the convention for core pillar articles
    const { data: saved, error: saveError } = await supabase
      .from("articles")
      .upsert(
        {
          skeleton_id: null,
          article_id: articleId,
          content_type: "CORE",
          is_core_article: true,
          primary_keyword: coreKeyword,
          slug,
          core_id: coreId,
          bridge_id: "overview",
          h1_title: articleOutput.h1_title ?? h1Title,
          body_markdown: articleOutput.body_markdown,
          table_of_contents: articleOutput.table_of_contents,
          meta_title: articleOutput.meta_title,
          meta_description: articleOutput.meta_description,
          og_title: articleOutput.og_title,
          og_description: articleOutput.og_description,
          schema_markup: articleOutput.schema_markup,
          internal_links_injected: [],
          related_articles: [],
          external_links: articleOutput.external_links,
          featured_image_url: imageResult.url ?? null,
          featured_image_alt: imageResult.alt ?? null,
          status: "drafted",
          link_status: "unwired",
          writing_style: writingStyleKey,
        },
        { onConflict: "article_id" }
      )
      .select()
      .single();

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({ article: saved });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
