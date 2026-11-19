export type AiProvider = "groq" | "gemini" | "openrouter";

// Models that passed previous TrackCake provider-response/schema checks and the
// latest production smoke test. Provider catalogues are still checked live.
export const VERIFIED_MODELS: Record<AiProvider, readonly string[]> = {
  groq: [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b"
  ],
  gemini: [],
  openrouter: [
    "baidu/ernie-5.5-flash-preview:free",
    "nvidia/nemotron-3.5-super-vl:free"
  ]
};

export function isVerifiedModel(provider: string, model: string): provider is AiProvider {
  return (provider === "groq" || provider === "gemini" || provider === "openrouter") &&
    VERIFIED_MODELS[provider].includes(model);
}

// Only keep models with a known image-input capability in this separate list.
export const VERIFIED_VISION_MODELS: Partial<Record<AiProvider, readonly string[]>> = {
  openrouter: ["nvidia/nemotron-3.5-super-vl:free"]
};

export function isVerifiedVisionModel(provider: string, model: string): provider is AiProvider {
  return (provider === "groq" || provider === "gemini" || provider === "openrouter") &&
    Boolean(VERIFIED_VISION_MODELS[provider]?.includes(model));
}