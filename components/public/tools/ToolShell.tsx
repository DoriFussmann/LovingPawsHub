"use client";

import Link from "next/link";

interface ToolShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ToolShell({ eyebrow, title, description, children }: ToolShellProps) {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
      <div className="mb-2">
        <Link
          href="/tools"
          className="text-[10px] tracking-widest uppercase text-foreground/40 hover:text-foreground/70 transition-colors"
        >
          ← tools
        </Link>
      </div>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">{eyebrow}</p>
      <h1 className="text-2xl md:text-3xl font-extralight tracking-tight text-foreground mb-2">
        {title}
      </h1>
      <p className="text-sm font-light text-muted-foreground mb-10 max-w-xl">{description}</p>
      {children}
    </div>
  );
}
