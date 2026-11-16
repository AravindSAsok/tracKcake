import type { APIRoute } from "astro";
import { researchNutrition, type NutritionItem } from "../../lib/nutrition-research";

export const prerender = false;
export const maxDuration = 60;

type EstimatedItem = NutritionItem;

type Provider = "groq" | "gemini" | "openrouter";
type ProviderResult = { items: EstimatedItem[]; model: string; provider: Provider };

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 10) / 10);
}

function parseItems(value: unknown): EstimatedItem[] {
  if (!Array.isArray(value)) throw new Error("The AI provider did not return a food list.");
  const items = value.slice(0, 10).map((entry): EstimatedItem => {
    if (!entry || typeof entry !== "object") throw new Error("The AI provider returned an invalid food item.");
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 90) : "";
    const amount = typeof item.amount === "string" ? item.amount.trim().slice(0, 90) : "";
    const calories = Math.round(asNumber(item.calories));
    if (!name || !amount || calories <= 0 || calories > 10000) {
      throw new Error("The AI provider returned an incomplete nutrition estimate.");
    }
    return {
      name, amount, calories,
      protein_g: asNumber(item.protein_g),
      carbs_g: asNumber(item.carbs_g),
      fat_g: asNumber(item.fat_g),
      brand: typeof item.brand === "string" ? item.brand.trim().slice(0, 80) : undefined,
      product_name: typeof item.product_name === "string" ? item.product_name.trim().slice(0, 100) : undefined
    };
  });
  if (!items.length) throw new Error("No foods were found in that description.");
  return items;
}

function extractJson(text: string): unknown {
  let cleaned = text.replace(/^\u0060\u0060\u0060(?:json)?\s*/i, "").replace(/\s*\u0060\u0060\u0060$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstObject = cleaned.indexOf("{");
    const firstArray = cleaned.indexOf("[");
    const start = firstObject < 0 ? firstArray : firstArray < 0 ? firstObject : Math.min(firstObject, firstArray);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start < 0 || end <= start) throw new Error("The AI provider returned non-JSON output.");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") throw new Error("The AI provider returned an unexpected JSON shape.");
  const result = parsed as Record<string, unknown>;
  for (const key of ["items", "foods", "food_items", "results"]) {
    if (Array.isArray(result[key])) return result[key];
  }
  if (typeof result.output === "string") return extractJson(result.output);
  if (typeof result.name === "string" && typeof result.amount === "string") return [result];
  throw new Error("The AI provider returned JSON without a food items array.");
}

const promptFor = (description: string) => [
  "You are a careful nutrition estimation assistant.",
  "Identify the foods, brands, preparation state and portions described by the user.",
  "Preserve every explicit user quantity and unit exactly; never replace a stated amount with a guessed serving.",
  "Split a meal into separate food items when useful. Use realistic edible portion estimates only when the user gives no amount.",
  "Provide a conservative fallback nutrition estimate, but verified nutrition lookup will replace it when a reliable match is found.",
  'Return only JSON: {"items":[{"name":"food name","amount":"portion and unit","brand":"brand or empty","product_name":"exact product or empty","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}]}',
  "Calories are kcal. Macros are grams. Use non-negative numbers. No advice, markdown, or extra keys.",
  "Food description:", description
].join("\n");

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: { message?: string } | string; message?: string };
    return typeof body.error === "string" ? body.error : body.error?.message || body.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function callOpenAICompatible(
  provider: "groq" | "openrouter",
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const endpoint = provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter" ? {
        "HTTP-Referer": "https://trackcake.vercel.app",
        "X-Title": "TrackCake"
      } : {})
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return only valid JSON matching the requested nutrition schema. Never include markdown." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1200,
      ...(provider === "groq" ? { response_format: { type: "json_object" } } : {})
    }),
    signal: AbortSignal.timeout(9_000)
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from provider.");
  return content;
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1400, responseMimeType: "application/json" }
      }),
      signal: AbortSignal.timeout(30_000)
    }
  );
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!content) throw new Error("Empty response from Gemini.");
  return content;
}

async function estimateWithFallback(description: string, requestedProvider: Provider | "auto" = "auto", requestedModel?: string): Promise<ProviderResult> {
  const prompt = promptFor(description);
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const attempts: Array<{ provider: Provider; model: string; run: () => Promise<string> }> = [];

  if (groqKey) {
    const model = requestedModel || process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
    attempts.push({ provider: "groq", model, run: () => callOpenAICompatible("groq", groqKey, model, prompt) });
  }
  if (geminiKey) {
    const model = requestedModel || process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
    attempts.push({ provider: "gemini", model, run: () => callGemini(geminiKey, model, prompt) });
    if (!requestedModel && model !== "gemini-3.6-flash") {
      attempts.push({ provider: "gemini", model: "gemini-3.6-flash", run: () => callGemini(geminiKey, "gemini-3.6-flash", prompt) });
    }
  }
  if (openRouterKey) {
    const model = requestedModel || process.env.OPENROUTER_MODEL?.trim() || "baidu/ernie-5.5-flash-preview:free";
    attempts.push({ provider: "openrouter", model, run: () => callOpenAICompatible("openrouter", openRouterKey, model, prompt) });
    const fallbackModel = "inclusionai/ling-3.2-flash:free";
    if (!requestedModel && model !== fallbackModel) {
      attempts.push({ provider: "openrouter", model: fallbackModel, run: () => callOpenAICompatible("openrouter", openRouterKey, fallbackModel, prompt) });
    }
  }

  const selectedAttempts = requestedProvider === "auto" ? attempts : attempts.filter((attempt) => attempt.provider === requestedProvider);
  if (!selectedAttempts.length) throw new Error(requestedProvider === "auto" ? "No AI provider keys are configured. Add GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in Vercel." : `The ${requestedProvider} provider is not configured in Vercel.`);

  const failures: string[] = [];
  for (const attempt of selectedAttempts) {
    const started = Date.now();
    try {
      const raw = await attempt.run();
      const items = parseItems(extractJson(raw));
      console.info("[trackcake-ai] provider succeeded", {
        provider: attempt.provider, model: attempt.model, durationMs: Date.now() - started
      });
      return { items, model: attempt.model, provider: attempt.provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${attempt.provider}/${attempt.model}: ${message.slice(0, 180)}`);
      console.warn("[trackcake-ai] provider failed", {
        provider: attempt.provider, model: attempt.model, durationMs: Date.now() - started,
        error: message.slice(0, 180)
      });
    }
  }
  throw new Error(failures.join(" | ").slice(0, 900));
}

export const POST: APIRoute = async ({ request }) => {
  let description: string;
  let providerChoice: Provider | "auto" = "auto";
  let modelChoice: string | undefined;
  try {
    const body = await request.json() as { description?: unknown; provider?: unknown; model?: unknown };
    description = typeof body.description === "string" ? body.description.trim() : "";
    const requested = body.provider ?? "auto";
    if (body.model !== undefined && body.model !== null && body.model !== "") {
      if (typeof body.model !== "string" || body.model.length > 200 || !/^[a-zA-Z0-9._:/-]+$/.test(body.model)) {
        return json({ error: "Choose a valid model from the model list." }, 400);
      }
      modelChoice = body.model;
    }
    if (modelChoice && requested === "auto") {
      return json({ error: "Choose a specific AI provider before selecting a model." }, 400);
    }
    if (!["auto", "groq", "gemini", "openrouter"].includes(String(requested))) {
      return json({ error: "Choose auto, groq, gemini or openrouter." }, 400);
    }
    providerChoice = requested as Provider | "auto";
  } catch {
    return json({ error: "Please enter a food description." }, 400);
  }
  if (!description) return json({ error: "Please enter what you ate." }, 400);
  if (description.length > 700) return json({ error: "Please keep the food description under 700 characters." }, 400);

  try {
    const result = await estimateWithFallback(description, providerChoice, modelChoice);
    const items = await researchNutrition(result.items, description);
    return json({
      items,
      total_calories: items.reduce((sum, item) => sum + item.calories, 0),
      provider: result.provider,
      model: result.model,
      confidence: "estimate"
    });
  } catch (error) {
    console.error("[trackcake-ai] all configured providers failed", error);
    return json({
      error: "All configured AI providers failed this request. Check provider keys, model access and quotas, then try again.",
      detail: error instanceof Error ? error.message.slice(0, 900) : "Unknown provider error"
    }, 502);
  }
};

