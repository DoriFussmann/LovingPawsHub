import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSiteConfig, cfg } from "@/lib/site-config";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;
export const dynamicParams = true;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface PageParams {
  params: { slug: string };
}

export async function generateStaticParams() {
  try {
    const config = await getSiteConfig();
    const members = config?.team_members ?? [];
    return members.map((m) => ({ slug: nameToSlug(m.name) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  try {
    const config = await getSiteConfig();
    const member = (config?.team_members ?? []).find(
      (m) => nameToSlug(m.name) === params.slug
    );
    if (!member) return {};
    const siteName = cfg(config, "site_name");
    const title = `${member.name} — ${member.role}${siteName ? ` | ${siteName}` : ""}`;
    const description = member.bio
      ? member.bio.slice(0, 160)
      : `${member.name} is ${member.role} at ${siteName}.`;
    const url = `${siteUrl}/authors/${params.slug}/`;
    const resolvedImage = member.image_url
      ? (member.image_url.startsWith("http")
          ? member.image_url
          : `${siteUrl}${member.image_url.startsWith("/") ? "" : "/"}${member.image_url}`)
      : null;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: "profile",
        ...(resolvedImage
          ? { images: [{ url: resolvedImage, width: 400, height: 400, alt: member.name }] }
          : {}),
      },
      twitter: {
        card: "summary_large_image" as const,
        title,
        description,
        ...(resolvedImage ? { images: [resolvedImage] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function AuthorPage({ params }: PageParams) {
  const [config, supabase] = [await getSiteConfig(), getSupabase()];

  const member = (config?.team_members ?? []).find(
    (m) => nameToSlug(m.name) === params.slug
  );
  if (!member) return notFound();

  const { data: articles } = await supabase
    .from("articles")
    .select("article_id, h1_title, slug, core_id, bridge_id, published_at, primary_keyword")
    .eq("reviewer_name", member.name)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const siteName = cfg(config, "site_name");

  const sameAs: string[] = [];
  if (member.linkedin_url) sameAs.push(member.linkedin_url);
  if (member.twitter_url) sameAs.push(member.twitter_url);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: member.name, item: `${siteUrl}/authors/${params.slug}/` },
    ],
  };

  const authorSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: member.name,
    jobTitle: member.role,
    ...(member.credentials
      ? { description: member.credentials }
      : member.bio
      ? { description: member.bio }
      : {}),
    url: `${siteUrl}/authors/${params.slug}/`,
    ...(member.image_url
      ? { image: { "@type": "ImageObject", url: member.image_url } }
      : {}),
    ...(siteName ? { worksFor: { "@type": "Organization", name: siteName, url: siteUrl } } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
      />
      <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-light text-muted-foreground mb-10 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">home</Link>
          <span>/</span>
          <span className="text-foreground">authors</span>
          <span>/</span>
          <span className="text-foreground">{member.name}</span>
        </nav>

        {/* Author profile */}
        <div className="flex gap-8 items-start mb-12 flex-wrap md:flex-nowrap">
          {member.image_url && (
            <div className="relative w-24 h-24 shrink-0 rounded-full overflow-hidden border border-border">
              <Image
                src={member.image_url}
                alt={member.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extralight tracking-tight text-foreground mb-1">
              {member.name}
            </h1>
            <p className="text-xs tracking-widest uppercase text-foreground/40 mb-1">
              {member.role}
            </p>
            {member.credentials && (
              <p className="text-xs font-light text-foreground/55 italic mb-3">{member.credentials}</p>
            )}
            {member.bio && (
              <p className="text-sm font-light text-foreground/80 leading-relaxed max-w-2xl mb-3">
                {member.bio}
              </p>
            )}
            {(member.linkedin_url || member.twitter_url) && (
              <div className="flex items-center gap-4">
                {member.linkedin_url && (
                  <a
                    href={member.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-light uppercase tracking-widest text-foreground/40 hover:text-foreground/70 transition-colors"
                  >
                    LinkedIn
                  </a>
                )}
                {member.twitter_url && (
                  <a
                    href={member.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-light uppercase tracking-widest text-foreground/40 hover:text-foreground/70 transition-colors"
                  >
                    Twitter / X
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Articles by this author */}
        {articles && articles.length > 0 && (
          <div>
            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-4">
              articles by {member.name}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((article) => (
                <Link
                  key={article.article_id}
                  href={`/${article.core_id}/${article.bridge_id}/${article.slug}/`}
                  className="border border-border rounded-md p-4 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs font-light text-foreground leading-snug mb-2">
                    {article.h1_title}
                  </p>
                  {article.published_at && (
                    <p className="text-[10px] text-muted-foreground font-light">
                      {new Date(article.published_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
