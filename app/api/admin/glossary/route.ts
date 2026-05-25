import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { toKebabCase } from "@/lib/slugify";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("glossary_terms")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("term", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ terms: data ?? [] });
  } catch (err: unknown) {
    console.error("[glossary GET]", err);
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { term, description, examples, resources, meta_title, meta_description, og_title, og_description, status, sort_order } = body;
    if (!term?.trim()) {
      return NextResponse.json({ error: "term is required" }, { status: 400 });
    }
    const slug = toKebabCase(term.trim());
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("glossary_terms")
      .insert({
        term: term.trim(),
        slug,
        description: description ?? null,
        examples: examples ?? [],
        resources: resources ?? [],
        meta_title: meta_title ?? null,
        meta_description: meta_description ?? null,
        og_title: og_title ?? null,
        og_description: og_description ?? null,
        status: status ?? "published",
        sort_order: sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ term: data }, { status: 201 });
  } catch (err: unknown) {
    console.error("[glossary POST]", err);
    const msg = extractErrorMessage(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, term, description, examples, resources, meta_title, meta_description, og_title, og_description, status, sort_order } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const supabase = createServiceClient();
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (term !== undefined) { updatePayload.term = term.trim(); updatePayload.slug = toKebabCase(term.trim()); }
    if (description !== undefined) updatePayload.description = description;
    if (examples !== undefined) updatePayload.examples = examples;
    if (resources !== undefined) updatePayload.resources = resources;
    if (meta_title !== undefined) updatePayload.meta_title = meta_title;
    if (meta_description !== undefined) updatePayload.meta_description = meta_description;
    if (og_title !== undefined) updatePayload.og_title = og_title;
    if (og_description !== undefined) updatePayload.og_description = og_description;
    if (status !== undefined) updatePayload.status = status;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;
    const { data, error } = await supabase
      .from("glossary_terms")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ term: data });
  } catch (err: unknown) {
    console.error("[glossary PUT]", err);
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const supabase = createServiceClient();
    const { error } = await supabase.from("glossary_terms").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[glossary DELETE]", err);
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}
