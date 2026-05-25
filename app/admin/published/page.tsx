import { createServiceClient } from "@/lib/supabase/server";
import { getSiteConfig } from "@/lib/site-config";
import PublishedClient from "./PublishedClient";

export const dynamic = "force-dynamic";

export default async function PublishedPage() {
  let articles: Array<{
    id: string;
    article_id: string;
    h1_title: string;
    slug: string;
    core_id: string;
    bridge_id: string;
    content_type: string;
    is_core_article: boolean;
    primary_keyword: string;
    meta_title: string | null;
    meta_description: string | null;
    og_title: string | null;
    og_description: string | null;
    canonical_url: string | null;
    robots_directive: string | null;
    schema_type: string | null;
    schema_markup: unknown;
    body_markdown: string;
    table_of_contents: unknown;
    internal_links_injected: unknown;
    related_articles: unknown;
    external_links: unknown;
    link_status: string;
    reviewer_name: string | null;
    author_url: string | null;
    published_at: string | null;
    generated_at: string | null;
    updated_at: string | null;
  }> = [];

  let coreKeywords: Array<{ id: string; keyword: string; core_id: string }> = [];
  let teamMembers: Array<{ name: string; role: string; bio: string; image_url: string }> = [];

  try {
    const supabase = createServiceClient();
    const [articlesRes, coresRes, config] = await Promise.all([
      supabase.from("articles").select("*").eq("status", "published").order("published_at", { ascending: false }),
      supabase.from("core_keywords").select("id, keyword, core_id").order("keyword"),
      getSiteConfig(),
    ]);
    articles = (articlesRes.data ?? []) as typeof articles;
    coreKeywords = (coresRes.data ?? []) as typeof coreKeywords;
    teamMembers = config?.team_members ?? [];
  } catch (e) {
    console.error("[published page] DB error:", e);
  }

  const missingAuthorCount = articles.filter((a) => !a.reviewer_name).length;

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">library</p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">published</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          {articles.length} published article{articles.length !== 1 ? "s" : ""}
          {missingAuthorCount > 0 && (
            <span className="ml-2 text-orange-500">{missingAuthorCount} missing author</span>
          )}
        </p>
      </div>
      <PublishedClient articles={articles} coreKeywords={coreKeywords} teamMembers={teamMembers} />
    </div>
  );
}
