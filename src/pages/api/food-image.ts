import type { APIRoute } from "astro";

export const prerender = false;
export const maxDuration = 60;

type Provider = "groq" | "gemini" | "openrouter";
type FoodItem = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
type Result = { items: FoodItem[]; provider: Provider; model: string };

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("The AI returned an invalid nutrition response.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function parseItems(raw: string): FoodItem[] {
  const parsed = extractJson(raw);
  const values = Array.isArray(parsed) ? parsed :
    parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).items)
      ? (parsed as { items: unknown[] }).items : [];
  if (!values.length) throw new Error("No foods could be identified. Try a clearer photo.");
  return values.slice(0, 10).map((value) => {
    if (!value || typeof value !== "object") throw new Error("The AI returned an invalid food item.");
    const row = value as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 90) : "";
    const amount = typeof row.amount === "string" ? row.amount.trim().slice(0, 90) : "";
    const number = (input: unknown) => {
      const parsedNumber = Number(input);
      return Number.isFinite(parsedNumber) ? Math.max(0, Math.round(parsedNumber * 10) / 10) : 0;
    };
    const calories = Math.round(number(row.calories));
    if (!name || !amount || calories <= 0 || calories > 10000) {
      throw new Error("The AI returned an incomplete estimate. Please review another photo.");
    }
    return {
      name, amount, calories,
      protein_g: number(row.protein_g),
      carbs_g: number(row.carbs_g),
      fat_g: number(row.fat_g)
    };
  });
}

const visionPrompt = [
  "You are a careful food and nutrition estimation assistant.",
  "Inspect the provided meal photo. Identify each visible food item separately when possible.",
  "Estimate realistic edible portion sizes from visual cues. Do not claim exact weights or ingredients that cannot be seen.",
  "For mixed dishes, identify the dish by its visible appearance and use a cautious typical nutrition estimate.",
  "If the image is not food or the food cannot be identified, return an empty items array.",
  "Return only JSON in this exact shape: {\"items\":[{\"name\":\"food name\",\"amount\":\"estimated portion\",\"calories\":number,\"protein_g\":number,\"carbs_g\":number,\"fat_g\":number}]}",
  "Calories are kcal; macros are grams. Use non-negative numeric values. No markdown or extra commentary."
].join("\n");

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: { message?: string } | string; message?: string };
    return typeof body.error === "string" ? body.error : body.error?.message || body.message || `HTTP ${response.status}`;
  } catch { return `HTTP ${response.status}`; }
}

async function callGemini(key: string, model: string, imageData: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: visionPrompt },
        { inline_data: { mime_type: "image/jpeg", data: imageData } }
      ] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1400, responseMimeType: "application/json" }
    }),
    signal: AbortSignal.timeout(18_000)
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!output) throw new Error("Gemini returned an empty image analysis.");
  return output;
}

async function callCompatibleVision(
  provider: "groq" | "openrouter",
  key: string,
  model: string,
  dataUrl: string
): Promise<string> {
  const endpoint = provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter" ? {
        "HTTP-Referer": "https://trackcake.vercel.app",
        "X-Title": "TrackCake Food Photo"
      } : {})
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: [
        { type: "text", text: visionPrompt },
        { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
      ] }],
      temperature: 0.2,
      max_tokens: 1400
    }),
    signal: AbortSignal.timeout(18_000)
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
  const content = payload.choices?.[0]?.message?.content;
  const output = typeof content === "string"
    ? content
    : Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : "";
  if (!output.trim()) throw new Error("The provider returned an empty image analysis.");
  return output;
}

async function analyseImage(imageData: string, providerChoice: Provider | "auto", modelChoice?: string): Promise<Result> {
  const keys = {
    gemini: process.env.GEMINI_API_KEY?.trim(),
    groq: process.env.GROQ_API_KEY?.trim(),
    openrouter: process.env.OPENROUTER_API_KEY?.trim()
  };
  const dataUrl = "data:image/jpeg;base64," + imageData;
  const attempts: Array<{ provider: Provider; model: string; run: () => Promise<string> }> = [];

  if (keys.gemini) {
    const models = modelChoice ? [modelChoice] : [...new Set([
      process.env.GEMINI_VISION_MODEL?.trim(),
      process.env.GEMINI_MODEL?.trim(),
      "gemini-2.5-flash",
      "gemini-2.0-flash"
    ].filter((value): value is string => Boolean(value)))];
    for (const model of models) attempts.push({ provider: "gemini", model, run: () => callGemini(keys.gemini!, model, imageData) });
  }
  if (keys.groq) {
    const model = modelChoice || process.env.GROQ_VISION_MODEL?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
    attempts.push({ provider: "groq", model, run: () => callCompatibleVision("groq", keys.groq!, model, dataUrl) });
  }
  if (keys.openrouter) {
    const model = modelChoice || process.env.OPENROUTER_VISION_MODEL?.trim() || "google/gemini-2.5-flash";
    attempts.push({ provider: "openrouter", model, run: () => callCompatibleVision("openrouter", keys.openrouter!, model, dataUrl) });
  }

  const selected = providerChoice === "auto" ? attempts : attempts.filter((item) => item.provider === providerChoice);
  if (!selected.length) throw new Error(providerChoice === "auto"
    ? "No AI provider keys are configured. Add your Groq, Gemini or OpenRouter key in Vercel."
    : `The ${providerChoice} provider is not configured in Vercel.`);

  const failures: string[] = [];
  for (const attempt of selected) {
    try {
      const items = parseItems(await attempt.run());
      console.info("[trackcake-photo] vision provider succeeded", { provider: attempt.provider, model: attempt.model });
      return { items, provider: attempt.provider, model: attempt.model };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${attempt.provider}/${attempt.model}: ${reason.slice(0, 160)}`);
      console.warn("[trackcake-photo] vision provider failed", {
        provider: attempt.provider, model: attempt.model, error: reason.slice(0, 180)
      });
    }
  }
  throw new Error(failures.join(" | ").slice(0, 800));
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ error: "Choose a food photo and try again." }, 400); }

  const image = form.get("image");
  const providerRaw = form.get("provider");
  const modelRaw = form.get("model");
  const provider = typeof providerRaw === "string" ? providerRaw : "auto";
  const model = typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : undefined;
  if (!(["auto", "groq", "gemini", "openrouter"] as string[]).includes(provider)) {
    return json({ error: "Choose a valid AI provider." }, 400);
  }
  if (model && (model.length > 200 || !/^[a-zA-Z0-9._:/-]+$/.test(model))) {
    return json({ error: "Choose a valid vision model." }, 400);
  }
  if (model && provider === "auto") return json({ error: "Choose a provider before selecting a model." }, 400);
  if (!(image instanceof File)) return json({ error: "Choose a food photo first." }, 400);
  if (!image.type.startsWith("image/")) return json({ error: "That file is not an image." }, 400);
  if (image.size > 8 * 1024 * 1024) return json({ error: "Please choose an image smaller than 8 MB." }, 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return json({ error: "Please use a JPG, PNG or WebP image." }, 415);
  }

  try {
    const bytes = Buffer.from(await image.arrayBuffer());
    const imageData = bytes.toString("base64");
    const result = await analyseImage(imageData, provider as Provider | "auto", model);
    return json({
      items: result.items,
      total_calories: result.items.reduce((sum, item) => sum + item.calories, 0),
      provider: result.provider,
      model: result.model,
      confidence: "visual_estimate"
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown image analysis error";
    console.error("[trackcake-photo] analysis failed", detail);
    return json({
      error: "Could not analyse this photo with the selected provider. Try another provider or a clearer food photo.",
      detail: detail.slice(0, 800)
    }, 502);
  }
};
