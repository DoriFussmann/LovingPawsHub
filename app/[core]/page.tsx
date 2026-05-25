import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";
import { generateCoreBreadcrumbSchema } from "@/lib/seo";
import { getSiteConfig, cfg } from "@/lib/site-config";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const revalidate = 3600;
export const dynamicParams = true;

interface PageParams {
  params: { core: string };
}

export async function generateStaticParams() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from("core_keywords").select("core_id");
    return (data ?? []).map((c) => ({ core: c.core_id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  try {
    const supabase = getSupabase();
    const [{ data }, config] = await Promise.all([
      supabase
        .from("core_keywords")
        .select("keyword, meta_title, meta_description")
        .eq("core_id", params.core)
        .maybeSingle(),
      getSiteConfig(),
    ]);
    if (!data) return {};
    const title = data.meta_title || `${data.keyword} Articles & Guides`;
    const description =
      data.meta_description || `Browse all articles and expert guides on ${data.keyword}.`;
    const url = `${siteUrl}/${params.core}/`;
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
    };
  } catch {
    return {};
  }
}

export default async function CoreCategoryPage({ params }: PageParams) {
  let coreLabel = params.core.replace(/-/g, " ");
  let coreDescription: string | null = null;
  let bridges: { bridge_id: string; keyword: string; article_count: number }[] = [];

  try {
    const supabase = getSupabase();

    // Fetch core first to get its UUID (needed to query bridge_keywords by FK)
    const coreRes = await supabase
      .from("core_keywords")
      .select("id, keyword, description")
      .eq("core_id", params.core)
      .maybeSingle();

    if (!coreRes.data) return notFound();
    coreLabel = coreRes.data.keyword;
    coreDescription = coreRes.data.description ?? null;

    const bridgesRes = await supabase
      .from("bridge_keywords")
      .select("bridge_id, keyword")
      .eq("core_keyword_id", coreRes.data.id)
      .order("keyword");

    const bridgeList = bridgesRes.data ?? [];
    const countsRes = await Promise.all(
      bridgeList.map((b) =>
        supabase
          .from("articles")
          .select("article_id", { count: "exact", head: true })
          .eq("bridge_id", b.bridge_id)
          .eq("status", "published")
      )
    );
    bridges = bridgeList.map((b, i) => ({
      ...b,
      article_count: countsRes[i].count ?? 0,
    }));
  } catch {
    return notFound();
  }

  const breadcrumbSchema = generateCoreBreadcrumbSchema(siteUrl, params.core, coreLabel);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-light text-muted-foreground mb-10">
          <Link href="/" className="hover:text-foreground transition-colors">home</Link>
          <span>/</span>
          <span className="text-foreground capitalize">{coreLabel}</span>
        </nav>

        <div className="mb-10">
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">topic</p>
          <h1 className="text-2xl font-extralight tracking-tight text-foreground capitalize">
            {coreLabel}
          </h1>
          {coreDescription && (
            <p className="text-sm font-light text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              {coreDescription}
            </p>
          )}
        </div>

        {bridges.length === 0 ? (
          <p className="text-sm font-light text-muted-foreground">no articles published yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bridges.map((bridge) => (
              <Link
                key={bridge.bridge_id}
                href={`/${params.core}/${bridge.bridge_id}/`}
                className="border border-border rounded-md p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-light text-foreground leading-snug mb-2 capitalize">
                  {bridge.keyword}
                </p>
                <p className="text-[10px] text-muted-foreground font-light">
                  {bridge.article_count} article{bridge.article_count !== 1 ? "s" : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
