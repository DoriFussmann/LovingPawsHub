/**
 * Fetches or generates a featured image for an article based on the
 * image_provider setting stored in site_config.
 *
 * Providers:
 *  - 'unsplash' — free stock photo search via the Unsplash API
 *                 Requires UNSPLASH_ACCESS_KEY env var.
 *  - 'dalle'    — AI image generation via OpenAI DALL-E 3
 *                 Requires OPENAI_API_KEY env var.
 *  - 'none'     — no image; returns empty result (default)
 */

export interface ImageResult {
  url: string | null;
  alt: string | null;
}

const EMPTY: ImageResult = { url: null, alt: null };

async function fetchUnsplash(query: string): Promise<ImageResult> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.warn("[image-provider] UNSPLASH_ACCESS_KEY not set — skipping image fetch.");
    return EMPTY;
  }
  try {
    const params = new URLSearchParams({ query, per_page: "1", orientation: "landscape" });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return EMPTY;
    const json = await res.json();
    const photo = json?.results?.[0];
    if (!photo) return EMPTY;
    return {
      url: photo.urls?.regular ?? null,
      alt: photo.alt_description || photo.description || query,
    };
  } catch (e) {
    console.error("[image-provider] Unsplash error:", e);
    return EMPTY;
  }
}

async function generateDalle(title: string): Promise<ImageResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("[image-provider] OPENAI_API_KEY not set — skipping DALL-E image generation.");
    return EMPTY;
  }
  try {
    const prompt =
      `A clean, professional editorial photograph suitable for an article titled: "${title}". ` +
      "Minimal composition, neutral background, no text, no logos, high quality.";
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return EMPTY;
    const json = await res.json();
    const url = json?.data?.[0]?.url ?? null;
    return { url, alt: title };
  } catch (e) {
    console.error("[image-provider] DALL-E error:", e);
    return EMPTY;
  }
}

export async function fetchImageForArticle(
  provider: string,
  titleOrQuery: string
): Promise<ImageResult> {
  if (provider === "unsplash") return fetchUnsplash(titleOrQuery);
  if (provider === "dalle") return generateDalle(titleOrQuery);
  return EMPTY;
}
