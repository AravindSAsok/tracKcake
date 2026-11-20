export type AiProvider = "groq" | "gemini" | "openrouter";

// Models that passed previous TrackCake provider-response/schema checks and
// remain subject to a live provider-catalogue check before use.
export const VERIFIED_MODELS: Record<AiProvider, readonly string[]> = {
  groq: [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b"
  ],
  // Temporarily enabled for user testing. It passed the simple "apple" test
  // but failed the mixed-meal test twice (timeout, then provider high demand).
  // Keep this experimental until repeated mixed-meal tests pass.
  gemini: [
    "gemini-flash-lite-latest"
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

// Only keep models with a known image-input capability in this separate list.
// Gemini Flash Lite is enabled for text estimates only; do not send it images.
export const VERIFIED_VISION_MODELS: Partial<Record<AiProvider, readonly string[]>> = {
  openrouter: ["nvidia/nemotron-3.5-super-vl:free"]
};

export function isVerifiedVisionModel(provider: string, model: string): provider is AiProvider {
  return (provider === "groq" || provider === "gemini" || provider === "openrouter") &&
    Boolean(VERIFIED_VISION_MODELS[provider]?.includes(model));
}