"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-[1280px] mx-auto px-8 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-accent-foreground text-[11px] font-medium tracking-tight shrink-0">
            cd
          </span>
          closing day ready
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/articles"
            className="text-sm font-light text-muted-foreground hover:text-accent transition-colors"
          >
            articles
          </Link>
          <Link
            href="/glossary"
            className="text-sm font-light text-muted-foreground hover:text-accent transition-colors"
          >
            glossary
          </Link>
          <Link
            href="/tools"
            className="text-sm font-light text-muted-foreground hover:text-accent transition-colors"
          >
            tools
          </Link>
          <Link
            href="/about"
            className="text-sm font-light text-muted-foreground hover:text-accent transition-colors"
          >
            about
          </Link>
        </nav>
      </div>
    </header>
  );
}
