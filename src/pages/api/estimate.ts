import type { APIRoute } from "astro";

export const prerender = false;

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
};

type EstimatedItem = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 10) / 10);
}

function parseItems(value: unknown): EstimatedItem[] {
  if (!Array.isArray(value)) throw new Error("Gemini did not return a food list.");

  const items = value.slice(0, 10).map((entry): EstimatedItem => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Gemini returned an invalid food item.");
    }

    const item = entry as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 90) : "";
    const amount = typeof item.amount === "string" ? item.amount.trim().slice(0, 90) : "";
    const calories = Math.round(asNumber(item.calories));

    if (!name || !amount || calories <= 0 || calories > 10000) {
      throw new Error("Gemini returned an incomplete nutrition estimate.");
    }

    return {
      name,
      amount,
      calories,
      protein_g: asNumber(item.protein_g),
      carbs_g: asNumber(item.carbs_g),
      fat_g: asNumber(item.fat_g)
    };
  });

  if (items.length === 0) throw new Error("No foods were found in that description.");
  return items;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return json({
      error: "Gemini is not connected yet. Add GEMINI_API_KEY to your server environment to enable food estimates. You can still log food manually."
    }, 503);
  }

  let description: string;
  try {
    const body = await request.json() as { description?: unknown };
    description = typeof body.description === "string" ? body.description.trim() : "";
  } catch {
    return json({ error: "Please enter a food description." }, 400);
  }

  if (!description) return json({ error: "Please enter what you ate." }, 400);
  if (description.length > 700) {
    return json({ error: "Please keep the food description under 700 characters." }, 400);
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const prompt = [
    "You are a careful nutrition estimation assistant.",
    "Estimate the nutrition for the foods and portion sizes described by the user.",
    "Split a meal into separate food items when that makes the result more useful.",
    "Use realistic edible portion estimates. If an amount is vague, choose a sensible common serving and say so in the amount field.",
    "Return only valid JSON with this exact shape:",
    '{"items":[{"name":"food name","amount":"portion and unit","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}]}',
    "Calories are kcal. Macros are grams. Use non-negative numbers. Do not include advice, markdown, or extra keys.",
    "Food description:",
    description
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        }),
        signal: AbortSignal.timeout(25_000)
      }
    );

    if (!response.ok) {
      return json({
        error: response.status === 429
          ? "Gemini is receiving too many requests. Please try again shortly."
          : `Gemini could not complete the estimate (HTTP ${response.status}). Check the API key and model setting.`
      }, 502);
    }

    const payload = await response.json() as GeminiResponse;
    const generatedText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!generatedText) throw new Error("Gemini returned an empty response.");

    const cleaned = generatedText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { items?: unknown };
    const items = parseItems(parsed.items);

    return json({
      items,
      total_calories: items.reduce((sum, item) => sum + item.calories, 0),
      confidence: "estimate"
    });
  } catch (error) {
    console.error("Nutrition estimate failed:", error);
    return json({
      error: error instanceof Error && error.name === "TimeoutError"
        ? "The nutrition estimate took too long. Please try again."
        : "The nutrition estimate could not be read. Try describing the food and portion more clearly."
    }, 502);
  }
};
