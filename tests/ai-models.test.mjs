import test from "node:test";
import assert from "node:assert/strict";
import { isVerifiedModel, isVerifiedVisionModel, VERIFIED_MODELS } from "../src/lib/ai-models.ts";

test("TrackCake allows multiple current Gemini text candidates for strict benchmarking", () => {
  assert.deepEqual(VERIFIED_MODELS.gemini, [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest"
  ]);
  for (const model of VERIFIED_MODELS.gemini) assert.equal(isVerifiedModel("gemini", model), true);
});

test("Gemini text candidates are not implicitly approved for image input", () => {
  for (const model of VERIFIED_MODELS.gemini) assert.equal(isVerifiedVisionModel("gemini", model), false);
});

test("unknown and retired Gemini model IDs are not approved", () => {
  assert.equal(isVerifiedModel("gemini", "gemini-2.5-flash"), false);
  assert.equal(isVerifiedModel("gemini", "gemini-3.1-flash-lite-preview"), false);
});
