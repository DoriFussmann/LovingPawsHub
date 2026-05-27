import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createReadClient } from "@/lib/supabase/server";
import ArticleCard from "@/components/public/ArticleCard";
import { siteUrl } from "@/lib/site-url";
import { generateBridgeBreadcrumbSchema } from "@/lib/seo";
import { getSiteConfig, cfg } from "@/lib/site-config";

function getSupabase() {
  return createReadClient();
}

export const revalidate = 3600;
export const dynamicParams = true;

interface PageParams {
  params: { core: string; bridge: string };
}

export async function generateStaticParams() {
  try {
    const supabase = getSupabase();
    // bridge_keywords has no core_id column — derive pairs from published articles instead
    const { data } = await supabase
      .from("articles")
      .select("core_id, bridge_id")
      .eq("status", "published");
    const seen = new Set<string>();
    return (data ?? []).filter((a) => {
      const key = `${a.core_id}/${a.bridge_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((a) => ({ core: a.core_id, bridge: a.bridge_id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  try {
    const supabase = getSupabase();
    const [coreRes, config] = await Promise.all([
      supabase.from("core_keywords").select("id").eq("core_id", params.core).maybeSingle(),
      getSiteConfig(),
    ]);
    if (!coreRes.data) return {};
    const { data } = await supabase
      .from("bridge_keywords")
      .select("keyword, meta_title, meta_description")
      .eq("bridge_id", params.bridge)
      .eq("core_keyword_id", coreRes.data.id)
      .maybeSingle();
    if (!data) return {};
    const title = data.meta_title || `${data.keyword} Guides`;
    const description = data.meta_description || `All articles and expert guides on ${data.keyword}.`;
    const url = `${siteUrl}/${params.core}/${params.bridge}/`;
    const siteName = cfg(config, "site_name");
    const ogImage =
      config?.og_image_url ||
      (siteName ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}&tagline=${encodeURIComponent(title)}` : null);
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: "website",
        ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
      },
      twitter: {
        card: "summary_large_image" as const,
        title,
        description,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function BridgeCategoryPage({ params }: PageParams) {
  let coreLabel = params.core.replace(/-/g, " ");
  let bridgeLabel = params.bridge.replace(/-/g, " ");
  let bridgeDescription: string | null = null;
  let articles: Parameters<typeof ArticleCard>[0]["article"][] = [];

  try {
    const supabase = getSupabase();

    // Fetch core first to get its UUID and label (needed to query bridge_keywords by FK)
    const coreRes = await supabase
      .from("core_keywords")
      .select("id, keyword")
      .eq("core_id", params.core)
      .maybeSingle();

    if (!coreRes.data) return notFound();
    coreLabel = coreRes.data.keyword;

    const [bridgeRes, articlesRes] = await Promise.all([
      supabase
        .from("bridge_keywords")
        .select("keyword, description")
        .eq("core_keyword_id", coreRes.data.id)
        .eq("bridge_id", params.bridge)
        .maybeSingle(),
      supabase
        .from("articles")
        .select(
          "id, article_id, h1_title, content_type, primary_keyword, core_id, bridge_id, slug, body_markdown, is_core_article, published_at, featured_image_url, featured_image_alt"
        )
        .eq("core_id", params.core)
        .eq("bridge_id", params.bridge)
        .eq("status", "published")
        .order("is_core_article", { ascending: false })
        .order("published_at", { ascending: false }),
    ]);

    if (!bridgeRes.data) return notFound();
    bridgeLabel = bridgeRes.data.keyword;
    bridgeDescription = bridgeRes.data.description ?? null;
    articles = articlesRes.data ?? [];
  } catch {
    return notFound();
  }

  const breadcrumbSchema = generateBridgeBreadcrumbSchema(
    siteUrl,
    params.core,
    coreLabel,
    params.bridge,
    bridgeLabel
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-light text-muted-foreground mb-10 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">home</Link>
          <span>/</span>
          <Link href={`/${params.core}/`} className="hover:text-foreground transition-colors capitalize">
            {coreLabel}
          </Link>
          <span>/</span>
          <span className="text-foreground capitalize">{bridgeLabel}</span>
        </nav>

        <div className="mb-10">
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">topic</p>
          <h1 className="text-2xl font-extralight tracking-tight text-foreground capitalize">
            {bridgeLabel}
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-2">
            {articles.length} article{articles.length !== 1 ? "s" : ""}
          </p>
          {bridgeDescription && (
            <p className="text-sm font-light text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              {bridgeDescription}
            </p>
          )}
        </div>

        {articles.length === 0 ? (
          <p className="text-sm font-light text-muted-foreground">no articles published yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
