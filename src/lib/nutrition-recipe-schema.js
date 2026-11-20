const CORE = ["calories_kcal", "protein_g", "carbs_g", "fat_g"];
const validNutrition = (values) => Boolean(values && typeof values === "object" &&
  CORE.every((key) => typeof values[key] === "number" && Number.isFinite(values[key]) &&
    values[key] >= 0 && values[key] <= (key === "calories_kcal" ? 10000 : 1000)));

export function isValidNutritionRecipeRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      typeof record.id !== "string" || !record.id ||
      typeof record.recipe_name !== "string" || !record.recipe_name.trim() || record.recipe_name.length > 90 ||
      !Number.isInteger(record.servings) || record.servings < 1 || record.servings > 50 ||
      !Array.isArray(record.ingredients) || record.ingredients.length < 2 || record.ingredients.length > 8 ||
      !validNutrition(record.total_nutrition) || !validNutrition(record.per_serving_nutrition) ||
      (record.diary_entry_id !== null && typeof record.diary_entry_id !== "string") ||
      typeof record.created_at !== "string") return false;
  return record.ingredients.every((item) =>
    item && typeof item === "object" && !Array.isArray(item) &&
    typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 100 &&
    typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount > 0 &&
    ["g", "ml"].includes(item.unit) && validNutrition(item.values) &&
    typeof item.source === "string" && typeof item.sourceUrl === "string" &&
    (!item.sourceUrl || /^https:\/\//i.test(item.sourceUrl)) &&
    typeof item.originalLine === "string" && item.originalLine.length <= 180);
}
