import Link from "next/link";
import { getSiteConfig, cfg, resolveTokens } from "@/lib/site-config";

export default async function Footer() {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const industryName = process.env.NEXT_PUBLIC_INDUSTRY_NAME || "your industry";
  const copyrightName = cfg(config, "footer_copyright") || siteName;
  const resolvedCopyrightName = resolveTokens(copyrightName, siteName, industryName);
  const twitterHandle = config?.twitter_handle?.trim() || null;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/30 mt-24">
      <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-8 flex items-center justify-between flex-wrap gap-4">
        <p className="text-xs font-light text-muted-foreground tracking-wide">
          © {year} {resolvedCopyrightName.toLowerCase()}
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/articles"
            className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            articles
          </Link>
          <Link
            href="/about"
            className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            about
          </Link>
          {twitterHandle && (
            <a
              href={`https://twitter.com/${twitterHandle.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              twitter
            </a>
          )}
          <a
            href="/sitemap.xml"
            className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            sitemap
          </a>
        </nav>
      </div>
    </footer>
  );
}
