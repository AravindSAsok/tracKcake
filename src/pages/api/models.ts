import type { APIRoute } from "astro";

export const prerender = false;

type GeminiModel = {
  name?: string;
  displayName?: string;
  description?: string;
  version?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

type ModelsResponse = {
  models?: GeminiModel[];
  nextPageToken?: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

function modelId(name: string): string {
  return name.replace(/^models\//, "");
}

function versionScore(id: string): number {
  const match = id.match(/^gemini-(\d+)(?:\.(\d+))?/i);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number(match[2] ?? 0);
}

function isStable(id: string): boolean {
  return !/(preview|experimental|(^|[-.])exp($|[-.]))/i.test(id);
}

function newestFirst<T extends { id: string }>(models: T[]): T[] {
  return [...models].sort((a, b) => {
    const score = versionScore(b.id) - versionScore(a.id);
    if (score !== 0) return score;
    return a.id.localeCompare(b.id);
  });
}

async function probeModel(id: string, apiKey: string): Promise<{ model: string; ok: boolean; status: number; error?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 }
        }),
        signal: AbortSignal.timeout(25_000)
      }
    );
    if (response.ok) return { model: id, ok: true, status: response.status };
    const text = await response.text();
    let message = "";
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      message = "";
    }
    if (/AIza|key=|x-goog-api-key|credential|token/i.test(message)) {
      message = "Google API rejected the request (sensitive details withheld).";
    }
    return { model: id, ok: false, status: response.status, error: message.slice(0, 240) || "No error detail returned." };
  } catch {
    return { model: id, ok: false, status: 0, error: "Network request timed out or failed." };
  }
}

export const GET: APIRoute = async ({ request }) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return json({ error: "GEMINI_API_KEY is not configured on the server." }, 503);
  }

  try {
    const models: GeminiModel[] = [];
    let pageToken: string | undefined;

    // Gemini normally returns the full catalog in one page; retain pagination support.
    for (let page = 0; page < 5; page += 1) {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url, {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(8_000)
      });

      if (!response.ok) {
        console.warn("[gemini-model-check] model listing failed", response.status);
        return json({
          error: "Gemini rejected the model-list request.",
          httpStatus: response.status
        }, 502);
      }

      const payload = await response.json() as ModelsResponse;
      models.push(...(payload.models ?? []));
      pageToken = payload.nextPageToken;
      if (!pageToken) break;
    }

    const supported = models
      .filter((model) =>
        typeof model.name === "string" &&
        model.supportedGenerationMethods?.includes("generateContent")
      )
      .map((model) => ({
        id: modelId(model.name!),
        displayName: model.displayName ?? modelId(model.name!),
        description: model.description ?? null,
        version: model.version ?? null,
        inputTokenLimit: model.inputTokenLimit ?? null,
        outputTokenLimit: model.outputTokenLimit ?? null,
        stable: isStable(modelId(model.name!))
      }));

    const stable = supported.filter((model) => model.stable);
    const pro = newestFirst(supported.filter((model) =>
      /gemini-(?:\d+(?:\.\d+)?-)?pro(?:-|$)/i.test(model.id) &&
      !/(image|tts|deep-research)/i.test(model.id)
    ));
    const flash = newestFirst(stable.filter((model) =>
      /-flash(?:-|$)/i.test(model.id) &&
      !/(image|tts)/i.test(model.id)
    ));
    // Prefer a current stable Flash model for nutrition logging; expose Pro separately.
    const recommended = flash[0] ?? pro[0] ?? newestFirst(stable)[0] ?? newestFirst(supported)[0];

    const result: Record<string, unknown> = {
      checkedAt: new Date().toISOString(),
      apiKeyConfigured: true,
      generateContentModelCount: supported.length,
      recommendedForHighestQuality: pro[0]?.id ?? null,
      recommendedForSpeedAndValue: flash[0]?.id ?? null,
      recommendedModel: recommended?.id ?? null,
      currentConfiguredModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      models: supported
    };

    const requestUrl = new URL(request.url);
    const requestedModel = requestUrl.searchParams.get("model");
    const requestedIsSupported = requestedModel
      ? supported.some((model) => model.id === requestedModel)
      : false;

    if (requestUrl.searchParams.get("probe") === "1" && (requestedIsSupported || recommended)) {
      let probe = await probeModel(requestedIsSupported ? requestedModel! : recommended!.id, apiKey);
      if (!requestedIsSupported && !probe.ok && flash[0] && flash[0].id !== recommended?.id) {
        const fallback = await probeModel(flash[0].id, apiKey);
        if (fallback.ok) probe = fallback;
        result.fallbackProbe = fallback;
      }
      result.probe = probe;
      result.workingRecommendedModel = probe.ok ? probe.model : null;
      console.info("[gemini-model-check] result", {
        available: supported.length,
        selected: probe.model,
        probeStatus: probe.status
      });
    }

    return json(result);
  } catch (error) {
    console.error("[gemini-model-check] failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Gemini model discovery failed. Check the Vercel function logs." }, 502);
  }
};
