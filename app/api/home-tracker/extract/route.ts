import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { fileUrl, fileType, topicName } = await req.json();

    if (!fileUrl || !topicName) {
      return Response.json({ error: "fileUrl and topicName are required" }, { status: 400 });
    }

    // Fetch the document and convert to base64
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return Response.json({ error: "Could not fetch file" }, { status: 400 });
    }
    const buffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Determine content block type: PDFs use "document", images use "image"
    const isPdf =
      fileType === "application/pdf" ||
      fileUrl.toLowerCase().endsWith(".pdf");

    const mediaType = isPdf
      ? "application/pdf"
      : (fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") || "image/jpeg";

    type ContentBlock =
      | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
      | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
      | { type: "text"; text: string };

    const contentBlocks: ContentBlock[] = [
      isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 } },
      {
        type: "text",
        text: `Extract all structured fields relevant to a "${topicName}" document in a home purchase. Return only a JSON object with key-value pairs (string keys and string values). Include every field, number, date, name, and amount you can find. No explanation, just the JSON object.`,
      },
    ];

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      return Response.json({ error: "Unexpected Claude response" }, { status: 500 });
    }

    // Strip markdown fences if present
    const cleaned = block.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const fields: Record<string, string> = JSON.parse(cleaned);
    return Response.json({ fields });
  } catch (err) {
    console.error("[extract]", err);
    return Response.json({ error: "Failed to extract fields" }, { status: 500 });
  }
}
