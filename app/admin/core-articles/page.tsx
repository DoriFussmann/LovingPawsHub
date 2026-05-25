import { createServiceClient } from "@/lib/supabase/server";
import CoreArticlesClient from "./CoreArticlesClient";

export const dynamic = "force-dynamic";

export interface CoreKeywordData {
  id: string;
  core_id: string;
  keyword: string;
  search_volume: number | null;
}

export interface CoreArticleData {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  status: string;
  primary_keyword: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  schema_markup: Record<string, unknown> | null;
  table_of_contents: Array<{ heading_level: string; text: string; anchor: string }> | null;
  external_links: Array<{ url: string; anchor: string }> | null;
  body_markdown: string;
  link_status: string;
  published_at: string | null;
  updated_at: string | null;
}

export default async function CoreArticlesPage() {
  let keywords: CoreKeywordData[] = [];
  const articlesByCore: Record<string, CoreArticleData | null> = {};

  try {
    const supabase = createServiceClient();

    // Fetch all core keywords
    const { data: kws } = await supabase
      .from("core_keywords")
      .select("id, core_id, keyword, search_volume")
      .order("keyword");

    keywords = (kws ?? []) as CoreKeywordData[];

    // For each core keyword, check if a core pillar article exists
    // Core articles use bridge_id = core_id as convention
    if (keywords.length > 0) {
      const coreIds = keywords.map((k) => k.core_id);
      const { data: articles } = await supabase
        .from("articles")
        .select("id, article_id, h1_title, slug, core_id, bridge_id, status, primary_keyword, meta_title, meta_description, og_title, og_description, schema_markup, table_of_contents, external_links, body_markdown, link_status, published_at, updated_at")
        .in("core_id", coreIds)
        .eq("is_core_article", true);

      for (const kw of keywords) {
        // Core articles can have bridge_id = core_id OR bridge_id = "overview"
        const art = (articles ?? []).find(
          (a) => a.core_id === kw.core_id && (a.bridge_id === kw.core_id || a.bridge_id === "overview")
        );
        articlesByCore[kw.core_id] = art ? (art as CoreArticleData) : null;
      }
    }
  } catch (e) {
    console.error("[core-articles page]", e);
  }

  const totalArticles = Object.values(articlesByCore).filter(Boolean).length;

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">function e</p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">core articles</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          {keywords.length} core topics · {totalArticles} pillar articles generated
        </p>
      </div>
      <CoreArticlesClient keywords={keywords} articlesByCore={articlesByCore} />
    </div>
  );
}
