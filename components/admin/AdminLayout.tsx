"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Lock, TriangleAlert } from "lucide-react";
import DangerZoneModal from "@/components/admin/DangerZoneModal";

const FUNCTIONS_ITEMS = [
  { label: "research core keywords", href: "/admin/research" },
  { label: "core to bridge", href: "/admin/bridges" },
  { label: "active clusters", href: "/admin/clusters" },
  { label: "cluster brief creation", href: "/admin/skeletons" },
  { label: "briefs to articles", href: "/admin/articles" },
  { label: "core articles", href: "/admin/core-articles" },
];

const CONTROLS_ITEMS = [
  { label: "site settings", href: "/admin/site-settings" },
  { label: "general controls", href: "/admin/controls" },
  { label: "published", href: "/admin/published" },
  { label: "links hub", href: "/admin/links" },
  { label: "resources", href: "/admin/resources" },
  { label: "glossary", href: "/admin/glossary" },
  { label: "smoke test", href: "/admin/smoke-test" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [dangerOpen, setDangerOpen] = useState(false);
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-52 border-r border-border flex flex-col py-4 px-3 z-40 bg-background">
        <div className="flex items-center justify-between mb-6 px-2">
          <Link
            href="/"
            className="text-xs font-mono font-light text-foreground/60 tracking-wider hover:text-foreground transition-colors"
            title="Go to home"
          >
            admin
          </Link>
          <Lock size={10} className="text-foreground/40" />
        </div>

        <nav className="flex-1 overflow-y-auto">
          <p className="text-[9px] font-medium uppercase tracking-widest text-foreground/40 mt-2 mb-2 px-2">
            overview
          </p>
          <Link
            href="/admin"
            className={`block text-xs font-light rounded-md border px-3 py-2.5 mb-2 transition-colors ${
              pathname === "/admin"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-foreground/70 hover:text-foreground hover:bg-muted hover:border-foreground/30"
            }`}
          >
            dashboard
          </Link>

          {/* Functions collapsible panel */}
          <button
            onClick={() => setFunctionsOpen((o) => !o)}
            className="w-full flex items-center justify-between mt-4 mb-2 px-2 text-[9px] font-medium uppercase tracking-widest text-foreground/40 hover:text-foreground/60 transition-colors"
          >
            functions
            <ChevronRight
              size={10}
              className={`transition-transform duration-200 ${functionsOpen ? "rotate-90" : ""}`}
            />
          </button>
          {functionsOpen && FUNCTIONS_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block text-xs font-light rounded-md border px-3 py-2.5 mb-2 transition-colors ${
                isActive(item.href)
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-foreground/70 hover:text-foreground hover:bg-muted hover:border-foreground/30"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* Controls collapsible panel */}
          <button
            onClick={() => setControlsOpen((o) => !o)}
            className="w-full flex items-center justify-between mt-4 mb-2 px-2 text-[9px] font-medium uppercase tracking-widest text-foreground/40 hover:text-foreground/60 transition-colors"
          >
            controls
            <ChevronRight
              size={10}
              className={`transition-transform duration-200 ${controlsOpen ? "rotate-90" : ""}`}
            />
          </button>
          {controlsOpen && CONTROLS_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block text-xs font-light rounded-md border px-3 py-2.5 mb-2 transition-colors ${
                isActive(href)
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-foreground/70 hover:text-foreground hover:bg-muted hover:border-foreground/30"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border/30 pt-3 px-2 space-y-2">
          <Link
            href="/"
            className="block text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            ← public site
          </Link>
          <button
            onClick={() => setDangerOpen(true)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] font-light rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            <TriangleAlert size={10} />
            danger zone
          </button>
        </div>
      </aside>

      {dangerOpen && <DangerZoneModal onClose={() => setDangerOpen(false)} />}

      {/* Main content */}
      <div className="ml-52 flex-1 overflow-auto">
        <div className="max-w-[1280px] mx-auto px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
