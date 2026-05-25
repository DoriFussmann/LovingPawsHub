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
} from "@/lib/promptTemplates";
import { fetchImageForArticle } from "@/lib/image-provider";


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
  internal_links_injected: Array<{ anchor_phrase: string; target_slug: string; found: boolean }>;
  key_highlights: string[];
  related_articles: Array<{ article_id: string; title: string; slug: string }>;
  external_links: Array<{ url: string; anchor: string }>;
}

export async function GET(request: NextRequest) {
  const skeletonId = request.nextUrl.searchParams.get("skeleton_id");
  if (!skeletonId) return NextResponse.json({ error: "skeleton_id required" }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const { data: skeleton } = await supabase
      .from("article_skeletons")
      .select("*, articles(*)")
      .eq("id", skeletonId)
      .single();

    if (!skeleton) return NextResponse.json({ error: "not found" }, { status: 404 });

    const article = Array.isArray(skeleton.articles) ? skeleton.articles[0] : skeleton.articles;
    return NextResponse.json({ article: article ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { skeleton_id } = await request.json();
    if (!skeleton_id) {
      return NextResponse.json({ error: "skeleton_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch skeleton with full context
    const { data: skeleton } = await supabase
      .from("article_skeletons")
      .select(`
        *,
        clusters(
          cluster_id,
          bridge_keywords(
            keyword, bridge_id,
            core_keywords(keyword, core_id)
          )
        )
      `)
      .eq("id", skeleton_id)
      .single();

    if (!skeleton) {
      return NextResponse.json({ error: "skeleton not found" }, { status: 404 });
    }

    const cluster = skeleton.clusters as Record<string, unknown>;
    const bridge = cluster?.bridge_keywords as Record<string, unknown>;
    const core = bridge?.core_keywords as Record<string, unknown>;

    const coreId = (core?.core_id as string) ?? "";
    const bridgeId = (bridge?.bridge_id as string) ?? "";
    const coreKeyword = (core?.keyword as string) ?? "";
    const bridgeKeyword = (bridge?.keyword as string) ?? "";

    // Fetch published siblings for context
    const { data: siblings } = await supabase
      .from("articles")
      .select("article_id, h1_title, slug")
      .eq("core_id", coreId)
      .eq("bridge_id", bridgeId)
      .eq("status", "published")
      .limit(10);

    // Fetch resources
    const { data: resources } = await supabase
      .from("resources")
      .select("url, title, notes")
      .limit(10);

    // Fetch site config for industry name and image provider
    const { data: siteConfigRow } = await supabase
      .from("site_config")
      .select("industry_name, image_provider")
      .limit(1)
      .maybeSingle();
    const industryName = (siteConfigRow?.industry_name as string) || process.env.NEXT_PUBLIC_INDUSTRY_NAME || "";
    const siblingContext = (siblings ?? [])
      .map((s) => `- ${s.h1_title} (/${coreId}/${bridgeId}/${s.slug}/)`)
      .join("\n") || "none yet";

    const resourceContext = (resources ?? [])
      .map((r) => r.url ?? r.title ?? "")
      .filter(Boolean)
      .join(", ") || "none";

    // Load prompt config from DB (fall back to defaults)
    const supabase2 = createServiceClient();
    const { data: settingsRow } = await supabase2
      .from("settings")
      .select("value")
      .eq("key", ARTICLE_SETTINGS_KEY)
      .maybeSingle();

    const promptConfig: ArticlePromptConfig =
      (settingsRow?.value as ArticlePromptConfig) ?? defaultArticleConfig();

    const writingStyleKey = pickWritingStyle(skeleton.article_id as string);
    const writingStyleText = WRITING_STYLES[writingStyleKey];

    const vars: Record<string, string> = {
      skeleton_json: JSON.stringify(skeleton, null, 2),
      industry_name: industryName,
      core_keyword: coreKeyword,
      bridge_keyword: bridgeKeyword,
      resources: resourceContext,
      siblings: siblingContext,
      word_count_min: String(skeleton.suggested_word_count_min ?? 800),
      article_id: skeleton.article_id,
      schema_type: skeleton.schema_type ?? "Article",
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
      articleOutput.h1_title || skeleton.primary_keyword
    );

    // internal_links_injected starts empty — Wire Cluster populates it after
    // all articles in the cluster are published and real slugs are known.
    // Trying to plan links at brief-generation time causes hallucinated slugs.

    // Ensure the slug is unique within (core_id, bridge_id).
    // Claude often gives the same slug to the HUB, FAQ, and Guide articles in a
    // cluster. Check for an existing article with this slug (excluding the
    // current article_id in case this is a re-generation) and append the
    // content-type suffix if there is a collision.
    let finalSlug = skeleton.slug as string;
    if (finalSlug && coreId && bridgeId) {
      const { data: existing } = await supabase
        .from("articles")
        .select("article_id")
        .eq("core_id", coreId)
        .eq("bridge_id", bridgeId)
        .eq("slug", finalSlug)
        .neq("article_id", skeleton.article_id)
        .limit(1);

      if (existing && existing.length > 0) {
        const suffix = (skeleton.content_type as string ?? "article").toLowerCase();
        finalSlug = `${finalSlug}-${suffix}`;
      }
    }

    // Save to articles table
    const { data: saved, error: saveError } = await supabase
      .from("articles")
      .upsert(
        {
          skeleton_id,
          article_id: skeleton.article_id,
          content_type: skeleton.content_type,
          is_core_article: skeleton.is_core_article,
          primary_keyword: skeleton.primary_keyword,
          slug: finalSlug,
          core_id: coreId,
          bridge_id: bridgeId,
          h1_title: articleOutput.h1_title,
          body_markdown: articleOutput.body_markdown,
          table_of_contents: articleOutput.table_of_contents,
          meta_title: articleOutput.meta_title,
          meta_description: articleOutput.meta_description,
          og_title: articleOutput.og_title,
          og_description: articleOutput.og_description,
          schema_markup: articleOutput.schema_markup,
          internal_links_injected: [],
          key_highlights: articleOutput.key_highlights ?? [],
          related_articles: articleOutput.related_articles,
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

    // Update skeleton status
    await supabase
      .from("article_skeletons")
      .update({ status: "drafted" })
      .eq("id", skeleton_id);

    return NextResponse.json({ article: saved });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
