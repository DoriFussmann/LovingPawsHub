import { createServiceClient } from "@/lib/supabase/server";
import GlossaryClient from "./GlossaryClient";

export const dynamic = "force-dynamic";

export interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  description: string | null;
  examples: string[];
  resources: { title: string; url: string }[];
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export default async function GlossaryPage() {
  let terms: GlossaryTerm[] = [];
  let glossarySeo = {
    glossary_meta_title: "",
    glossary_meta_description: "",
    glossary_og_title: "",
    glossary_og_description: "",
  };
  let industryName = "";

  try {
    const supabase = createServiceClient();
    const [termsRes, configRes] = await Promise.all([
      supabase
        .from("glossary_terms")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("term", { ascending: true }),
      supabase
        .from("site_config")
        .select("glossary_meta_title, glossary_meta_description, glossary_og_title, glossary_og_description, industry_name")
        .limit(1)
        .maybeSingle(),
    ]);
    terms = (termsRes.data ?? []) as GlossaryTerm[];
    if (configRes.data) {
      const d = configRes.data;
      glossarySeo = {
        glossary_meta_title: d.glossary_meta_title ?? "",
        glossary_meta_description: d.glossary_meta_description ?? "",
        glossary_og_title: d.glossary_og_title ?? "",
        glossary_og_description: d.glossary_og_description ?? "",
      };
      industryName = d.industry_name ?? "";
    }
  } catch {
    // DB not configured yet
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          library
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">glossary</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          manage glossary terms, descriptions, examples, and SEO
        </p>
      </div>
      <GlossaryClient
        initialTerms={terms}
        initialSeo={glossarySeo}
        industryName={industryName}
      />
    </div>
  );
}
