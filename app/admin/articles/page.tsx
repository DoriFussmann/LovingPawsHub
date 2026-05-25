import { createServiceClient as createClient } from "@/lib/supabase/server";
import ArticlesClient from "./ArticlesClient";
import { defaultArticleConfig, ArticlePromptConfig, ARTICLE_SETTINGS_KEY } from "@/lib/promptTemplates";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  let clusters: Array<{
    id: string;
    cluster_id: string;
    display_name: string;
    link_health: string;
    bridge_keywords: {
      keyword: string;
      bridge_id: string;
      core_keywords: { keyword: string; core_id: string };
    };
    article_skeletons: Array<{
      id: string;
      article_id: string;
      content_type: string;
      primary_keyword: string;
      slug: string;
      status: string;
      link_status: string;
      is_core_article: boolean;
    }>;
  }> = [];

  let articlePromptConfig: ArticlePromptConfig = defaultArticleConfig();

  try {
    const supabase = createClient();
    const [clustersRes, settingsRes] = await Promise.all([
      supabase
        .from("clusters")
        .select(`
          id, cluster_id, display_name, link_health,
          bridge_keywords(
            keyword, bridge_id,
            core_keywords(keyword, core_id)
          ),
          article_skeletons(
            id, article_id, content_type, primary_keyword, slug, status, link_status, is_core_article
          )
        `)
        .order("created_at", { ascending: false }),
      supabase.from("settings").select("value").eq("key", ARTICLE_SETTINGS_KEY).maybeSingle(),
    ]);
    clusters = (clustersRes.data ?? []) as unknown as typeof clusters;
    if (settingsRes.data?.value) {
      articlePromptConfig = settingsRes.data.value as ArticlePromptConfig;
    }
  } catch (e) {
    console.error("[articles page] DB error:", e);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          function d
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">briefs to articles</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          generate, review, and publish articles from briefs
        </p>
      </div>
      <ArticlesClient clusters={clusters} articlePromptConfig={articlePromptConfig} />
    </div>
  );
}
