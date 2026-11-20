export type EstimatePayloadResult =
  | { ok: false; status: number; error: string }
  | { ok: true; description: string; providerChoice: "auto" | "groq" | "gemini" | "openrouter"; modelChoice?: string; strictModel: boolean; researchOnly: boolean; allowedSourceUrls: Set<string> };
export function validateEstimatePayload(body: unknown, verifyModel: (provider: string, model: string) => boolean): EstimatePayloadResult;
export function isRequestBodyTooLarge(contentLength: string | null, maximumBytes: number): boolean;
