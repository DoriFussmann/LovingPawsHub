import Link from "next/link";
import Image from "next/image";

interface ArticleCardProps {
  article: {
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
    published_at?: string;
    featured_image_url?: string | null;
    featured_image_alt?: string | null;
  };
}

function estimateReadingTime(markdown: string): string {
  const words = markdown.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 230));
  return `${mins} min read`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  HUB:        "hub",
  FAQ:        "faq",
  COMPARISON: "comparison",
  RISK:       "risk",
  GUIDE:      "guide",
  CORE:       "core",
};

export default function ArticleCard({ article }: ArticleCardProps) {
  const readingTime = estimateReadingTime(article.body_markdown);
  const href = `/${article.core_id}/${article.bridge_id}/${article.slug}/`;
  const typeLabel = CONTENT_TYPE_LABELS[article.content_type] ?? article.content_type.toLowerCase();

  return (
    <Link href={href} className="block group h-full">
      <div className="card card-hover h-full flex flex-col overflow-hidden">
        {article.featured_image_url && (
          <div className="relative w-full aspect-[16/9] bg-muted flex-shrink-0 overflow-hidden">
            <Image
              src={article.featured_image_url}
              alt={article.featured_image_alt ?? article.h1_title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              unoptimized={
                !article.featured_image_url.includes(".supabase.co") &&
                !article.featured_image_url.includes("images.unsplash.com") &&
                !article.featured_image_url.includes(".blob.core.windows.net")
              }
            />
          </div>
        )}

        <div className="p-5 flex flex-col gap-3 flex-1">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="tag">{typeLabel}</span>
          </div>

          {/* Title */}
          <h2 className="text-h4 text-foreground leading-snug group-hover:text-accent transition-colors flex-1">
            {article.h1_title}
          </h2>

          {/* Meta */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-meta">
              {article.published_at
                ? formatDate(article.published_at)
                : article.primary_keyword}
            </span>
            <span className="text-meta">{readingTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
