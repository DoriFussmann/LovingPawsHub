import { siteUrl } from "@/lib/site-url";

export interface ArticleForSEO {
  article_id?: string;
  meta_title: string;
  meta_description: string;
  og_title?: string;
  og_description?: string;
  core_id: string;
  bridge_id: string;
  slug: string;
  canonical_url?: string | null;
  robots_directive?: string;
  published_at?: string;
  updated_at?: string;
  featured_image_url?: string | null;
  og_image_url?: string | null;
  twitter_handle?: string | null;
  siteName?: string;
  reviewer_name?: string | null;
}

export function generateArticleMetadata(article: ArticleForSEO) {
  const canonicalUrl =
    article.canonical_url ||
    `${siteUrl}/${article.core_id}/${article.bridge_id}/${article.slug}/`;
  const dynamicOg = `${siteUrl}/og?site=${encodeURIComponent(article.siteName ?? "")}&tagline=${encodeURIComponent(article.meta_title)}`;
  const ogImage =
    article.featured_image_url ||
    article.og_image_url ||
    dynamicOg;
  const title = article.og_title || article.meta_title;
  const description = article.og_description || article.meta_description;

  return {
    title: article.meta_title,
    description: article.meta_description,
    openGraph: {
      title,
      description,
      type: "article" as const,
      url: canonicalUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [ogImage],
      ...(article.twitter_handle ? { creator: article.twitter_handle } : {}),
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: article.robots_directive || "index, follow",
  };
}

export function generateBreadcrumbSchema(
  siteUrl: string,
  coreId: string,
  coreLabel: string,
  bridgeId: string,
  bridgeLabel: string,
  articleTitle: string,
  articleSlug: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: coreLabel,
        item: `${siteUrl}/${coreId}/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: bridgeLabel,
        item: `${siteUrl}/${coreId}/${bridgeId}/`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: articleTitle,
        item: `${siteUrl}/${coreId}/${bridgeId}/${articleSlug}/`,
      },
    ],
  };
}

export function generateCoreBreadcrumbSchema(
  siteUrl: string,
  coreId: string,
  coreLabel: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: coreLabel,
        item: `${siteUrl}/${coreId}/`,
      },
    ],
  };
}

export function generateBridgeBreadcrumbSchema(
  siteUrl: string,
  coreId: string,
  coreLabel: string,
  bridgeId: string,
  bridgeLabel: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: coreLabel,
        item: `${siteUrl}/${coreId}/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: bridgeLabel,
        item: `${siteUrl}/${coreId}/${bridgeId}/`,
      },
    ],
  };
}

export function generateArticleSchema(article: {
  meta_title: string;
  meta_description: string;
  h1_title?: string;
  published_at?: string;
  updated_at?: string;
  core_id: string;
  bridge_id: string;
  slug: string;
  site_name?: string;
  featured_image_url?: string | null;
  og_image_url?: string | null;
  reviewer_name?: string | null;
  author_url?: string | null;
}) {
  const url = `${siteUrl}/${article.core_id}/${article.bridge_id}/${article.slug}/`;
  const org = {
    "@type": "Organization",
    ...(article.site_name ? { name: article.site_name } : {}),
    url: siteUrl,
  };

  const dynamicOg = article.site_name
    ? `${siteUrl}/og?site=${encodeURIComponent(article.site_name)}&tagline=${encodeURIComponent(article.meta_title)}`
    : `${siteUrl}/og?tagline=${encodeURIComponent(article.meta_title)}`;

  const imageUrl =
    article.featured_image_url ||
    article.og_image_url ||
    dynamicOg;

  const logoUrl = `${siteUrl}/icon.svg`;

  const author = article.reviewer_name
    ? {
        "@type": "Person",
        name: article.reviewer_name,
        ...(article.author_url
            ? {
                url: article.author_url.startsWith("http")
                  ? article.author_url
                  : `${siteUrl}${article.author_url}`,
              }
            : {}),
      }
    : org;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.meta_title,
    name: article.h1_title || article.meta_title,
    description: article.meta_description,
    url,
    image: {
      "@type": "ImageObject",
      url: imageUrl,
      width: 1200,
      height: 630,
    },
    author,
    publisher: {
      ...org,
      logo: { "@type": "ImageObject", url: logoUrl, width: 1200, height: 630 },
    },
    ...(article.reviewer_name
      ? { reviewedBy: { "@type": "Person", name: article.reviewer_name } }
      : {}),
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    ...(article.updated_at ? { dateModified: article.updated_at } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractAnswer(headingText: string, bodyMarkdown: string): string {
  try {
    const pattern = new RegExp(
      `##\\s+${escapeRegex(headingText)}[\\s\\S]*?\\n+([\\s\\S]*?)(?=\\n##|$)`,
      "i"
    );
    const match = bodyMarkdown.match(pattern);
    if (!match || !match[1]) return `Learn about: ${headingText}`;
    // Take only the first paragraph
    const firstParagraph = match[1].trim().split(/\n\n/)[0];
    if (!firstParagraph) return `Learn about: ${headingText}`;
    // Strip markdown links: [text](url) → text
    const stripped = firstParagraph.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // Strip remaining markdown: bold, italic, inline code
    const clean = stripped.replace(/[*_`#]/g, "").trim();
    if (!clean) return `Learn about: ${headingText}`;
    // Trim to 300 chars at a word boundary
    if (clean.length <= 300) return clean;
    const trimmed = clean.slice(0, 300);
    const lastSpace = trimmed.lastIndexOf(" ");
    return (lastSpace > 200 ? trimmed.slice(0, lastSpace) : trimmed) + "…";
  } catch {
    return `Learn about: ${headingText}`;
  }
}

export function generateFAQSchema(
  tocItems: { heading_level: string; text: string }[],
  bodyMarkdown?: string
) {
  const questions = tocItems.filter((item) => item.heading_level === "h2");
  if (questions.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.text,
      acceptedAnswer: {
        "@type": "Answer",
        text: bodyMarkdown ? extractAnswer(q.text, bodyMarkdown) : `Learn about: ${q.text}`,
      },
    })),
  };
}

export function generateOrganizationSchema(
  siteName: string,
  ogImageUrl?: string | null,
  socialUrls?: {
    linkedin_url?: string | null;
    facebook_url?: string | null;
    twitter_handle?: string | null;
  }
) {
  const sameAs: string[] = [];
  if (socialUrls?.linkedin_url) sameAs.push(socialUrls.linkedin_url);
  if (socialUrls?.facebook_url) sameAs.push(socialUrls.facebook_url);
  if (socialUrls?.twitter_handle) {
    const handle = socialUrls.twitter_handle.replace(/^@/, "");
    sameAs.push(`https://twitter.com/${handle}`);
  }

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    ...(ogImageUrl
      ? { logo: { "@type": "ImageObject", url: ogImageUrl } }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function generateWebSiteSchema(siteName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/articles/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateDefinedTermSetSchema(
  terms: { term: string; slug: string; description?: string | null }[],
  glossaryUrl: string,
  siteName?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    ...(siteName ? { name: `${siteName} Glossary` } : { name: "Glossary" }),
    url: glossaryUrl,
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      url: `${glossaryUrl}${t.slug}/`,
      ...(t.description ? { description: t.description } : {}),
    })),
  };
}

export function generateDefinedTermSchema(
  term: { term: string; slug: string; description?: string | null },
  termUrl: string,
  glossaryUrl: string,
  siteName?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.term,
    url: termUrl,
    ...(term.description ? { description: term.description } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      ...(siteName ? { name: `${siteName} Glossary` } : { name: "Glossary" }),
      url: glossaryUrl,
    },
  };
}
