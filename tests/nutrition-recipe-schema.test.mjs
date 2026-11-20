import test from "node:test";
import assert from "node:assert/strict";
import { isValidNutritionRecipeRecord } from "../src/lib/nutrition-recipe-schema.js";

const ingredient = {
  name: "Cooked rice", amount: 100, unit: "g",
  values: { calories_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
  source: "USDA FoodData Central", sourceUrl: "https://fdc.nal.usda.gov/",
  originalLine: "100 g cooked rice"
};
const recipe = {
  id: "recipe-1", recipe_name: "Rice bowl", servings: 2,
  ingredients: [ingredient, { ...ingredient, name: "Lentils", originalLine: "100 g lentils" }],
  total_nutrition: { calories_kcal: 300, protein_g: 10, carbs_g: 50, fat_g: 2 },
  per_serving_nutrition: { calories_kcal: 150, protein_g: 5, carbs_g: 25, fat_g: 1 },
  diary_entry_id: "diary-1", created_at: "2026-11-20T00:00:00.000Z"
};

test("recipe history accepts complete ingredient-level provenance and per-serving totals", () => {
  assert.equal(isValidNutritionRecipeRecord(recipe), true);
});

test("recipe history rejects missing quantities, unsupported units and malformed nutrition", () => {
  assert.equal(isValidNutritionRecipeRecord({ ...recipe, ingredients: [{ ...ingredient, amount: 0 }, ingredient] }), false);
  assert.equal(isValidNutritionRecipeRecord({ ...recipe, ingredients: [{ ...ingredient, unit: "cup" }, ingredient] }), false);
  assert.equal(isValidNutritionRecipeRecord({ ...recipe, per_serving_nutrition: { ...recipe.per_serving_nutrition, calories_kcal: -1 } }), false);
});

test("recipe history rejects untrusted non-HTTPS source links and invalid serving counts", () => {
  assert.equal(isValidNutritionRecipeRecord({ ...recipe, ingredients: [{ ...ingredient, sourceUrl: "http://bad.example" }, ingredient] }), false);
  assert.equal(isValidNutritionRecipeRecord({ ...recipe, servings: 0 }), false);
  assert.equal(isValidNutritionRecipeRecord({ ...recipe, ingredients: [ingredient] }), false);
});

test("recipe history preserves nullable optional nutrients without accepting invalid values", () => {
  const withOptional = {
    ...recipe,
    ingredients: recipe.ingredients.map((item) => ({
      ...item, values: { ...item.values, fiber_g: 2.4, sugar_g: null, saturated_fat_g: 0.03, sodium_mg: 1 }
    }))
  };
  assert.equal(isValidNutritionRecipeRecord(withOptional), true);
  const invalid = {
    ...recipe,
    ingredients: recipe.ingredients.map((item) => ({
      ...item, values: { ...item.values, sodium_mg: -1 }
    }))
  };
  assert.equal(isValidNutritionRecipeRecord(invalid), false);
});
