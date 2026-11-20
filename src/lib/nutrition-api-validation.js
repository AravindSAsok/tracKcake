export function validateEstimatePayload(body, verifyModel) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Please enter a food description." };
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const requested = body.provider ?? "auto";
  let modelChoice;
  if (body.model !== undefined && body.model !== null && body.model !== "") {
    if (typeof body.model !== "string" || body.model.length > 200) {
      return { ok: false, status: 400, error: "Choose a valid model from the model list." };
    }
    if (typeof requested !== "string" || !verifyModel(requested, body.model)) {
      return { ok: false, status: 400, error: "That model is not currently approved for TrackCake. Refresh the model list and choose a verified model." };
    }
    modelChoice = body.model;
  }
  if (modelChoice && requested === "auto") {
    return { ok: false, status: 400, error: "Choose a specific AI provider before selecting a model." };
  }
  if (!["auto", "groq", "gemini", "openrouter"].includes(String(requested))) {
    return { ok: false, status: 400, error: "Choose auto, groq, gemini or openrouter." };
  }
  const researchOnly = body.researchOnly === true;
  const allowedSourceUrls = new Set(Array.isArray(body.sourceUrls)
    ? body.sourceUrls.filter((url) => typeof url === "string" && url.length <= 2048 && /^https:\/\//i.test(url)).slice(0, 3)
    : []);
  if (researchOnly && !allowedSourceUrls.size) {
    return { ok: false, status: 400, error: "The reviewed source list is missing. Search again before using AI." };
  }
  if (!description) return { ok: false, status: 400, error: "Please enter what you ate." };
  if (description.length > (researchOnly ? 24000 : 700)) {
    return { ok: false, status: 400, error: researchOnly ? "The scraped research is too large to process." : "Please keep the food description under 700 characters." };
  }
  return {
    ok: true, description, providerChoice: requested,
    modelChoice, strictModel: body.strictModel === true && Boolean(modelChoice),
    researchOnly, allowedSourceUrls
  };
}

export function isRequestBodyTooLarge(contentLength, maximumBytes) {
  const length = Number(contentLength || 0);
  return Number.isFinite(length) && length > maximumBytes;
}
