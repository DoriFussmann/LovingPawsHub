import type { Metadata } from "next";
import Link from "next/link";
import HeroSection from "@/components/public/HeroSection";
import LogoBanner from "@/components/public/LogoBanner";
import { createReadClient } from "@/lib/supabase/server";
import { getSiteConfig, cfg } from "@/lib/site-config";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const title = cfg(config, "homepage_title") || cfg(config, "site_name");
  const siteName = cfg(config, "site_name");
  const description = cfg(config, "site_description");
  // Mirror the layout's og:image logic so the page-level openGraph doesn't
  // drop the image when it shallow-overrides the layout's openGraph object.
  const ogImageUrl =
    config?.og_image_url ||
    (siteName ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}` : null);

  return {
    // Use absolute to prevent the root layout's title template from appending "| SiteName",
    // which would push the homepage title over the ~60 char SERP limit.
    title: title ? { absolute: title } : undefined,
    description: description || undefined,
    alternates: { canonical: `${siteUrl}/` },
    openGraph: {
      title: title || undefined,
      description: description || undefined,
      url: `${siteUrl}/`,
      type: "website",
      ...(ogImageUrl
        ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] }
        : {}),
    },
  };
}

export default async function HomePage() {
  let recentArticles: Array<{
    id: string;
    article_id: string;
    h1_title: string;
    content_type: string;
    core_id: string;
    bridge_id: string;
    slug: string;
  }> = [];

  let coreArticles: Array<{
    id: string;
    h1_title: string;
    core_id: string;
    bridge_id: string;
    slug: string;
    primary_keyword: string;
  }> = [];

  try {
    const supabase = createReadClient();

    const { data: recentData } = await supabase
      .from("articles")
      .select("id, article_id, h1_title, content_type, core_id, bridge_id, slug")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    recentArticles = recentData ?? [];

    const { data: coreData } = await supabase
      .from("articles")
      .select("id, h1_title, core_id, bridge_id, slug, primary_keyword")
      .eq("status", "published")
      .eq("is_core_article", true)
      .order("article_id", { ascending: true });
    coreArticles = coreData ?? [];
  } catch {
    // No database configured yet — show empty state
  }

  const config = await getSiteConfig();

  return (
    <>
      <HeroSection
        recentArticles={recentArticles}
        siteName={cfg(config, "site_name")}
        industryName={cfg(config, "industry_name")}
        headline={cfg(config, "homepage_headline")}
        subheadline={cfg(config, "homepage_subheadline")}
        bodyText={cfg(config, "hero_body_text")}
        ctaPrimary={cfg(config, "hero_cta_primary")}
        ctaSecondary={cfg(config, "hero_cta_secondary")}
      />
      <LogoBanner
        show={config?.show_logo_banner ?? false}
        text={cfg(config, "logo_banner_text")}
      />

      {/* Featured Articles */}
      <section className="py-20 border-t border-border">
        <div className="max-w-[1280px] mx-auto px-6 md:px-14">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-eyebrow mb-3">explore</p>
              <h2 className="text-display text-foreground">
                Featured articles
              </h2>
            </div>
            <Link href="/articles" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              All articles →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreArticles.length > 0 ? (
              coreArticles.map((a) => (
                <Link
                  key={a.id}
                  href={`/${a.core_id}/${a.bridge_id}/${a.slug}/`}
                  className="card card-hover flex items-center justify-between px-5 py-4 group"
                >
                  <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-snug">
                    {a.h1_title}
                  </span>
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 ml-3 w-3 h-3 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <path d="M2 6h8M7 3l3 3-3 3" />
                  </svg>
                </Link>
              ))
            ) : (
              <div className="card px-5 py-4">
                <span className="text-sm text-ds-text-muted">
                  Articles coming soon.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Who We Are — controlled via admin site-settings */}
      {(cfg(config, "homepage_about_headline") || cfg(config, "homepage_about_text")) && (
        <section className="py-20 border-t border-border" style={{ background: "var(--muted)" }}>
          <div className="max-w-[1280px] mx-auto px-6 md:px-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div>
                <p className="text-eyebrow mb-4">who we are</p>
                <h2 className="text-display text-foreground">
                  {cfg(config, "homepage_about_headline")}
                </h2>
              </div>
              <div>
                <p className="text-body text-ds-text mb-5">
                  {cfg(config, "homepage_about_text")}
                </p>
                <Link
                  href="/about/"
                  className="btn btn-secondary btn-sm"
                >
                  Meet the team →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
