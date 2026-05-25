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
  HUB: "hub",
  FAQ: "faq",
  COMPARISON: "comparison",
  RISK: "risk",
  GUIDE: "guide",
  CORE: "core",
};

export default function ArticleCard({ article }: ArticleCardProps) {
  const readingTime = estimateReadingTime(article.body_markdown);
  const href = `/${article.core_id}/${article.bridge_id}/${article.slug}/`;

  return (
    <Link href={href}>
      <div className="border border-border rounded-md overflow-hidden hover:bg-muted/50 transition-colors h-full flex flex-col">
        {article.featured_image_url && (
          <div className="relative w-full aspect-[16/9] bg-muted flex-shrink-0">
            <Image
              src={article.featured_image_url}
              alt={article.featured_image_alt ?? article.h1_title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          </div>
        )}
        <div className="p-4 flex flex-col justify-between gap-3 flex-1">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] tracking-widest uppercase font-medium text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">
                {CONTENT_TYPE_LABELS[article.content_type] ?? article.content_type}
              </span>
              {article.is_core_article && article.content_type !== "CORE" && (
                <span className="text-[9px] tracking-widests uppercase font-medium text-foreground border border-foreground/20 rounded px-1.5 py-0.5">
                  core
                </span>
              )}
            </div>
            <h2 className="text-sm font-light text-foreground leading-snug">
              {article.h1_title}
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-light">
              {article.published_at ? formatDate(article.published_at) : article.primary_keyword}
            </span>
            <span className="text-[10px] text-muted-foreground font-light">
              {readingTime}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
