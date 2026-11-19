export type AiProvider = "groq" | "gemini" | "openrouter";

// Exact model IDs that passed TrackCake's provider-response and output-schema tests.
// Provider catalogues are still checked at runtime before a model is offered or called.
// New models must pass the benchmark before being added here.
export const VERIFIED_MODELS: Record<AiProvider, readonly string[]> = {
  groq: [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b"
  ],
  gemini: [
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.5-flash-lite"
  ],
  openrouter: [
    "baidu/ernie-5.5-flash-preview:free",
    "nvidia/nemotron-3.5-super-vl:free"
  ]
};

export function isVerifiedModel(provider: string, model: string): provider is AiProvider {
  return (provider === "groq" || provider === "gemini" || provider === "openrouter") &&
    VERIFIED_MODELS[provider].includes(model);
}

// Models specifically approved for image input; text-only models are never sent photos.
export const VERIFIED_VISION_MODELS: Partial<Record<AiProvider, readonly string[]>> = {
  gemini: ["gemini-flash-lite-latest", "gemini-3-flash-preview"],
  openrouter: ["nvidia/nemotron-3.5-super-vl:free"]
};

export function isVerifiedVisionModel(provider: string, model: string): provider is AiProvider {
  return (provider === "groq" || provider === "gemini" || provider === "openrouter") &&
    Boolean(VERIFIED_VISION_MODELS[provider]?.includes(model));
}