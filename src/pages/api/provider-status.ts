import type { APIRoute } from "astro";

export const prerender = false;
export const maxDuration = 20;

type ModelRecord = { id?: string; name?: string; displayName?: string; supportedGenerationMethods?: string[]; pricing?: { prompt?: string; completion?: string } };

const responseJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function probe(
  provider: "groq" | "gemini" | "openrouter",
  key: string | undefined
) {
  if (!key) return { provider, configured: false, ok: false, status: "missing_key", modelCount: 0, models: [] as Array<{ id: string; name: string }> };

  const started = Date.now();
  const endpoint = provider === "groq"
    ? "https://api.groq.com/openai/v1/models"
    : provider === "openrouter"
      ? "https://openrouter.ai/api/v1/models/user?output_modalities=text&endpoints=%2Fapi%2Fv1%2Fchat%2Fcompletions"
      : "https://generativelanguage.googleapis.com/v1beta/models";

  try {
    const response = await fetch(endpoint, {
      headers: provider === "gemini"
        ? { "x-goog-api-key": key }
        : {
            "Authorization": `Bearer ${key}`,
            ...(provider === "openrouter" ? {
              "HTTP-Referer": "https://trackcake.vercel.app",
              "X-Title": "TrackCake"
            } : {})
          },
      signal: AbortSignal.timeout(7_000)
    });

    if (!response.ok) {
      return {
        provider, configured: true, ok: false, status: response.status,
        message: response.status === 401 || response.status === 403
          ? "The provider rejected this API key or its permissions."
          : response.status === 429
            ? "The provider rate-limited the model-list request."
            : `The provider returned HTTP ${response.status}.`,
        latencyMs: Date.now() - started, modelCount: 0, models: [] as Array<{ id: string; name: string }>
      };
    }

    const payload = await response.json() as { data?: ModelRecord[]; models?: ModelRecord[] };
    const records = (payload.data ?? payload.models ?? []).filter((model) => {
      const id = (model.id ?? model.name ?? "").toLowerCase();
      if (provider === "groq") {
        return Boolean(model.id) && !/(whisper|orpheus|prompt-guard|safeguard|embedding|tts|transcrib|speech)/.test(id);
      }
      if (provider === "gemini") {
        return Boolean(model.name) &&
          (!model.supportedGenerationMethods || model.supportedGenerationMethods.includes("generateContent")) &&
          !/(2[.]5|3[.]8|tts|image|banana|lyria|transcrib|robotics|deep-research|antigravity|computer-use)/.test(id);
      }
      return Boolean(model.id) && !(/:batch$|image|banana|audio|speech|transcrib|tts|lyria|video|embedding/.test(id));
    });
    const ids = records.map((model) => {
      const id = model.id ?? model.name ?? "";
      return id.replace(/^models\//, "");
    }).filter(Boolean);

    const modelOptions = records.map((model) => {
      const rawId = model.id ?? model.name ?? "";
      const id = rawId.replace(/^models\//, "");
      return id ? { id, name: model.displayName || id } : null;
    }).filter((model): model is { id: string; name: string } => Boolean(model));

    const preferred = provider === "groq"
      ? ["llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"]
      : provider === "gemini"
        ? ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"]
        : ["openrouter/free", ...ids.filter((id) => id.endsWith(":free")).slice(0, 4)];

    return {
      provider, configured: true, ok: true, status: response.status,
      latencyMs: Date.now() - started, modelCount: ids.length,
      recommendedModels: [...new Set(preferred.filter((id) => id === "openrouter/free" || ids.includes(id)))].slice(0, 5),
      sampleModels: ids.slice(0, 8),
      models: modelOptions
    };
  } catch (error) {
    return {
      provider, configured: true, ok: false,
      status: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
      message: "Could not reach the provider model-list endpoint.",
      latencyMs: Date.now() - started, modelCount: 0, models: [] as Array<{ id: string; name: string }>
    };
  }
}

export const GET: APIRoute = async () => {
  const results = await Promise.all([
    probe("groq", process.env.GROQ_API_KEY?.trim()),
    probe("gemini", process.env.GEMINI_API_KEY?.trim()),
    probe("openrouter", process.env.OPENROUTER_API_KEY?.trim())
  ]);
  const passed = results.filter((result) => result.ok).length;
  return responseJson({
    checkedAt: new Date().toISOString(),
    summary: { passed, total: results.length },
    providers: results
  }, passed > 0 ? 200 : 503);
};
