import test from "node:test";
import assert from "node:assert/strict";
import { researchNutrition } from "../src/lib/nutrition-research.ts";

const savedEnv = {
  supabaseUrl: process.env.PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.PUBLIC_SUPABASE_ANON_KEY,
  usdaKey: process.env.USDA_FDC_API_KEY,
  webSearch: process.env.GEMINI_WEB_SEARCH_ENABLED
};

function configure() {
  process.env.PUBLIC_SUPABASE_URL = "";
  process.env.PUBLIC_SUPABASE_ANON_KEY = "";
  process.env.USDA_FDC_API_KEY = "unit-test-key";
  process.env.GEMINI_WEB_SEARCH_ENABLED = "false";
}
function restore() {
  for (const [key, value] of Object.entries({
    PUBLIC_SUPABASE_URL: savedEnv.supabaseUrl,
    PUBLIC_SUPABASE_ANON_KEY: savedEnv.supabaseKey,
    USDA_FDC_API_KEY: savedEnv.usdaKey,
    GEMINI_WEB_SEARCH_ENABLED: savedEnv.webSearch
  })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
function providerFetch({ offCalories = 52, usdaCalories = 52 } = {}, calls = []) {
  return async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://world.openfoodfacts.org/")) {
      return new Response(JSON.stringify({ products: [{
        code: "1234567890123", product_name: "apple", brands: "",
        nutriments: {
          "energy-kcal_100g": offCalories, "proteins_100g": 0.26,
          "carbohydrates_100g": 13.81, "fat_100g": 0.17
        }
      }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.startsWith("https://api.nal.usda.gov/")) {
      return new Response(JSON.stringify({ foods: [{
        description: "Apples, raw, with skin",
        foodNutrients: [
          { nutrientId: 1008, nutrientName: "Energy", unitName: "KCAL", value: usdaCalories },
          { nutrientId: 1003, nutrientName: "Protein", unitName: "G", value: 0.26 },
          { nutrientId: 1005, nutrientName: "Carbohydrate, by difference", unitName: "G", value: 13.81 },
          { nutrientId: 1004, nutrientName: "Total lipid (fat)", unitName: "G", value: 0.17 }
        ]
      }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected network request: " + url);
  };
}

test("nutrition research reconciles agreeing Open Food Facts and USDA records", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = providerFetch({}, calls);
  try {
    const [item] = await researchNutrition([{ name: "apple", amount: "100 g", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }]);
    assert.equal(item.calories, 52);
    assert.equal(item.nutrition_status, "Good source match");
    assert.match(item.nutrition_uncertainty.calories, /Calculated from Open Food Facts/);
    assert.equal(calls.filter(url => url.startsWith("https://api.nal.usda.gov/")).length, 1);
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test("nutrition research flags source conflicts without averaging values", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = providerFetch({ offCalories: 52, usdaCalories: 90 });
  try {
    const [item] = await researchNutrition([{ name: "apple", amount: "100 g", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }]);
    assert.equal(item.calories, 52);
    assert.equal(item.nutrition_status, "Needs review");
    assert.match(item.nutrition_conflict, /calories differs/i);
    assert.equal(item.nutrition_secondary_values.calories, 90);
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test("branded product research does not call generic USDA search", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = providerFetch({}, calls);
  try {
    await researchNutrition([{ name: "apple", brand: "Brand X", product_name: "Brand X Apple Juice",
      amount: "100 g", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }]);
    assert.equal(calls.some(url => url.startsWith("https://api.nal.usda.gov/")), false);
  } finally { globalThis.fetch = originalFetch; restore(); }
});
