import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who has worked in real estate and mortgage lending for 20 years. You speak plainly, with zero jargon. You give people specific, actionable plans — not generic advice. Write in clear sections with concrete action items. Sound like a coach who actually knows the process, not a chatbot giving generic tips.`;

export async function POST(req: Request) {
  const { targetDate, creditRange, savings, preApprovalStarted, hasRealtor } = await req.json();

  const userPrompt = `Build me a personalized month-by-month homebuying timeline based on my situation:
- Target move-in date: ${targetDate}
- Credit score range: ${creditRange}
- Current savings available: $${savings}
- Pre-approval started: ${preApprovalStarted}
- Have a realtor: ${hasRealtor}

Today's date is approximately ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.

Create a month-by-month action plan working backwards from my target move-in date. For each month:
- Give it a clear heading (e.g., "Month 1 — [Month Name]: Foundation")
- List 2-4 specific, concrete action items — things I can actually do, not vague advice
- Flag any month where timing is critical or could derail the whole plan

Be realistic about whether my timeline is achievable. If it's too compressed, say so directly and tell me what would need to change. If it's plenty of time, say that too.

End with a brief "Watch out for:" section listing the 2-3 things most likely to slow me down based on my specific situation.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1800,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
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
}
