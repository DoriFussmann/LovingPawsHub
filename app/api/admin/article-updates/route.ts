import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { searchGoogleNews } from "@/lib/dataforseo";
import { callClaude } from "@/lib/anthropic";
import { revalidatePath } from "next/cache";

const STALE_DAYS = 90;

function isStale(updated_at: string | null, published_at: string | null): boolean {
  const ref = updated_at ?? published_at;
  if (!ref) return true;
  return Date.now() - new Date(ref).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function stripUpdateSection(markdown: string): string {
  return markdown
    .replace(/<!-- update-section -->[\s\S]*?<!-- \/update-section -->/g, "")
    .trimEnd();
}

function buildUpdateSection(paragraph: string, newsTitle: string, newsUrl: string): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return [
    "",
    "<!-- update-section -->",
    "## Recent Update",
    "",
    `*Last updated: ${date}*`,
    "",
    paragraph,
    "",
    `**Source:** [${newsTitle}](${newsUrl})`,
    "<!-- /update-section -->",
  ].join("\n");
}

/**
 * GET /api/admin/article-updates
 * Returns all published articles with staleness status.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("id, article_id, h1_title, slug, core_id, bridge_id, key_highlights, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const articles = (data ?? []).map((a) => ({
      ...a,
      stale: isStale(a.updated_at, a.published_at),
    }));

    return NextResponse.json({ articles });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/article-updates
 * Body: { id: string, force?: boolean }
 * Runs the full update pipeline for one article.
 */
export async function POST(request: NextRequest) {
  try {
    const { id, force } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();

    // Fetch article
    const { data: article, error: fetchError } = await supabase
      .from("articles")
      .select("id, h1_title, slug, core_id, bridge_id, key_highlights, body_markdown, updated_at, published_at, primary_keyword")
      .eq("id", id)
      .single();

    if (fetchError || !article) {
      return NextResponse.json({ error: "article not found" }, { status: 404 });
    }

    // 90-day check (unless force=true)
    if (!force && !isStale(article.updated_at, article.published_at)) {
      return NextResponse.json({ skipped: true, reason: "not due — updated within 90 days" });
    }

    // Build search query from key_highlights
    const highlights: string[] = Array.isArray(article.key_highlights)
      ? (article.key_highlights as string[]).slice(0, 3)
      : [];

    const query = highlights.length > 0
      ? highlights.join(" ")
      : (article.primary_keyword as string) ?? article.h1_title;

    if (!query) {
      return NextResponse.json({ skipped: true, reason: "no search query available" });
    }

    // Search news
    const newsItems = await searchGoogleNews(query);
    if (newsItems.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no recent news found" });
    }

    const news = newsItems[0];

    // Generate update paragraph with Claude
    const systemPrompt = `You are a financial content editor. Your job is to write a brief, factual 2–3 sentence paragraph that connects a recent news story to the topic of an existing article. Write in a professional, neutral tone. Do not use phrases like "In conclusion" or "It's worth noting". Output only the paragraph text — no headings, no bullet points, no quotation marks.`;

    const userPrompt = `Article title: ${article.h1_title}

Key topics covered in the article:
${highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Recent news item:
Title: ${news.title}
Source: ${news.source}
Summary: ${news.snippet}
URL: ${news.url}

Write a 2–3 sentence paragraph that briefly mentions this news development and explains how it relates to the article's topic. Include context that would be useful to a reader of the article.`;

    const paragraph = (await callClaude(systemPrompt, userPrompt, 300)).trim();

    // Build new body_markdown
    const strippedMarkdown = stripUpdateSection(article.body_markdown ?? "");
    const newMarkdown = strippedMarkdown + buildUpdateSection(paragraph, news.title, news.url);

    // Save to DB
    const { error: updateError } = await supabase
      .from("articles")
      .update({ body_markdown: newMarkdown, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    revalidatePath(`/${article.core_id}/${article.bridge_id}/${article.slug}`);

    return NextResponse.json({
      updated: true,
      article_title: article.h1_title,
      news_title: news.title,
      news_url: news.url,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
