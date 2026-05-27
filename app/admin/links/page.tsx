import { createServiceClient } from "@/lib/supabase/server";
import LinksClient from "./LinksClient";

export const dynamic = "force-dynamic";

export interface ClusterLinkData {
  cluster_id: string;
  cluster_db_id: string;
  display_name: string;
  link_health: string | null;
  last_link_check: string | null;
  articles: ArticleLinkData[];
}

export interface ArticleLinkData {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  link_status: string;
  content_type: string;
  internal_links: InternalLinkData[];
  external_links: ExternalLinkData[];
}

export interface InternalLinkData {
  anchor_phrase: string;
  target_slug: string;
  target_url: string | null;
  found: boolean;
}

export interface ExternalLinkData {
  url: string;
  anchor: string;
}

export default async function LinksPage() {
  let clusters: ClusterLinkData[] = [];

  try {
    const supabase = createServiceClient();

    // Fetch all published articles with their link data, joined to cluster info
    const { data: articles } = await supabase
      .from("articles")
      .select(`
        id, article_id, h1_title, slug, core_id, bridge_id, link_status, content_type,
        internal_links_injected, external_links,
        article_skeletons(
          cluster_id,
          clusters(id, cluster_id, display_name, link_health, last_link_check)
        )
      `)
      .eq("status", "published")
      .order("article_id");

    if (articles) {
      // Build a slug → { core_id, bridge_id } map for resolving internal link URLs
      const slugMap = new Map<string, { core_id: string; bridge_id: string }>();
      for (const a of articles) {
        slugMap.set(a.slug, { core_id: a.core_id, bridge_id: a.bridge_id });
      }

      // Group by cluster
      const clusterMap = new Map<string, ClusterLinkData>();

      for (const a of articles) {
        let clusterDbId: string;
        let clusterId: string;
        let displayName: string;
        let linkHealth: string | null = null;
        let lastLinkCheck: string | null = null;

        const skeleton = a.article_skeletons as unknown as Record<string, unknown> | null;
        const clusterRaw = skeleton?.clusters as Record<string, unknown> | null;

        if (clusterRaw) {
          clusterDbId = clusterRaw.id as string;
          clusterId = clusterRaw.cluster_id as string;
          displayName = clusterRaw.display_name as string;
          linkHealth = (clusterRaw.link_health as string | null) ?? null;
          lastLinkCheck = (clusterRaw.last_link_check as string | null) ?? null;
        } else {
          // Article was published without a skeleton — group by bridge_id
          const bridgeKey = `${a.core_id}__${a.bridge_id}`;
          clusterDbId = bridgeKey;
          clusterId = bridgeKey;
          displayName = a.bridge_id
            .split("-")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }

        if (!clusterMap.has(clusterDbId)) {
          clusterMap.set(clusterDbId, {
            cluster_id: clusterId,
            cluster_db_id: clusterDbId,
            display_name: displayName,
            link_health: linkHealth,
            last_link_check: lastLinkCheck,
            articles: [],
          });
        }

        const rawInternal = (a.internal_links_injected ?? []) as Array<{
          anchor_phrase: string;
          target_slug: string;
          found: boolean;
          target_url?: string;
        }>;

        const internalLinks: InternalLinkData[] = rawInternal.map((l) => {
          const target = slugMap.get(l.target_slug);
          const target_url = target
            ? `/${target.core_id}/${target.bridge_id}/${l.target_slug}/`
            : null;
          return {
            anchor_phrase: l.anchor_phrase,
            target_slug: l.target_slug,
            target_url: l.target_url ?? target_url,
            found: l.found,
          };
        });

        const rawExternal = (a.external_links ?? []) as Array<{
          url: string;
          anchor: string;
        }>;

        clusterMap.get(clusterDbId)!.articles.push({
          id: a.id,
          article_id: a.article_id,
          h1_title: a.h1_title,
          slug: a.slug,
          core_id: a.core_id,
          bridge_id: a.bridge_id,
          link_status: a.link_status,
          content_type: (a.content_type as string) ?? "",
          internal_links: internalLinks,
          external_links: rawExternal,
        });
      }

      clusters = Array.from(clusterMap.values());
    }
  } catch (e) {
    console.error("[links page] DB error:", e);
  }

  const totalArticles = clusters.reduce((n, c) => n + c.articles.length, 0);
  const totalInternal = clusters.reduce(
    (n, c) => n + c.articles.reduce((m, a) => m + a.internal_links.length, 0),
    0
  );
  const totalExternal = clusters.reduce(
    (n, c) => n + c.articles.reduce((m, a) => m + a.external_links.length, 0),
    0
  );

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">library</p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">links hub</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          {totalArticles} articles · {totalInternal} internal links · {totalExternal} external links
        </p>
      </div>
      <LinksClient clusters={clusters} />
    </div>
  );
}
