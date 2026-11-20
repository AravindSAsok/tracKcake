import test from "node:test";
import assert from "node:assert/strict";
import { validateAiNutritionItem } from "../src/lib/nutrition-ai-schema.js";

const base = {
  name: "Cooked rice", amount: "150 g",
  calories: 195, protein_g: 4, carbs_g: 42, fat_g: 0.4
};

test("AI schema accepts nullable optional nutrients and labels unknown fields", () => {
  const item = validateAiNutritionItem({ ...base, fiber_g: null, sugar_g: null, saturated_fat_g: null, sodium_mg: null });
  assert.equal(item.fiber_g, null);
  assert.equal(item.nutrition_uncertainty.fiber_g, "Not provided by model");
  assert.equal(item.nutrition_uncertainty.calories, "AI estimate");
  assert.equal(item.nutrition_schema_version, "nutrition-v2");
});

test("AI schema rejects missing core fields rather than converting them to zero", () => {
  assert.throws(() => validateAiNutritionItem({ ...base, protein_g: null }), /omitted or malformed protein_g/);
});

test("AI schema rejects impossible values and calories/macro inconsistency", () => {
  assert.throws(() => validateAiNutritionItem({ ...base, sodium_mg: 200000 }), /invalid sodium_mg/);
  assert.throws(() => validateAiNutritionItem({ ...base, calories: 900 }), /inconsistent calories/);
});

test("reviewed-source mode only accepts selected HTTPS evidence", () => {
  const allowed = new Set(["https://example.org/label"]);
  const complete = { ...base, fiber_g: 0, sugar_g: 0, saturated_fat_g: 0, sodium_mg: 2,
    source_evidence: { title: "Nutrition label", url: "https://example.org/label" } };
  assert.equal(validateAiNutritionItem(complete, { researchOnly: true, allowedSourceUrls: allowed }).nutrition_source_url,
    "https://example.org/label");
  assert.throws(() => validateAiNutritionItem({ ...complete, source_evidence: { url: "https://evil.example/" } },
    { researchOnly: true, allowedSourceUrls: allowed }), /URL from the sources you selected/);
});

test("AI schema validates bounded ingredient arrays", () => {
  assert.throws(() => validateAiNutritionItem({ ...base, ingredients: ["rice", 4] }), /invalid ingredient list/);
  assert.deepEqual(validateAiNutritionItem({ ...base, ingredients: ["rice", "water"] }).ingredients, ["rice", "water"]);
});
