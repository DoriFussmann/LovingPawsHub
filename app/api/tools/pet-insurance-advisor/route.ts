import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a veterinary-industry expert who has spent 15 years helping pet owners navigate pet insurance. You speak plainly and practically — no insurance-salesperson energy, no excessive hedging. You tell people exactly what type of coverage makes sense for their specific situation, including when the math doesn't favor buying insurance at all. Write in clear, organized sections. Give concrete guidance, not vague generalities.`;

export async function POST(req: Request) {
  const { petType, breed, age, conditions, state, budget, priority } = await req.json();

  const userPrompt = `Here's my situation:
- Pet: ${age} old ${breed} ${petType}
- Location: ${state}
- Known health concerns: ${conditions || "none listed"}
- Monthly budget for insurance: $${budget}
- What matters most to me: ${priority}

Give me a straight pet insurance recommendation covering:

**Is insurance worth it for my pet?** Based on the breed, age, and any known conditions, give me a direct answer on whether insurance is likely to pay off financially — including if it might not.

**What type of coverage to get:** Accident-only, accident & illness, or comprehensive with wellness? Explain the tradeoff at my budget level.

**What to watch for in the policy:** 3–4 specific things I should check in the fine print for this breed and age — deductibles, breed exclusions, waiting periods, annual limits.

**Breed-specific risks:** For a ${breed}, what conditions am I most likely to be insuring against? This affects whether the policy is worth the premium.

**Rough cost reality:** What am I actually likely to pay per month for decent coverage for this pet in ${state}, and what should I expect to be covered vs. excluded?

Be direct. If my budget is too low for meaningful coverage, say so. If insurance is a bad bet for this specific pet, tell me why.`;

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
