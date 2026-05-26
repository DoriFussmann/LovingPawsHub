import { callClaudeJSON } from "@/lib/anthropic";

const SYSTEM = `You are a concise assistant helping a homebuyer track their purchase process. 
Summarize activity log entries clearly and briefly.`;

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== "string") {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const result = await callClaudeJSON<{ summary: string }>(
      SYSTEM,
      `Summarize this home buying activity log entry in 1–2 sentences. Return JSON with a single "summary" key.\n\nLog entry:\n${content}`,
      256
    );

    return Response.json({ summary: result.summary });
  } catch (err) {
    console.error("[summarize]", err);
    return Response.json({ error: "Failed to summarize" }, { status: 500 });
  }
}
