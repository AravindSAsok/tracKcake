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
    signal: AbortSignal.timeout(11_000)
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
    signal: AbortSignal.timeout(11_000)
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

async function analyseImage(imageData: string, providerChoice: Provider | "auto", modelChoice?: string, onProgress: (event: Record<string, unknown>) => void = () => {}): Promise<Result> {
  const keys = {
    gemini: process.env.GEMINI_API_KEY?.trim(),
    groq: process.env.GROQ_API_KEY?.trim(),
    openrouter: process.env.OPENROUTER_API_KEY?.trim()
  };
  const dataUrl = "data:image/jpeg;base64," + imageData;
  const attempts: Array<{ provider: Provider; model: string; run: () => Promise<string> }> = [];

  if (keys.gemini) {
    const models = [...new Set([
      providerChoice === "gemini" ? modelChoice : undefined,
      process.env.GEMINI_VISION_MODEL?.trim(),
      process.env.GEMINI_MODEL?.trim(),
      "gemini-2.5-flash",
      "gemini-2.0-flash"
    ].filter((value): value is string => Boolean(value)))];
    for (const model of models) attempts.push({ provider: "gemini", model, run: () => callGemini(keys.gemini!, model, imageData) });
  }
  // Groq is attempted only when an explicitly configured vision model is available.
  if (keys.groq && process.env.GROQ_VISION_MODEL?.trim()) {
    const model = providerChoice === "groq" && modelChoice ? modelChoice : process.env.GROQ_VISION_MODEL.trim();
    attempts.push({ provider: "groq", model, run: () => callCompatibleVision("groq", keys.groq!, model, dataUrl) });
  }
  if (keys.openrouter) {
    const models = [...new Set([
      providerChoice === "openrouter" ? modelChoice : undefined,
      process.env.OPENROUTER_VISION_MODEL?.trim(),
      "google/gemini-2.5-flash",
      "qwen/qwen3-vl-8b-instruct"
    ].filter((value): value is string => Boolean(value)))];
    for (const model of models) {
      attempts.push({ provider: "openrouter", model, run: () => callCompatibleVision("openrouter", keys.openrouter!, model, dataUrl) });
    }
  }

  // Honour the user's selected provider first, then automatically fall through
  // to every other configured vision provider/model until one succeeds.
  const ordered = providerChoice === "auto" ? attempts : [
    ...attempts.filter((item) => item.provider === providerChoice),
    ...attempts.filter((item) => item.provider !== providerChoice)
  ];
  const selected = ordered.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.provider === item.provider && candidate.model === item.model) === index
  );
  if (!selected.length) {
    throw new Error("No image-capable provider is configured. Add a Gemini or OpenRouter vision model, or configure GROQ_VISION_MODEL for Groq.");
  }

  const failures: string[] = [];
  for (let index = 0; index < selected.length; index++) {
    const attempt = selected[index];
    onProgress({
      stage: "trying",
      provider: attempt.provider,
      model: attempt.model,
      attempt: index + 1,
      total: selected.length,
      message: `Trying ${attempt.provider} · ${attempt.model}`
    });
    try {
      const items = parseItems(await attempt.run());
      console.info("[trackcake-photo] vision provider succeeded", { provider: attempt.provider, model: attempt.model });
      onProgress({ stage: "success", provider: attempt.provider, model: attempt.model, message: "Food analysis complete." });
      return { items, provider: attempt.provider, model: attempt.model };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${attempt.provider}/${attempt.model}: ${reason.slice(0, 160)}`);
      console.warn("[trackcake-photo] vision provider failed", {
        provider: attempt.provider, model: attempt.model, error: reason.slice(0, 180)
      });
      onProgress({
        stage: "fallback",
        provider: attempt.provider,
        model: attempt.model,
        message: `${attempt.provider} could not analyse it. Moving to the next provider…`
      });
    }
  }
  throw new Error(failures.join(" | ").slice(0, 800));
}

export const POST: APIRoute = async ({ request }) => {
  // JSON requests are intentionally used here: Astro's CSRF origin guard rejects
  // cross-site form-encoded POSTs. Keep the guard enabled and avoid multipart uploads.
  let payload: { image?: unknown; provider?: unknown; model?: unknown };
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ error: "Please refresh TrackCake and select the photo again." }, 415);
    }
    payload = await request.json() as { image?: unknown; provider?: unknown; model?: unknown };
  } catch {
    return json({ error: "Choose a food photo and try again." }, 400);
  }

  const image = payload.image;
  const providerRaw = payload.provider;
  const modelRaw = payload.model;
  const provider = typeof providerRaw === "string" ? providerRaw : "auto";
  const model = typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : undefined;
  if (!(["auto", "groq", "gemini", "openrouter"] as string[]).includes(provider)) {
    return json({ error: "Choose a valid AI provider." }, 400);
  }
  if (model && (model.length > 200 || !/^[a-zA-Z0-9._:/-]+$/.test(model))) {
    return json({ error: "Choose a valid vision model." }, 400);
  }
  if (model && provider === "auto") return json({ error: "Choose a provider before selecting a model." }, 400);
  if (typeof image !== "string" || !image) return json({ error: "Choose a food photo first." }, 400);
  if (image.length > 3_800_000) return json({ error: "Please choose a smaller photo (under 2.7 MB after compression)." }, 413);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length % 4 !== 0) {
    return json({ error: "The selected photo could not be read. Please choose it again." }, 400);
  }

  const bytes = Buffer.from(image, "base64");
  if (bytes.length > 2_800_000) return json({ error: "Please choose a smaller photo." }, 413);
  const imageData = bytes.toString("base64");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      void (async () => {
        try {
          send({ type: "progress", stage: "prepared", message: "Photo ready. Checking available AI providers…" });
          const result = await analyseImage(imageData, provider as Provider | "auto", model, (event) => send({ type: "progress", ...event }));
          send({
            type: "result",
            items: result.items,
            total_calories: result.items.reduce((sum, item) => sum + item.calories, 0),
            provider: result.provider,
            model: result.model,
            confidence: "visual_estimate"
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Unknown image analysis error";
          console.error("[trackcake-photo] analysis failed", detail);
          send({
            type: "error",
            error: "Could not analyse this photo with any configured vision provider.",
            detail: detail.slice(0, 800)
          });
        } finally {
          controller.close();
        }
      })();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
};
