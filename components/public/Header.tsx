"use client";

import Link from "next/link";

interface HeaderProps {
  siteName?: string;
}

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

const NAV_LINKS = [
  { href: "/articles", label: "Articles" },
  { href: "/glossary", label: "Glossary" },
  { href: "/tools",    label: "Tools" },
  { href: "/about",    label: "About" },
];

export default function Header({ siteName }: HeaderProps) {
  const displayName = siteName || "Loving Paws Hub";

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1280px] mx-auto px-6 md:px-14 py-[18px] flex items-center justify-between gap-8">

        {/* Logo mark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label={displayName}
        >
          <span className="text-accent group-hover:text-primary-strong transition-colors">
            <PawIcon />
          </span>
          <span className="text-[15px] font-medium tracking-[-0.01em] text-foreground leading-none">
            {displayName}
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-ds-text-muted hover:text-foreground font-normal transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex btn btn-ghost btn-sm"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="btn btn-primary btn-sm"
          >
            Join free
          </Link>
        </div>
      </div>
    </header>
  );
}
