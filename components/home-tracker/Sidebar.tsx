"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Topic = {
  id: string;
  name: string;
  icon: string | null;
  status: string;
};

type Property = {
  id: string;
  address: string;
} | null;

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-foreground/20",
  in_progress: "bg-info-ink",
  pending: "bg-warn-ink",
  completed: "bg-ok-ink",
  issue: "bg-err-ink",
};

export default function Sidebar({
  property,
  topics,
}: {
  property: Property;
  topics: Topic[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  if (collapsed) {
    return (
      <div className="flex flex-col items-center pt-1 gap-3 w-8 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-foreground/40 hover:text-foreground/70 transition-colors p-1"
          title="Expand sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <aside className="w-52 shrink-0 flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40">
          Home Tracker
        </p>
        <button
          onClick={() => setCollapsed(true)}
          className="text-foreground/30 hover:text-foreground/60 transition-colors p-1"
          title="Collapse sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 3h10M1 6h10M1 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Property name */}
      {property && (
        <p className="text-xs font-light text-foreground/60 mb-3 leading-snug truncate" title={property.address}>
          {property.address}
        </p>
      )}

      {/* Overview link */}
      <Link
        href="/tools/home-tracker/dashboard"
        className={`flex items-center gap-2 text-xs font-light rounded px-2 py-1.5 transition-colors ${
          isActive("/tools/home-tracker/dashboard")
            ? "bg-accent text-accent-foreground"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="text-base leading-none">🏠</span>
        <span>Overview</span>
      </Link>

      {/* Topics */}
      {topics.length > 0 && (
        <>
          <p className="text-[9px] tracking-widest uppercase text-foreground/30 mt-3 mb-1 px-2">
            Topics
          </p>
          {topics.map((topic) => {
            const href = `/tools/home-tracker/topic/${topic.id}`;
            const active = isActive(href);
            return (
              <Link
                key={topic.id}
                href={href}
                className={`flex items-center gap-2 text-xs font-light rounded px-2 py-1.5 transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[topic.status] ?? STATUS_DOT.not_started}`}
                />
                <span className="truncate">{topic.name}</span>
              </Link>
            );
          })}
        </>
      )}

      {/* Bottom sign-out */}
      <div className="mt-auto pt-6">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-[10px] tracking-widest uppercase text-foreground/30 hover:text-foreground/60 transition-colors px-2"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
