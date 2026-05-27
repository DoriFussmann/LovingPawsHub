import Link from "next/link";
import { getSiteConfig, cfg, resolveTokens } from "@/lib/site-config";

function PawIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="6"  cy="10" rx="2.1" ry="2.7" />
      <ellipse cx="10" cy="6.5" rx="2"   ry="2.6" />
      <ellipse cx="14" cy="6.5" rx="2"   ry="2.6" />
      <ellipse cx="18" cy="10" rx="2.1" ry="2.7" />
      <path d="M12 11.5c-3.4 0-6.2 2.5-6.2 5.2 0 1.7 1.4 2.8 3 2.8 1.1 0 2-.5 3.2-.5s2.1.5 3.2.5c1.6 0 3-1.1 3-2.8 0-2.7-2.8-5.2-6.2-5.2Z" />
    </svg>
  );
}

const BASE_NAV_COLUMNS = [
  {
    label: "Topics",
    links: [
      { href: "/articles", label: "All articles" },
      { href: "/glossary", label: "Glossary" },
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/tools", label: "All tools" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/sitemap.xml", label: "Sitemap" },
    ],
  },
];

export default async function Footer() {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name") || "Loving Paws Hub";
  const industryName = process.env.NEXT_PUBLIC_INDUSTRY_NAME || "your industry";
  const copyrightName = cfg(config, "footer_copyright") || siteName;
  const resolvedCopyrightName = resolveTokens(copyrightName, siteName, industryName);
  const twitterHandle = config?.twitter_handle?.trim() || null;
  const year = new Date().getFullYear();

  const navColumns = BASE_NAV_COLUMNS.map((col, i) => {
    if (i === 2 && twitterHandle) {
      return {
        ...col,
        links: [
          ...col.links,
          {
            href: `https://twitter.com/${twitterHandle.replace(/^@/, "")}`,
            label: "Twitter / X",
          },
        ],
      };
    }
    return col;
  });

  return (
    <footer style={{ background: "var(--foreground)", color: "var(--card)" }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-14 pt-14 pb-10">

        {/* Top row */}
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 md:gap-8 mb-12">

          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span style={{ color: "var(--primary-soft)" }}>
                <PawIcon />
              </span>
              <span className="text-[22px] font-extralight tracking-[-0.02em] leading-none">
                {siteName}
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(250,246,238,0.65)", maxWidth: "260px" }}>
              Trustworthy pet care content written and reviewed by working vets.
            </p>
          </div>

          {/* Nav columns */}
          {navColumns.map((col) => (
            <div key={col.label}>
              <p
                className="text-[11px] font-medium tracking-[0.08em] uppercase mb-4"
                style={{ color: "rgba(250,246,238,0.45)" }}
              >
                {col.label}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors opacity-75 hover:opacity-100"
                      style={{ color: "var(--ds-cream)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <hr style={{ border: 0, borderTop: "1px solid rgba(250,246,238,0.10)", marginBottom: "1.25rem" }} />

        {/* Bottom row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs" style={{ color: "rgba(250,246,238,0.4)" }}>
            © {year} {resolvedCopyrightName}. Every article reviewed by a licensed vet.
          </p>
          <nav className="flex items-center gap-5" aria-label="Legal">
            {[
              { href: "/sitemap.xml", label: "Sitemap" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs transition-colors"
                style={{ color: "rgba(250,246,238,0.4)" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
