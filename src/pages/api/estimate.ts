import type { APIRoute } from "astro";
import { researchNutrition, type NutritionItem } from "../../lib/nutrition-research";

export const prerender = false;
export const maxDuration = 300;

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

type ModelAttempt = { provider: Provider; model: string; run: () => Promise<string> };

async function fetchModelIds(provider: Provider, apiKey: string): Promise<string[]> {
  const endpoint = provider === "groq"
    ? "https://api.groq.com/openai/v1/models"
    : provider === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/models"
      : "https://openrouter.ai/api/v1/models/user?output_modalities=text&endpoints=%2Fapi%2Fv1%2Fchat%2Fcompletions";
  const headers: Record<string, string> = provider === "gemini"
    ? { "x-goog-api-key": apiKey }
    : {
        "Authorization": `Bearer ${apiKey}`,
        ...(provider === "openrouter" ? {
          "HTTP-Referer": "https://trackcake.vercel.app",
          "X-Title": "TrackCake"
        } : {})
      };
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`${provider} model catalogue returned HTTP ${response.status}`);
  const payload = await response.json() as {
    data?: Array<{ id?: string; name?: string; supportedGenerationMethods?: string[] }>;
    models?: Array<{ name?: string; id?: string; supportedGenerationMethods?: string[] }>;
  };
  const records = payload.data ?? payload.models ?? [];
  return records.map((item) => (item.id ?? item.name ?? "").replace(/^models\//, ""))
    .filter((id) => {
      if (!id) return false;
      const lower = id.toLowerCase();
      if (provider === "groq") return !/(whisper|orpheus|prompt-guard|safeguard|embedding|tts|transcrib|speech)/.test(lower);
      if (provider === "gemini") {
        const record = records.find((item) => (item.id ?? item.name ?? "").replace(/^models\//, "") === id);
        return (!record || !("supportedGenerationMethods" in record) ||
          !record.supportedGenerationMethods ||
          record.supportedGenerationMethods.includes("generateContent")) &&
          !/(tts|image|banana|lyria|transcrib|robotics|deep-research|antigravity|computer-use)/.test(lower);
      }
      return !(/:batch$|image|banana|audio|speech|transcrib|tts|lyria|video|embedding/.test(lower));
    });
}

async function buildAttempts(
  description: string,
  requestedProvider: Provider | "auto",
  requestedModel?: string,
  strictModel = false
): Promise<ModelAttempt[]> {
  const prompt = promptFor(description);
  const keys: Partial<Record<Provider, string>> = {
    groq: process.env.GROQ_API_KEY?.trim(),
    gemini: process.env.GEMINI_API_KEY?.trim(),
    openrouter: process.env.OPENROUTER_API_KEY?.trim()
  };
  const defaults: Record<Provider, string> = {
    gemini: "gemini-flash-lite-latest",
    groq: process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b",
    openrouter: process.env.OPENROUTER_MODEL?.trim() || "baidu/ernie-5.5-flash-preview:free"
  };
  const attempts: ModelAttempt[] = [];
  const seen = new Set<string>();
  const add = (provider: Provider, model: string) => {
    if (!keys[provider] || !model) return;
    const key = provider + "/" + model;
    if (seen.has(key)) return;
    seen.add(key);
    const apiKey = keys[provider]!;
    attempts.push({
      provider, model,
      run: () => provider === "gemini"
        ? callGemini(apiKey, model, prompt)
        : callOpenAICompatible(provider, apiKey, model, prompt)
    });
  };

  // A user's saved model is always tried first, but a failure no longer locks
  // the request to that one provider.
  if (requestedModel && requestedProvider !== "auto") add(requestedProvider, requestedModel);
  if (strictModel && requestedModel && requestedProvider !== "auto") return attempts;
  if (requestedProvider === "gemini" || requestedProvider === "auto") add("gemini", defaults.gemini);
  if (requestedProvider === "groq") add("groq", defaults.groq);
  if (requestedProvider === "openrouter") add("openrouter", defaults.openrouter);
  for (const provider of ["gemini", "groq", "openrouter"] as Provider[]) add(provider, defaults[provider]);

  const catalogues = await Promise.all((["gemini", "groq", "openrouter"] as Provider[]).map(async (provider) => {
    const key = keys[provider];
    if (!key) return { provider, ids: [] as string[] };
    try {
      return { provider, ids: await fetchModelIds(provider, key) };
    } catch (error) {
      console.warn("[trackcake-ai] model catalogue unavailable", {
        provider, error: error instanceof Error ? error.message : "Unknown error"
      });
      return { provider, ids: [] as string[] };
    }
  }));
  // Keep the catalogue order supplied by each provider. Each provider/model
  // pair is attempted at most once, sequentially, until one returns valid data.
  for (const catalogue of catalogues) {
    for (const model of catalogue.ids) add(catalogue.provider, model);
  }
  return attempts;
}

 
export const POST: APIRoute = async ({ request }) => {
  let description: string;
  let providerChoice: Provider | "auto" = "auto";
  let modelChoice: string | undefined;
  let strictModel = false;
  try {
    const body = await request.json() as { description?: unknown; provider?: unknown; model?: unknown; strictModel?: unknown };
    description = typeof body.description === "string" ? body.description.trim() : "";
    const requested = body.provider ?? "auto";
    if (body.model !== undefined && body.model !== null && body.model !== "") {
      if (typeof body.model !== "string" || body.model.length > 200) {
        return json({ error: "Choose a valid model from the model list." }, 400);
      }
      const validModel = requested === "openrouter"
        ? /^~?[a-zA-Z0-9._:/-]+$/.test(body.model)
        : /^[a-zA-Z0-9._:/-]+$/.test(body.model);
      if (!validModel) return json({ error: "Choose a valid model from the model list." }, 400);
      modelChoice = body.model;
    }
    if (modelChoice && requested === "auto") {
      return json({ error: "Choose a specific AI provider before selecting a model." }, 400);
    }
    if (!["auto", "groq", "gemini", "openrouter"].includes(String(requested))) {
      return json({ error: "Choose auto, groq, gemini or openrouter." }, 400);
    }
    providerChoice = requested as Provider | "auto";
    strictModel = body.strictModel === true && providerChoice === "openrouter" && Boolean(modelChoice);
  } catch {
    return json({ error: "Please enter a food description." }, 400);
  }
  if (!description) return json({ error: "Please enter what you ate." }, 400);
  if (description.length > 700) return json({ error: "Please keep the food description under 700 characters." }, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      void (async () => {
        try {
          const configured = (["groq", "gemini", "openrouter"] as Provider[])
            .filter((provider) => Boolean(
              provider === "groq" ? process.env.GROQ_API_KEY?.trim()
                : provider === "gemini" ? process.env.GEMINI_API_KEY?.trim()
                  : process.env.OPENROUTER_API_KEY?.trim()
            ));
          if (!configured.length) throw new Error("No AI provider keys are configured in Vercel.");
          const attempts = await buildAttempts(description, providerChoice, modelChoice, strictModel);
          if (!attempts.length) throw new Error("No models are available for the configured API keys.");

          const failures: string[] = [];
          for (const attempt of attempts) {
            send("progress", {
              provider: attempt.provider,
              model: attempt.model,
              message: "Trying model - " + attempt.model
            });
            const started = Date.now();
            try {
              const raw = await attempt.run();
              const items = parseItems(extractJson(raw));
              console.info("[trackcake-ai] provider succeeded", {
                provider: attempt.provider, model: attempt.model, durationMs: Date.now() - started
              });
              send("progress", {
                provider: attempt.provider, model: attempt.model,
                message: "Nutrition research - verifying portions and calories…"
              });
              const researched = await researchNutrition(items, description);
              send("complete", {
                items: researched,
                total_calories: researched.reduce((sum, item) => sum + item.calories, 0),
                provider: attempt.provider,
                model: attempt.model,
                confidence: "estimate"
              });
              controller.close();
              return;
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown provider error";
              failures.push(`${attempt.provider}/${attempt.model}: ${message.slice(0, 180)}`);
              console.warn("[trackcake-ai] provider failed", {
                provider: attempt.provider, model: attempt.model,
                durationMs: Date.now() - started, error: message.slice(0, 180)
              });
            }
          }
          throw new Error(failures.slice(-12).join(" | ").slice(0, 900) || "All available models failed.");
        } catch (error) {
          send("error", {
            error: "All available AI models failed this request. Check provider keys, model access and quotas, then try again.",
            detail: error instanceof Error ? error.message.slice(0, 900) : "Unknown provider error"
          });
          controller.close();
        }
      })();
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
};
