import { createServiceClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export interface DashboardStats {
  articlesPublished: number;
  activeClusters: number;
  coreKeywords: number;
  bridgeKeywords: number;
}

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardArticle {
  id: string;
  article_id: string;
  h1_title: string;
  content_type: string;
  status: string;
  link_status: string;
  word_count: number;
  internal_link_count: number;
  external_link_count: number;
}

export interface DashboardCluster {
  id: string;
  cluster_id: string;
  display_name: string;
  status: string;
  link_health: string;
  last_link_check: string | null;
  articles: DashboardArticle[];
}

export interface DashboardBridge {
  id: string;
  bridge_id: string;
  keyword: string;
  clusters: DashboardCluster[];
}

export interface DashboardCore {
  id: string;
  core_id: string;
  keyword: string;
  search_volume: number | null;
  bridges: DashboardBridge[];
}

// ─── Server component ─────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  let cores: DashboardCore[] = [];
  let stats: DashboardStats = {
    articlesPublished: 0,
    activeClusters: 0,
    coreKeywords: 0,
    bridgeKeywords: 0,
  };
  let error = "";

  try {
    const supabase = createServiceClient();

    // Parallel: hierarchy query + aggregate counts
    const [hierarchyRes, articlesRes, clustersRes, coresRes, bridgesRes] =
      await Promise.all([
        supabase
          .from("core_keywords")
          .select(`
            id, core_id, keyword, search_volume,
            bridge_keywords (
              id, bridge_id, keyword,
              clusters (
                id, cluster_id, display_name, status, link_health, last_link_check,
                article_skeletons (
                  id,
                  articles (
                    id, article_id, h1_title, content_type, status, link_status,
                    body_markdown, internal_links_injected, external_links
                  )
                )
              )
            )
          `)
          .order("created_at"),
        supabase.from("articles").select("id", { count: "exact" }).eq("status", "published"),
        supabase.from("clusters").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("core_keywords").select("id", { count: "exact" }),
        supabase.from("bridge_keywords").select("id", { count: "exact" }),
      ]);

    stats = {
      articlesPublished: articlesRes.count ?? 0,
      activeClusters: clustersRes.count ?? 0,
      coreKeywords: coresRes.count ?? 0,
      bridgeKeywords: bridgesRes.count ?? 0,
    };

    // Reshape raw Supabase response into clean typed hierarchy
    type RawArticle = {
      id: string; article_id: string; h1_title: string; content_type: string;
      status: string; link_status: string; body_markdown: string;
      internal_links_injected: unknown[] | null;
      external_links: unknown[] | null;
    };
    type RawSkeleton = { id: string; articles: RawArticle[] | RawArticle | null };
    type RawCluster = {
      id: string; cluster_id: string; display_name: string;
      status: string; link_health: string; last_link_check: string | null;
      article_skeletons: RawSkeleton[] | null;
    };
    type RawBridge = {
      id: string; bridge_id: string; keyword: string;
      clusters: RawCluster[] | null;
    };
    type RawCore = {
      id: string; core_id: string; keyword: string; search_volume: number | null;
      bridge_keywords: RawBridge[] | null;
    };

    const raw = (hierarchyRes.data ?? []) as RawCore[];

    cores = raw.map((core) => ({
      id: core.id,
      core_id: core.core_id,
      keyword: core.keyword,
      search_volume: core.search_volume,
      bridges: (core.bridge_keywords ?? []).map((bridge) => ({
        id: bridge.id,
        bridge_id: bridge.bridge_id,
        keyword: bridge.keyword,
        clusters: (bridge.clusters ?? []).map((cluster) => {
          const skeletons = cluster.article_skeletons ?? [];
          const articles: DashboardArticle[] = skeletons.flatMap((sk) => {
            // articles is sometimes a single object, sometimes an array
            const arts = sk.articles
              ? Array.isArray(sk.articles) ? sk.articles : [sk.articles]
              : [];
            return arts.map((a) => ({
              id: a.id,
              article_id: a.article_id,
              h1_title: a.h1_title,
              content_type: a.content_type,
              status: a.status,
              link_status: a.link_status,
              word_count: Math.round((a.body_markdown ?? "").length / 5),
              internal_link_count: Array.isArray(a.internal_links_injected)
                ? a.internal_links_injected.length
                : 0,
              external_link_count: Array.isArray(a.external_links)
                ? a.external_links.length
                : 0,
            }));
          });
          return {
            id: cluster.id,
            cluster_id: cluster.cluster_id,
            display_name: cluster.display_name,
            status: cluster.status,
            link_health: cluster.link_health,
            last_link_check: cluster.last_link_check,
            articles,
          };
        }),
      })),
    }));
  } catch (e) {
    error = "database not configured — run the sql schema in supabase to get started.";
    console.error("[dashboard]", e);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">dashboard</h1>
      </div>

      {error && (
        <div className="border border-border rounded-md p-4 mb-6 bg-muted/30">
          <p className="text-xs font-light text-muted-foreground">{error}</p>
        </div>
      )}

      <DashboardClient cores={cores} stats={stats} />
    </div>
  );
}
