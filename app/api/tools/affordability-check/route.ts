import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who has worked in mortgage lending and real estate finance for 20 years. You speak plainly, with zero jargon. You never hedge excessively or cover liability. You tell people exactly what you think, including when the news isn't good. Write in clear, organized sections with specific numbers — no vague platitudes. Sound like a real person giving real talk, not a chatbot covering liability.`;

export async function POST(req: Request) {
  const { grossIncome, monthlyDebt, savings, location, creditRange } = await req.json();

  const userPrompt = `Here's my financial situation:
- Gross annual income: $${grossIncome}
- Monthly debt payments: $${monthlyDebt}
- Available savings (for down payment + closing costs): $${savings}
- Looking in: ${location}
- Credit score range: ${creditRange}

Give me a realistic affordability analysis covering:
1. What price range I can actually afford (be specific — give a number range, not a vague bracket)
2. My estimated monthly payment at that price (P&I + taxes + insurance + PMI if applicable)
3. How much of my savings will be consumed by the down payment and closing costs — and how much I'll have left
4. My DTI situation — am I in good shape, squeezed, or a problem?
5. An honest overall assessment — where do I stand? What are the weak spots in my application?
6. The one or two things that matter most for me to work on right now

Be specific. Use real numbers. If my situation is strong, say so clearly. If there are problems, say exactly what they are.`;

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
