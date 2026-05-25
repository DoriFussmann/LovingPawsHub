import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  generateArticleMetadata,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateFAQSchema,
} from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import { getSiteConfig, cfg } from "@/lib/site-config";
import ArticlePage from "@/components/public/ArticlePage";

// Plain cookie-free Supabase client — safe for ISR, static, and dynamic contexts.
// Public pages only read published articles, so the anon key + RLS is sufficient.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const revalidate = 3600;
export const dynamicParams = true;

interface PageParams {
  params: {
    core: string;
    bridge: string;
    slug: string;
  };
}

export async function generateStaticParams() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("articles")
      .select("core_id, bridge_id, slug")
      .eq("status", "published")
      .limit(1000);

    return (data ?? []).map((a) => ({
      core: a.core_id,
      bridge: a.bridge_id,
      slug: a.slug,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  try {
    const [supabaseResult, config] = await Promise.all([
      getSupabase()
        .from("articles")
        .select(
          "article_id, meta_title, meta_description, og_title, og_description, core_id, bridge_id, slug, robots_directive, canonical_url, featured_image_url"
        )
        .eq("core_id", params.core)
        .eq("bridge_id", params.bridge)
        .eq("slug", params.slug)
        .eq("status", "published")
        .limit(1),
      getSiteConfig(),
    ]);

    const article = supabaseResult.data?.[0];
    if (!article) return {};
    return generateArticleMetadata({
      ...article,
      featured_image_url: article.featured_image_url ?? null,
      og_image_url: config?.og_image_url,
      twitter_handle: config?.twitter_handle,
      siteName: cfg(config, "site_name"),
      canonical_url: article.canonical_url ?? null,
    });
  } catch (error) {
    console.error("[generateMetadata] failed:", error);
    throw error;
  }
}

export default async function ArticlePageRoute({ params }: PageParams) {
  let article;
  let coreLabel = params.core.replace(/[-_]/g, " ");
  let bridgeLabel = params.bridge.replace(/[-_]/g, " ");

  try {
    const supabase = getSupabase();

    const { data: rows, error } = await supabase
      .from("articles")
      .select("*")
      .eq("core_id", params.core)
      .eq("bridge_id", params.bridge)
      .eq("slug", params.slug)
      .eq("status", "published")
      .limit(1);

    if (error || !rows?.length) return notFound();
    article = rows[0];

    // Enrich related_articles with routing info so cross-core links resolve correctly
    if (Array.isArray(article.related_articles) && article.related_articles.length > 0) {
      const slugs = article.related_articles
        .map((r: { slug?: string }) => r.slug)
        .filter(Boolean) as string[];
      if (slugs.length > 0) {
        const { data: routing } = await supabase
          .from("articles")
          .select("slug, core_id, bridge_id")
          .in("slug", slugs)
          .eq("status", "published");
        if (routing) {
          const routingMap = Object.fromEntries(routing.map((r) => [r.slug, r]));
          article.related_articles = article.related_articles.map(
            (r: { slug?: string; core_id?: string; bridge_id?: string }) => ({
              ...r,
              core_id: routingMap[r.slug ?? ""]?.core_id ?? r.core_id,
              bridge_id: routingMap[r.slug ?? ""]?.bridge_id ?? r.bridge_id,
            })
          );
        }
      }
    }

    // Fetch human-readable labels from bridge_keywords (best-effort)
    try {
      const { data: bk } = await supabase
        .from("bridge_keywords")
        .select("keyword, core_keywords(keyword)")
        .eq("bridge_id", params.bridge)
        .maybeSingle();

      if (bk?.keyword) bridgeLabel = bk.keyword as string;
      const ck = (bk as Record<string, unknown> | null)?.core_keywords as {
        keyword?: string;
      } | null;
      if (ck?.keyword) coreLabel = ck.keyword;
    } catch {
      // Labels fall back to URL-param-derived values
    }
  } catch {
    return notFound();
  }

  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const ogImageUrl = config?.og_image_url || null;

  // Look up team member to populate the author bio box
  const teamMembers: Array<{ name: string; role: string; bio: string; image_url: string }> =
    config?.team_members ?? [];

  function nameToSlug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function normaliseImageUrl(raw: string): string {
    if (!raw) return raw;
    const forward = raw.replace(/\\/g, "/");
    if (forward.startsWith("http")) return forward;
    return forward.startsWith("/") ? forward : `/${forward}`;
  }

  const matchedMember = article.reviewer_name
    ? teamMembers.find((m) => m.name === article.reviewer_name) ?? null
    : null;

  const authorInfo = matchedMember
    ? {
        name: matchedMember.name,
        role: matchedMember.role || undefined,
        bio: matchedMember.bio || undefined,
        image_url: matchedMember.image_url ? normaliseImageUrl(matchedMember.image_url) : undefined,
        profile_url: `/authors/${nameToSlug(matchedMember.name)}/`,
      }
    : null;

  const breadcrumbSchema = generateBreadcrumbSchema(
    siteUrl,
    params.core,
    coreLabel,
    params.bridge,
    bridgeLabel,
    article.h1_title ?? "",
    article.slug ?? ""
  );

  const articleSchema = generateArticleSchema({
    meta_title: article.meta_title ?? article.h1_title ?? "",
    meta_description: article.meta_description ?? "",
    h1_title: article.h1_title,
    published_at: article.published_at,
    updated_at: article.updated_at,
    core_id: article.core_id,
    bridge_id: article.bridge_id,
    slug: article.slug,
    site_name: siteName,
    featured_image_url: article.featured_image_url ?? null,
    og_image_url: ogImageUrl,
    reviewer_name: article.reviewer_name ?? null,
    author_url: article.author_url ?? null,
  });

  const faqSchema =
    article.content_type?.toLowerCase() === "faq" && Array.isArray(article.table_of_contents)
      ? generateFAQSchema(article.table_of_contents, article.body_markdown)
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <ArticlePage
        article={article}
        coreLabel={coreLabel}
        bridgeLabel={bridgeLabel}
        author={authorInfo}
      />
    </>
  );
}
