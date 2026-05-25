import type { SupabaseClient } from "@supabase/supabase-js";

export interface InternalLink {
  anchor_phrase: string;
  target_slug: string;
  found: boolean;
  target_url?: string;
}

export interface Article {
  id?: string;
  article_id: string;
  core_id: string;
  bridge_id: string;
  slug: string;
  body_markdown: string;
  internal_links_injected: InternalLink[];
  link_status: string;
  [key: string]: unknown;
}

export async function injectInternalLinks(
  article: Article,
  supabase: SupabaseClient,
  maxInlineLinks = 4
): Promise<Article> {
  const { body_markdown, internal_links_injected } = article;
  let updatedBody = body_markdown;
  // Track how many new inline links we inject this pass so we respect the cap.
  // Links already present in the body (found=true) don't count against it.
  let newLinksInjected = 0;

  // Resolve every target_slug to its real core_id + bridge_id from the DB.
  // This is the fix for Bug 1: the previous code always used the source
  // article's core/bridge, producing wrong URLs for cross-bridge links.
  const slugs = Array.from(new Set(internal_links_injected.map((l) => l.target_slug).filter(Boolean)));
  const slugMap = new Map<string, { core_id: string; bridge_id: string }>();

  if (slugs.length > 0) {
    const { data: targets } = await supabase
      .from("articles")
      .select("slug, core_id, bridge_id")
      .in("slug", slugs);

    for (const t of targets ?? []) {
      slugMap.set(t.slug, { core_id: t.core_id, bridge_id: t.bridge_id });
    }
  }

  const linkResults = internal_links_injected.map((link) => {
    if (!link.anchor_phrase || !link.target_slug) {
      return { ...link, found: false };
    }

    // Determine the correct URL, falling back to the source article's
    // core/bridge only if the target slug isn't in the DB yet.
    const target = slugMap.get(link.target_slug);
    const coreId = target?.core_id ?? article.core_id;
    const bridgeId = target?.bridge_id ?? article.bridge_id;
    const href = `/${coreId}/${bridgeId}/${link.target_slug}/`;

    // Check if this link has already been injected (avoid double-linking).
    if (updatedBody.includes(`](${href})`)) {
      return { ...link, found: true, target_url: href };
    }

    const escaped = link.anchor_phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // If the anchor phrase is already inside a markdown link with a WRONG URL
    // (e.g. bare-slug from article generation like [payday loans](payday-loans)),
    // replace the entire existing [text](wrong-url) with the correct URL instead
    // of wrapping it again (which would produce [[text](correct-url)](wrong-url)).
    const existingLinkRegex = new RegExp(`\\[${escaped}\\]\\([^)]*\\)`, "i");
    if (existingLinkRegex.test(updatedBody)) {
      updatedBody = updatedBody.replace(
        existingLinkRegex,
        `[${link.anchor_phrase}](${href})`
      );
      return { ...link, found: true, target_url: href };
    }

    // Respect the per-article cap on newly injected inline links.
    if (newLinksInjected >= maxInlineLinks) {
      return { ...link, found: false, target_url: href };
    }

    // Case-insensitive search for the anchor phrase as plain text in the body.
    const regex = new RegExp(escaped, "i");

    if (!regex.test(updatedBody)) {
      return { ...link, found: false, target_url: href };
    }

    // Replace the first occurrence (no `g` flag) with a proper markdown link.
    updatedBody = updatedBody.replace(regex, `[${link.anchor_phrase}](${href})`);
    newLinksInjected++;
    return { ...link, found: true, target_url: href };
  });

  const allFound = linkResults.length > 0 && linkResults.every((l) => l.found);
  const noneFound = linkResults.length === 0 || linkResults.every((l) => !l.found);
  const link_status = allFound ? "wired" : noneFound ? "unwired" : "partial";

  return {
    ...article,
    body_markdown: updatedBody,
    internal_links_injected: linkResults,
    link_status,
  };
}
