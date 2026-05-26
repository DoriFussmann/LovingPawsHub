import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a helpful assistant for a homebuyer who is tracking their property purchase. 
You have access to their property data, topic statuses, and recent activity log. 
Answer their questions clearly and concisely based on the information provided. 
Be encouraging but honest. Speak like a knowledgeable friend, not a chatbot.`;

export async function POST(req: Request) {
  try {
    const { question, propertyId } = await req.json();

    if (!question || !propertyId) {
      return Response.json({ error: "question and propertyId are required" }, { status: 400 });
    }

    // Verify user owns the property using the auth session
    const cookieStore = cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch property data using service role to bypass RLS complexity in joins
    const service = createServiceClient();

    const { data: property } = await service
      .from("properties")
      .select("address, purchase_price, closing_date, next_steps, action_items")
      .eq("id", propertyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!property) {
      return Response.json({ error: "Property not found" }, { status: 404 });
    }

    const { data: topics } = await service
      .from("topics")
      .select("name, icon, status, summary, details, notes")
      .eq("property_id", propertyId)
      .order("created_at");

    const { data: logs } = await service
      .from("log_entries")
      .select("content, ai_summary, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(20);

    const context = `
PROPERTY:
Address: ${property.address}
Purchase price: ${property.purchase_price ? `$${property.purchase_price.toLocaleString()}` : "not set"}
Closing date: ${property.closing_date || "not set"}
Next steps: ${JSON.stringify(property.next_steps)}
Action items: ${JSON.stringify(property.action_items)}

TOPICS:
${(topics ?? []).map((t) => `- ${t.icon ?? ""} ${t.name} [${t.status}]${t.summary ? `: ${t.summary}` : ""}${t.notes ? `\n  Notes: ${t.notes}` : ""}${t.details && Object.keys(t.details).length > 0 ? `\n  Details: ${JSON.stringify(t.details)}` : ""}`).join("\n")}

RECENT ACTIVITY (newest first):
${(logs ?? []).map((l) => `- ${new Date(l.created_at).toLocaleDateString()}: ${l.ai_summary || l.content}`).join("\n")}
`.trim();

    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is my property data:\n\n${context}\n\nMy question: ${question}`,
        },
      ],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[chat]", err);
    return Response.json({ error: "Failed to respond" }, { status: 500 });
  }
}
