import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSiteConfig, cfg } from "@/lib/site-config";
import { siteUrl } from "@/lib/site-url";
import { generateDefinedTermSchema } from "@/lib/seo";
import GlossaryPageClient from "@/components/public/GlossaryPageClient";
import type { GlossaryTermPublic } from "@/app/glossary/page";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("glossary_terms")
      .select("slug")
      .eq("status", "published");
    return (data ?? []).map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const termUrl = `${siteUrl}/glossary/${params.slug}/`;

  try {
    const supabase = createServiceClient();
    const { data: term } = await supabase
      .from("glossary_terms")
      .select("term, meta_title, meta_description, og_title, og_description, description")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();

    if (!term) {
      return { title: "Term Not Found" };
    }

    const metaTitle =
      term.meta_title?.trim() ||
      `${term.term} Definition${siteName ? ` | ${siteName}` : ""}`;
    const metaDescription =
      term.meta_description?.trim() ||
      (term.description ? `${term.description.slice(0, 155)}` : `Learn the definition of ${term.term}.`);
    const ogTitle = term.og_title?.trim() || metaTitle;
    const ogDescription = term.og_description?.trim() || metaDescription;
    const ogImage =
      config?.og_image_url ||
      (siteName ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}&tagline=${encodeURIComponent(ogTitle)}` : null);

    return {
      title: metaTitle,
      description: metaDescription,
      alternates: { canonical: termUrl },
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: termUrl,
        type: "article",
        ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
      },
      twitter: {
        card: "summary_large_image" as const,
        title: ogTitle,
        description: ogDescription,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch {
    return { title: params.slug };
  }
}

export default async function GlossaryTermPage({
  params,
}: {
  params: { slug: string };
}) {
  let terms: GlossaryTermPublic[] = [];
  let currentTerm: GlossaryTermPublic | null = null;

  try {
    const supabase = createServiceClient();
    const [termsRes, termRes] = await Promise.all([
      supabase
        .from("glossary_terms")
        .select("id, term, slug, description, examples, resources")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("term", { ascending: true }),
      supabase
        .from("glossary_terms")
        .select("id, term, slug, description, examples, resources")
        .eq("slug", params.slug)
        .eq("status", "published")
        .maybeSingle(),
    ]);
    if (termsRes.error) console.error("[glossary slug page]", termsRes.error);
    terms = (termsRes.data ?? []) as GlossaryTermPublic[];
    currentTerm = termRes.data as GlossaryTermPublic | null;
  } catch (e) {
    console.error("[glossary slug page]", e);
  }

  if (!currentTerm) notFound();

  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const termUrl = `${siteUrl}/glossary/${params.slug}/`;
  const glossaryUrl = `${siteUrl}/glossary/`;
  const schema = generateDefinedTermSchema(
    currentTerm,
    termUrl,
    glossaryUrl,
    siteName || undefined
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <GlossaryPageClient terms={terms} initialSlug={params.slug} />
    </>
  );
}
