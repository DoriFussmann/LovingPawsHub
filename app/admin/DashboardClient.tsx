"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/admin/StatusBadge";
import type { DashboardCore, DashboardBridge, DashboardCluster, DashboardArticle, DashboardStats } from "./page";

// ─── Extended flat types (add parent context) ─────────────────────────────────

type Tab = "cores" | "bridges" | "clusters" | "articles";

interface FlatBridge extends DashboardBridge {
  coreName: string;
}

interface FlatCluster extends DashboardCluster {
  bridgeName: string;
  coreName: string;
  totalArticles: number;
  publishedArticles: number;
}

interface FlatArticle extends DashboardArticle {
  clusterName: string;
  bridgeName: string;
  coreName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ABBREV: Record<string, string> = {
  CORE: "core", HUB: "hub", FAQ: "faq",
  COMPARISON: "comp", RISK: "risk", GUIDE: "guide",
};

function coreHealth(core: DashboardCore): "green" | "amber" | "gray" {
  const all = core.bridges.flatMap((b) => b.clusters.flatMap((c) => c.articles));
  if (all.length === 0) return "gray";
  if (all.every((a) => a.status === "published" && a.link_status === "wired")) return "green";
  return "amber";
}

function HealthDot({ color }: { color: "green" | "amber" | "gray" }) {
  const cls =
    color === "green" ? "bg-emerald-400" :
    color === "amber" ? "bg-amber-400" :
    "bg-neutral-300";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />;
}

// ─── Shared panel + detail primitives ─────────────────────────────────────────

function PanelRow({
  header,
  meta,
  expanded,
  onClick,
}: {
  header: React.ReactNode;
  meta?: React.ReactNode;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`border rounded-md transition-colors ${
        expanded ? "border-foreground/20 bg-muted/10" : "border-border hover:border-foreground/20"
      }`}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={onClick}
      >
        <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden">
          {header}
        </div>
        {meta && (
          <span className="text-[9px] font-light text-foreground/30 shrink-0">{meta}</span>
        )}
        {expanded
          ? <ChevronDown size={11} className="text-foreground/40 shrink-0" />
          : <ChevronRight size={11} className="text-foreground/30 shrink-0" />}
      </button>
    </div>
  );
}

function DetailCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 mb-2 border border-border/50 rounded-md bg-muted/20 px-5 py-4 space-y-1">
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-0.5">
      <span className="text-[9px] uppercase tracking-widest text-foreground/30 w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs font-light text-foreground/80 flex items-center gap-1.5">
        {value}
      </span>
    </div>
  );
}

function Slug({ value }: { value: string }) {
  return (
    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground/60">
      {value}
    </code>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-border rounded-md p-10 text-center">
      <p className="text-xs font-light text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Cores view ───────────────────────────────────────────────────────────────

function CoresView({ cores }: { cores: DashboardCore[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (cores.length === 0) return <EmptyState message="no core keywords yet." />;

  return (
    <div className="space-y-1.5">
      {cores.map((core) => {
        const health = coreHealth(core);
        const bridgeCount = core.bridges.length;
        const clusterCount = core.bridges.flatMap((b) => b.clusters).length;
        const articleCount = core.bridges.flatMap((b) => b.clusters.flatMap((c) => c.articles)).length;
        const isExpanded = expandedId === core.id;

        return (
          <div key={core.id}>
            <PanelRow
              expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : core.id)}
              header={
                <>
                  <HealthDot color={health} />
                  <span className="text-xs font-light text-foreground/80 truncate">{core.keyword}</span>
                  <span className="text-[10px] font-light text-foreground/35 shrink-0">
                    {bridgeCount}b · {clusterCount}cl · {articleCount}ar
                  </span>
                </>
              }
            />
            {isExpanded && (
              <DetailCard>
                <DetailRow label="slug" value={<Slug value={core.core_id} />} />
                {core.search_volume != null && (
                  <DetailRow label="search vol" value={core.search_volume.toLocaleString()} />
                )}
                <DetailRow label="bridges" value={bridgeCount} />
                <DetailRow label="clusters" value={clusterCount} />
                <DetailRow label="articles" value={articleCount} />
                {core.bridges.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-[9px] uppercase tracking-widest text-foreground/30 mb-2">
                      bridge keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {core.bridges.map((b) => (
                        <span
                          key={b.id}
                          className="text-[10px] font-light border border-border/40 rounded px-2 py-0.5 text-foreground/60"
                        >
                          {b.keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </DetailCard>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bridges view ─────────────────────────────────────────────────────────────

function BridgesView({ bridges }: { bridges: FlatBridge[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (bridges.length === 0) return <EmptyState message="no bridge keywords yet." />;

  return (
    <div className="space-y-1.5">
      {bridges.map((bridge) => {
        const clusterCount = bridge.clusters.length;
        const articleCount = bridge.clusters.flatMap((c) => c.articles).length;
        const isExpanded = expandedId === bridge.id;

        return (
          <div key={bridge.id}>
            <PanelRow
              expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : bridge.id)}
              meta={`↑ ${bridge.coreName}`}
              header={
                <>
                  <span className="text-xs font-light text-foreground/80 truncate">{bridge.keyword}</span>
                  <span className="text-[10px] font-light text-foreground/35 shrink-0">
                    {clusterCount}cl · {articleCount}ar
                  </span>
                </>
              }
            />
            {isExpanded && (
              <DetailCard>
                <DetailRow label="slug" value={<Slug value={bridge.bridge_id} />} />
                <DetailRow label="core keyword" value={bridge.coreName} />
                <DetailRow label="clusters" value={clusterCount} />
                <DetailRow label="articles" value={articleCount} />
              </DetailCard>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Clusters view ────────────────────────────────────────────────────────────

function ClustersView({ clusters }: { clusters: FlatCluster[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (clusters.length === 0) return <EmptyState message="no clusters yet." />;

  return (
    <div className="space-y-1.5">
      {clusters.map((cluster) => {
        const isExpanded = expandedId === cluster.id;
        const allPublished =
          cluster.publishedArticles === cluster.totalArticles && cluster.totalArticles > 0;

        return (
          <div key={cluster.id}>
            <PanelRow
              expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : cluster.id)}
              meta={`↑ ${cluster.bridgeName}`}
              header={
                <>
                  <span className="text-xs font-light text-foreground/80 truncate">
                    {cluster.display_name}
                  </span>
                  <StatusBadge status={cluster.status} />
                  <StatusBadge status={cluster.link_health} />
                  <span className="text-[10px] font-light text-foreground/35 shrink-0">
                    <span className={allPublished ? "text-emerald-600" : "text-amber-500"}>
                      {cluster.publishedArticles}
                    </span>
                    /{cluster.totalArticles}
                  </span>
                </>
              }
            />
            {isExpanded && (
              <DetailCard>
                <DetailRow label="slug" value={<Slug value={cluster.cluster_id} />} />
                <DetailRow label="bridge" value={cluster.bridgeName} />
                <DetailRow label="core" value={cluster.coreName} />
                <DetailRow label="status" value={<StatusBadge status={cluster.status} />} />
                <DetailRow label="link health" value={<StatusBadge status={cluster.link_health} />} />
                {cluster.last_link_check && (
                  <DetailRow
                    label="last checked"
                    value={new Date(cluster.last_link_check).toLocaleDateString()}
                  />
                )}
                <DetailRow
                  label="articles"
                  value={`${cluster.publishedArticles} published / ${cluster.totalArticles} total`}
                />
                {cluster.articles.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-[9px] uppercase tracking-widest text-foreground/30 mb-2">
                      articles
                    </p>
                    <div className="space-y-1.5">
                      {cluster.articles.map((a) => (
                        <div key={a.id} className="flex items-center gap-2.5">
                          <span className="text-[9px] tracking-widest uppercase font-medium text-muted-foreground/50 border border-border/40 rounded px-1 py-0.5 shrink-0">
                            {TYPE_ABBREV[a.content_type] ?? a.content_type.toLowerCase()}
                          </span>
                          <span className="text-xs font-light text-foreground/70 truncate flex-1">
                            {a.h1_title}
                          </span>
                          <StatusBadge status={a.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DetailCard>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Articles view ────────────────────────────────────────────────────────────

function ArticlesView({ articles }: { articles: FlatArticle[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (articles.length === 0) return <EmptyState message="no articles yet." />;

  return (
    <div className="space-y-1.5">
      {articles.map((article) => {
        const isExpanded = expandedId === article.id;

        return (
          <div key={article.id}>
            <PanelRow
              expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : article.id)}
              meta={`↑ ${article.clusterName}`}
              header={
                <>
                  <span className="text-[9px] tracking-widest uppercase font-medium text-muted-foreground/50 border border-border/40 rounded px-1 py-0.5 shrink-0">
                    {TYPE_ABBREV[article.content_type] ?? article.content_type.toLowerCase()}
                  </span>
                  <span className="text-xs font-light text-foreground/80 truncate">
                    {article.h1_title}
                  </span>
                  <StatusBadge status={article.status} />
                </>
              }
            />
            {isExpanded && (
              <DetailCard>
                <DetailRow label="article id" value={<Slug value={article.article_id} />} />
                <DetailRow label="content type" value={article.content_type} />
                <DetailRow label="status" value={<StatusBadge status={article.status} />} />
                <DetailRow label="link status" value={<StatusBadge status={article.link_status} />} />
                <DetailRow
                  label="~words"
                  value={article.word_count > 0 ? `~${article.word_count.toLocaleString()}` : "—"}
                />
                <DetailRow
                  label="int. links"
                  value={article.internal_link_count > 0 ? article.internal_link_count : "—"}
                />
                <DetailRow
                  label="ext. links"
                  value={article.external_link_count > 0 ? article.external_link_count : "—"}
                />
                <div className="mt-3 pt-3 border-t border-border/30 space-y-0.5">
                  <DetailRow label="cluster" value={article.clusterName} />
                  <DetailRow label="bridge" value={article.bridgeName} />
                  <DetailRow label="core" value={article.coreName} />
                </div>
              </DetailCard>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function DashboardClient({
  cores,
  stats,
}: {
  cores: DashboardCore[];
  stats: DashboardStats;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("cores");

  // Derive flat lists from the nested hierarchy
  const allBridges: FlatBridge[] = cores.flatMap((core) =>
    core.bridges.map((bridge) => ({ ...bridge, coreName: core.keyword }))
  );

  const allClusters: FlatCluster[] = cores.flatMap((core) =>
    core.bridges.flatMap((bridge) =>
      bridge.clusters.map((cluster) => ({
        ...cluster,
        bridgeName: bridge.keyword,
        coreName: core.keyword,
        totalArticles: cluster.articles.length,
        publishedArticles: cluster.articles.filter((a) => a.status === "published").length,
      }))
    )
  );

  const allArticles: FlatArticle[] = cores.flatMap((core) =>
    core.bridges.flatMap((bridge) =>
      bridge.clusters.flatMap((cluster) =>
        cluster.articles.map((article) => ({
          ...article,
          clusterName: cluster.display_name,
          bridgeName: bridge.keyword,
          coreName: core.keyword,
        }))
      )
    )
  );

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "cores",    label: "Core",     count: stats.coreKeywords },
    { id: "bridges",  label: "Bridge",   count: stats.bridgeKeywords },
    { id: "clusters", label: "Clusters", count: stats.activeClusters },
    { id: "articles", label: "Articles", count: stats.articlesPublished },
  ];

  return (
    <div>
      {/* ── Stats cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "core keywords",      value: stats.coreKeywords },
          { label: "bridge keywords",    value: stats.bridgeKeywords },
          { label: "active clusters",    value: stats.activeClusters },
          { label: "articles published", value: stats.articlesPublished },
        ].map((s) => (
          <div key={s.label} className="border border-border rounded-md p-5">
            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
              {s.label}
            </p>
            <p className="text-2xl font-extralight tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Split panel ──────────────────────────────────────────────────── */}
      <div className="flex gap-5">

        {/* Left 25% — tab buttons */}
        <div className="w-1/4 shrink-0 flex flex-col gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between px-4 py-3 rounded-md border text-left transition-colors ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-foreground/70 hover:border-foreground/30 hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <span className="text-xs font-light">{tab.label}</span>
                <span
                  className={`text-sm font-extralight tabular-nums ${
                    isActive ? "text-background/50" : "text-foreground/30"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right 75% — accordion content */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[680px]">
          {activeTab === "cores"    && <CoresView    cores={cores} />}
          {activeTab === "bridges"  && <BridgesView  bridges={allBridges} />}
          {activeTab === "clusters" && <ClustersView clusters={allClusters} />}
          {activeTab === "articles" && <ArticlesView articles={allArticles} />}
        </div>

      </div>
    </div>
  );
}
