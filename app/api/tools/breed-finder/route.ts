import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a knowledgeable friend who has worked in dog and cat rescue, breeding consultation, and pet behavior for 15 years. You give honest, specific breed recommendations based on lifestyle — not just what's popular or cute. You flag breeds that would be a poor fit just as clearly as you recommend good ones. You understand the real-world demands of different breeds (exercise, training difficulty, separation anxiety, grooming, health issues, costs). Write in clear sections with specific breed names and honest tradeoffs.`;

export async function POST(req: Request) {
  const { species, housing, activity, experience, hoursAlone, household, allergies, preferences, dealbreakers } = await req.json();

  const userPrompt = `Here's my lifestyle and situation:
- Looking for: a ${species}
- Living situation: ${housing}
- Activity level: ${activity}
- Pet experience: ${experience}
- Hours the pet would be alone daily: ${hoursAlone}
- Household: ${household}
- Allergies / grooming preferences: ${allergies || "none specified"}
- What I'm looking for: ${preferences || "not specified"}
- Dealbreakers: ${dealbreakers || "none listed"}

Give me a breed compatibility recommendation structured like this:

**Top 3 matches:** For each breed, give me:
- The breed name
- Why it fits my specific situation (be specific — reference my hours alone, activity level, housing, etc.)
- One honest caveat or watch-out for this breed

**Honorable mentions:** 2–3 additional breeds worth considering, with a one-liner on why.

**Breeds to avoid for your situation:** 2–3 breeds that would be a poor fit given what I've described, and exactly why. Be direct — if a Husky would be wrong for my apartment and low activity level, say so.

**What to prioritize when looking:** Given my situation, what specific traits should I look for when meeting individual animals at a shelter or breeder? (Temperament markers, energy tests, etc.)

Be specific and honest. Name real breeds, not vague categories. If my situation has limitations (like long hours alone), acknowledge them and factor them into your recommendations rather than ignoring them.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1600,
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
