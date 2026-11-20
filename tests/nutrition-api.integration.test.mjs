import test from "node:test";
import assert from "node:assert/strict";
import { isRequestBodyTooLarge, validateEstimatePayload } from "../src/lib/nutrition-api-validation.js";

const verifyModel = (provider, model) => provider === "gemini" && model === "gemini-3.6-flash";

test("estimate API request validator rejects empty descriptions and unsupported providers", () => {
  assert.equal(validateEstimatePayload({ description: " " }, verifyModel).ok, false);
  const provider = validateEstimatePayload({ description: "100 g apple", provider: "unknown" }, verifyModel);
  assert.equal(provider.ok, false);
  if (!provider.ok) assert.match(provider.error, /Choose auto, groq, gemini or openrouter/);
});

test("estimate API request validator rejects unverified models and missing reviewed sources", () => {
  const model = validateEstimatePayload({ description: "100 g apple", provider: "gemini", model: "untrusted-model" }, verifyModel);
  assert.equal(model.ok, false);
  const research = validateEstimatePayload({ description: "Nutrition facts", researchOnly: true, sourceUrls: [] }, verifyModel);
  assert.equal(research.ok, false);
  if (!research.ok) assert.match(research.error, /source list is missing/);
});

test("estimate API request validator enforces description and request body limits", () => {
  const description = validateEstimatePayload({ description: "x".repeat(701) }, verifyModel);
  assert.equal(description.ok, false);
  assert.equal(isRequestBodyTooLarge("50000", 40000), true);
  assert.equal(isRequestBodyTooLarge("200", 40000), false);
});
