import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who has worked in mortgage lending and real estate finance for 20 years. You speak plainly, with zero jargon. You never hedge excessively or cover liability. You tell people exactly what you think, including when the news isn't good. Write in clear paragraphs with occasional labeled sections when it helps — no bullet-point soup. Sound like a real person giving real information, not a legal disclaimer.`;

export async function POST(req: Request) {
  const { score } = await req.json();

  if (!score || isNaN(Number(score)) || Number(score) < 300 || Number(score) > 850) {
    return new Response("Invalid score", { status: 400 });
  }

  const userPrompt = `My credit score is ${score}. Explain in plain English:
1. What this score actually means — what tier I'm in and what that tells lenders about me
2. Which loan types I qualify for (conventional, FHA, VA, USDA) and any restrictions
3. What interest rate tier I'm likely in right now (be specific, give a realistic range)
4. What improving by 20 points would do for me — concretely, in dollars saved over a 30-year loan
5. What improving by 50 points would do
6. The 2-3 most impactful things I can do right now to move the needle

Be direct and specific. No generic advice. Make it feel like you're talking about MY score specifically.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
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
