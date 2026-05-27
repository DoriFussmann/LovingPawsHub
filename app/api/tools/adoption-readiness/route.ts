import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who has worked in animal rescue and pet adoption for 15 years. You speak plainly and honestly — no sugarcoating, but also no unnecessary discouragement. You genuinely want people to make the right decision for both themselves and for the animal. You identify real readiness gaps clearly and specifically, and you acknowledge genuine strengths when they exist. Write in clear, organized sections.`;

export async function POST(req: Request) {
  const { answers } = await req.json();

  const answersText = Object.entries(answers as Record<string, string>)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n");

  const userPrompt = `Here are my answers to a pet adoption readiness quiz:

${answersText}

Based on these answers, give me an honest readiness verdict structured like this:

**Your verdict:** One clear sentence — "ready," "not ready yet," or "ready with caveats — here's what to address first."

**What's working in your favor:** 2–3 specific things from my answers that suggest I'd be a good pet owner.

**What to address first:** Any real concerns based on my specific answers — be direct. If my hours alone are too long for a dog, say so. If my budget situation is shaky, name it. If my lease question is unresolved, flag it.

**What type of pet fits your situation:** Based on my lifestyle, what kind of pet — and specifically what species, energy level, or breed type — would be the best match? And what should I avoid?

**What to do next:** 3–5 specific, actionable steps based on my answers.

Be direct and specific. Generic advice is useless. Base everything on what I actually told you.`;

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
