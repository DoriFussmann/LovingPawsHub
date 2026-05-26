import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who has worked in real estate and mortgage lending for 20 years. You speak plainly, with zero jargon. You are not here to make people feel good — you're here to tell them the truth about where they stand. You never hedge excessively. Write in clear paragraphs with labeled sections. Sound like the most honest person in the room, not a financial advisor covering liability.`;

export async function POST(req: Request) {
  const { answers } = await req.json();

  const answersText = Object.entries(answers as Record<string, string>)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n");

  const userPrompt = `Here are my answers to a first-time homebuyer readiness assessment:

${answersText}

Based on these answers, give me a personalized readiness verdict. Structure it like this:

**Your verdict:** [one clear sentence — "ready," "not ready yet," or "it depends, here's what to resolve"]

Then explain the verdict in 2-3 paragraphs — what's working in my favor, what's not, and how confident you are.

**What to do next:** Give me 3-5 specific, concrete action items based on my specific answers. Not generic advice — actions that apply directly to what I told you.

Be direct. If I'm not ready, say why clearly. If I am ready, say what I should do this week. If it depends, tell me exactly what I need to resolve and in what order.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1400,
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
