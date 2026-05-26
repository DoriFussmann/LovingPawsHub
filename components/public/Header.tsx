"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/20 bg-background/95 backdrop-blur-sm">
      <div className="max-w-[1280px] mx-auto px-8 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-light tracking-wide border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          home
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/articles"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            articles
          </Link>
          <Link
            href="/glossary"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            glossary
          </Link>
          <Link
            href="/tools"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            tools
          </Link>
          <Link
            href="/about"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            about
          </Link>
        </nav>
      </div>
    </header>
  );
}
