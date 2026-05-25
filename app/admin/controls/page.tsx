import { createServiceClient } from "@/lib/supabase/server";
import {
  defaultConfig,
  defaultArticleConfig,
  defaultCoreArticleConfig,
  SKELETON_SETTINGS_KEY,
  ARTICLE_SETTINGS_KEY,
  CORE_ARTICLE_SETTINGS_KEY,
  type PromptConfig,
  type ArticlePromptConfig,
  type CoreArticlePromptConfig,
} from "@/lib/promptTemplates";
import {
  DEFAULT_SCORING_WEIGHTS,
  SCORING_WEIGHTS_KEY,
  type ScoringWeights,
} from "@/components/admin/ScoringWeightsModal";
import ControlsClient from "./ControlsClient";

export const dynamic = "force-dynamic";

export default async function ControlsPage() {
  let skeletonConfig: PromptConfig = defaultConfig();
  let articleConfig: ArticlePromptConfig = defaultArticleConfig();
  let coreArticleConfig: CoreArticlePromptConfig = defaultCoreArticleConfig();
  let scoringWeights: ScoringWeights = DEFAULT_SCORING_WEIGHTS;

  try {
    const supabase = createServiceClient();
    const [skelRes, artRes, coreArtRes, weightRes] = await Promise.all([
      supabase.from("settings").select("value").eq("key", SKELETON_SETTINGS_KEY).maybeSingle(),
      supabase.from("settings").select("value").eq("key", ARTICLE_SETTINGS_KEY).maybeSingle(),
      supabase.from("settings").select("value").eq("key", CORE_ARTICLE_SETTINGS_KEY).maybeSingle(),
      supabase.from("settings").select("value").eq("key", SCORING_WEIGHTS_KEY).maybeSingle(),
    ]);
    if (skelRes.data?.value) skeletonConfig = skelRes.data.value as PromptConfig;
    if (artRes.data?.value) articleConfig = artRes.data.value as ArticlePromptConfig;
    if (coreArtRes.data?.value) coreArticleConfig = coreArtRes.data.value as CoreArticlePromptConfig;
    if (weightRes.data?.value) scoringWeights = weightRes.data.value as ScoringWeights;
  } catch {
    // fall back to defaults
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">controls</p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">general controls</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          all editable settings — changes are saved to the database and apply across all machines.
        </p>
      </div>
      <ControlsClient
        skeletonConfig={skeletonConfig}
        articleConfig={articleConfig}
        coreArticleConfig={coreArticleConfig}
        scoringWeights={scoringWeights}
      />
    </div>
  );
}
