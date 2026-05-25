import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { getSiteConfig, cfg } from "@/lib/site-config";
import { siteUrl } from "@/lib/site-url";
import { generateDefinedTermSetSchema } from "@/lib/seo";
import GlossaryPageClient from "@/components/public/GlossaryPageClient";

export const dynamic = "force-dynamic";

export interface GlossaryTermPublic {
  id: string;
  term: string;
  slug: string;
  description: string | null;
  examples: string[];
  resources: { title: string; url: string }[];
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const industryName = cfg(config, "industry_name");

  const metaTitle =
    config?.glossary_meta_title?.trim() ||
    `Glossary${siteName ? ` | ${siteName}` : ""}`;
  const metaDescription =
    config?.glossary_meta_description?.trim() ||
    `Browse our ${industryName || "industry"} glossary for clear definitions of key terms and concepts.`;
  const ogTitle = config?.glossary_og_title?.trim() || metaTitle;
  const ogDescription = config?.glossary_og_description?.trim() || metaDescription;
  const canonical = `${siteUrl}/glossary/`;
  const ogImage =
    config?.og_image_url ||
    (siteName ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}&tagline=${encodeURIComponent(ogTitle)}` : null);

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image" as const,
      title: ogTitle,
      description: ogDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function GlossaryPage() {
  let terms: GlossaryTermPublic[] = [];

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("glossary_terms")
      .select("id, term, slug, description, examples, resources")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("term", { ascending: true });
    if (error) console.error("[glossary page]", error);
    terms = (data ?? []) as GlossaryTermPublic[];
  } catch (e) {
    console.error("[glossary page]", e);
  }

  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const glossaryUrl = `${siteUrl}/glossary/`;
  const schema = generateDefinedTermSetSchema(terms, glossaryUrl, siteName || undefined);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <GlossaryPageClient terms={terms} initialSlug={terms[0]?.slug ?? null} />
    </>
  );
}
