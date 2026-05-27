import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who is also a licensed veterinary technician with 12 years of clinical experience. You speak plainly and directly. You do not provide diagnosis — you help pet owners understand urgency and what to do next. You are honest about when something needs immediate vet attention and equally honest when something is very likely benign. You never catastrophize minor issues, and you never minimize genuinely serious ones. Always remind the user that this is informational guidance, not veterinary diagnosis. Organize your response in clear, labeled sections.`;

export async function POST(req: Request) {
  const { petType, breed, age, symptoms, duration, recentChanges } = await req.json();

  const userPrompt = `My pet's details:
- Type: ${petType}
- Breed: ${breed || "unknown/mixed"}
- Age: ${age}
- Duration of symptoms: ${duration || "not specified"}
- Symptoms I'm noticing: ${symptoms}
- Recent changes: ${recentChanges || "none"}

Please give me an honest assessment structured like this:

**Urgency level:** Choose one — Emergency (go now), Urgent (same day or next day), Monitor closely (watch for 24–48h), or Routine (schedule a checkup when convenient). State it clearly at the top.

**What might be going on:** Give me 2–4 possible explanations for what I'm describing, from most to least likely. Be specific — not just "it could be many things."

**Red flags to watch for:** Tell me the specific signs that would escalate this to an emergency if I'm in the monitor/routine category.

**What to do right now:** Concrete next steps based on the urgency level — what to do in the next few hours.

**Home care (if applicable):** If this is a monitor situation, what can I safely do at home while watching?

Be direct. If the symptoms I've described are genuinely concerning, tell me clearly. If they're almost certainly minor, tell me that too. Finish with a brief reminder that this is informational guidance and not a substitute for veterinary examination.`;

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
