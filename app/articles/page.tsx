import type { Metadata } from "next";
import { Suspense } from "react";
import { createReadClient } from "@/lib/supabase/server";
import ArticlesGrid from "./ArticlesGrid";
import { siteUrl } from "@/lib/site-url";
import { getSiteConfig, cfg } from "@/lib/site-config";

const PAGE_SIZE = 24;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}): Promise<Metadata> {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const industry = cfg(config, "industry_name") || "industry";
  const label = industry.charAt(0).toUpperCase() + industry.slice(1);
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const canonical =
    page > 1 ? `${siteUrl}/articles/?page=${page}` : `${siteUrl}/articles/`;
  const title = `${label} Articles & Guides`;
  const description = `Browse expert ${industry} articles and guides on ${siteName}.`;
  const ogImage =
    config?.og_image_url ||
    (siteName ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}&tagline=${encodeURIComponent(title)}` : null);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(searchParams.q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let articles: Array<{
    id: string;
    article_id: string;
    h1_title: string;
    content_type: string;
    primary_keyword: string;
    core_id: string;
    bridge_id: string;
    slug: string;
    body_markdown: string;
    is_core_article: boolean;
    published_at: string;
    featured_image_url: string | null;
    featured_image_alt: string | null;
  }> = [];

  let totalCount = 0;
  let coreKeywords: Array<{ core_id: string; keyword: string }> = [];

  try {
    const supabase = createReadClient();
    const [articlesRes, countRes, coresRes] = await Promise.all([
      supabase
        .from("articles")
        .select(
          "id, article_id, h1_title, content_type, primary_keyword, core_id, bridge_id, slug, body_markdown, is_core_article, published_at, featured_image_url, featured_image_alt"
        )
        .eq("status", "published")
        .not("slug", "is", null)
        .not("core_id", "is", null)
        .not("bridge_id", "is", null)
        .neq("slug", "")
        .order("is_core_article", { ascending: false })
        .order("published_at", { ascending: false })
        .range(from, to),
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
      supabase.from("core_keywords").select("core_id, keyword").order("keyword"),
    ]);
    articles = articlesRes.data ?? [];
    totalCount = countRes.count ?? 0;
    coreKeywords = coresRes.data ?? [];
  } catch {
    // No database configured yet
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-14 py-12">
      <div className="mb-10">
        <p className="text-eyebrow mb-3">Resources</p>
        <h1 className="text-display text-foreground">Articles</h1>
      </div>
      <Suspense fallback={null}>
        <ArticlesGrid
          articles={articles}
          coreKeywords={coreKeywords}
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </Suspense>
    </div>
  );
}
