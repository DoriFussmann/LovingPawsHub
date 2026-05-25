import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSiteConfig, cfg, resolveTokens, type EditorialStandard } from "@/lib/site-config";
import { siteUrl } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const description = siteName
    ? `Learn about ${siteName} — our mission, editorial standards, and the team behind the content.`
    : "Learn about our mission, editorial standards, and the team behind the content.";
  const ogTitle = siteName ? `About ${siteName}` : "About";
  const ogImage =
    config?.og_image_url ||
    (siteName
      ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}&tagline=${encodeURIComponent(ogTitle)}`
      : null);
  return {
    title: "About",
    description,
    alternates: { canonical: `${siteUrl}/about/` },
    openGraph: {
      title: ogTitle,
      description,
      url: `${siteUrl}/about/`,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image" as const,
      title: ogTitle,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/** Normalise image paths entered in the admin (backslashes, missing leading slash). */
function normaliseImageUrl(raw: string): string {
  if (!raw?.trim()) return "";
  const cleaned = ("/" + raw.trim().replace(/\\/g, "/")).replace(/^\/\//, "/");
  // If it's already an absolute URL leave it alone
  return raw.startsWith("http") ? raw : cleaned;
}

/** Convert a display name to a URL slug for the author profile link. */
function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default async function AboutPage() {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const aboutText = cfg(config, "about_text");
  const industryName = cfg(config, "industry_name", "your industry");
  const resolvedAboutText = resolveTokens(aboutText, siteName, industryName);

  const defaultStandards: EditorialStandard[] = [
    {
      title: "Independence",
      body: "No sponsored content. No affiliate arrangements that influence editorial decisions. Our recommendations are based solely on research and analysis.",
    },
    {
      title: "Accuracy",
      body: "Claims are backed by primary sources. We cite data, link to original research, and distinguish clearly between fact and opinion.",
    },
    {
      title: "Currency",
      body: "Content is reviewed and updated regularly. Publication and last-updated dates are shown on every article so you know how fresh the information is.",
    },
  ];
  const editorialStandards: EditorialStandard[] =
    config?.about_editorial_standards ?? defaultStandards;
  const teamMembers = config?.team_members ?? [];
  const pageUrl = `${siteUrl}/about/`;

  // ── Structured data ────────────────────────────────────────────────────────

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "About", item: pageUrl },
    ],
  };

  const aboutPageSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: siteName ? `About ${siteName}` : "About",
    url: pageUrl,
    ...(aboutText ? { description: aboutText } : {}),
    ...(siteName
      ? {
          publisher: {
            "@type": "Organization",
            name: siteName,
            url: siteUrl,
          },
        }
      : {}),
  };

  // One Person schema per team member
  const personSchemas = teamMembers.map((member) => {
    const imageUrl = normaliseImageUrl(member.image_url ?? "");
    const profileUrl = `${siteUrl}/authors/${nameToSlug(member.name)}/`;
    const sameAs: string[] = [];
    if (member.linkedin_url) sameAs.push(member.linkedin_url);
    if (member.twitter_url) sameAs.push(member.twitter_url);
    return {
      "@context": "https://schema.org",
      "@type": "Person",
      name: member.name,
      ...(member.role ? { jobTitle: member.role } : {}),
      ...(member.credentials ? { description: member.credentials } : member.bio ? { description: member.bio } : {}),
      url: profileUrl,
      ...(imageUrl
        ? { image: { "@type": "ImageObject", url: imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}` } }
        : {}),
      ...(siteName
        ? { worksFor: { "@type": "Organization", name: siteName, url: siteUrl } }
        : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }} />
      {personSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      <div className="max-w-[1280px] mx-auto px-6 md:px-8 pt-24 pb-16">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-light text-muted-foreground mb-12 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">home</Link>
          <span>/</span>
          <span className="text-foreground">about</span>
        </nav>

        {/* Mission statement */}
        <p className="text-[10px] tracking-widest uppercase text-foreground/30 mb-4">our mission</p>
        <h1 className="text-3xl md:text-4xl font-extralight tracking-tight text-foreground mb-6">
          {siteName ? `about ${siteName.toLowerCase()}.` : "about us."}
        </h1>
        {resolvedAboutText ? (
          <p className="text-sm font-light leading-relaxed text-foreground/60 max-w-2xl">
            {resolvedAboutText}
          </p>
        ) : null}

        <div className="border-b border-border/30 mt-12 mb-16" />

        {/* Team section */}
        {teamMembers.length > 0 && (
          <>
            <p className="text-[10px] tracking-widest uppercase text-foreground/30 mb-8">the team</p>
            <div className="flex flex-col gap-10 max-w-xl mb-16">
              {teamMembers.map((member, i) => {
                const imageUrl = normaliseImageUrl(member.image_url ?? "");
                const profileUrl = `/authors/${nameToSlug(member.name)}/`;

                return (
                  <div key={i} className="flex gap-5 items-start">
                    {imageUrl ? (
                      <Link href={profileUrl} className="shrink-0 w-24 h-24 rounded-md overflow-hidden border border-border/40 hover:border-foreground/30 transition-colors">
                        <Image
                          src={imageUrl}
                          alt={member.name}
                          width={96}
                          height={96}
                          className="object-cover w-full h-full object-top"
                        />
                      </Link>
                    ) : (
                      <Link href={profileUrl} className="shrink-0 w-24 h-24 rounded-md bg-foreground/5 border border-border/40 hover:border-foreground/30 transition-colors flex items-center justify-center">
                        <span className="text-2xl font-light text-foreground/40">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </Link>
                    )}
                    <div>
                      <Link
                        href={profileUrl}
                        className="text-base font-light text-foreground hover:text-foreground/70 transition-colors"
                      >
                        {member.name}
                      </Link>
                      {member.role && (
                        <p className="text-xs font-light text-foreground/40 mb-1">{member.role}</p>
                      )}
                      {member.credentials && (
                        <p className="text-xs font-light text-foreground/60 mb-2 italic">{member.credentials}</p>
                      )}
                      {member.bio && (
                        <p className="text-sm font-light leading-relaxed text-foreground/60 max-w-lg mb-2">
                          {member.bio}
                        </p>
                      )}
                      {(member.linkedin_url || member.twitter_url) && (
                        <div className="flex items-center gap-3">
                          {member.linkedin_url && (
                            <a
                              href={member.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-light text-foreground/40 hover:text-foreground/70 transition-colors uppercase tracking-widest"
                            >
                              LinkedIn
                            </a>
                          )}
                          {member.twitter_url && (
                            <a
                              href={member.twitter_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-light text-foreground/40 hover:text-foreground/70 transition-colors uppercase tracking-widest"
                            >
                              Twitter / X
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-b border-border/30 mb-16" />
          </>
        )}

        {/* Editorial standards — managed via admin site-settings */}
        {editorialStandards.length > 0 && (
          <>
            <p className="text-[10px] tracking-widest uppercase text-foreground/30 mb-6">
              editorial standards
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
              {editorialStandards.map((standard, i) => (
                <div key={i}>
                  <p className="text-sm font-light text-foreground mb-2">{standard.title}</p>
                  <p className="text-xs font-light leading-relaxed text-foreground/55">
                    {standard.body}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
