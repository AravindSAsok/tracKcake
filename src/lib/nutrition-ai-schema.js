const CORE = ["calories", "protein_g", "carbs_g", "fat_g"];
const OPTIONAL = ["fiber_g", "sugar_g", "saturated_fat_g", "sodium_mg"];
const LIMITS = { calories: 10000, protein_g: 1000, carbs_g: 1000, fat_g: 1000, fiber_g: 1000, sugar_g: 1000, saturated_fat_g: 1000, sodium_mg: 100000 };

function nullableNumber(value, key) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > LIMITS[key]) {
    throw new Error("The AI returned an invalid " + key + " value. Another model will be tried.");
  }
  return Math.round(value * 100) / 100;
}

export function validateAiNutritionItem(raw, options = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The AI provider returned an invalid food item.");
  }
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 90) : "";
  const amount = typeof raw.amount === "string" ? raw.amount.trim().slice(0, 90) : "";
  if (!name || !amount) throw new Error("The AI provider omitted the food identity or portion.");
  const values = {};
  for (const key of CORE) {
    if (typeof raw[key] !== "number") throw new Error("The AI provider omitted or malformed " + key + ". Missing core values are not replaced with zero.");
    values[key] = nullableNumber(raw[key], key);
  }
  if (values.calories <= 0) throw new Error("The AI returned an implausible calorie value.");
  for (const key of OPTIONAL) values[key] = nullableNumber(raw[key], key);

  const macroEnergy = values.protein_g * 4 + values.carbs_g * 4 + values.fat_g * 9;
  const tolerance = Math.max(50, values.calories * 0.3);
  if (Math.abs(macroEnergy - values.calories) > tolerance) {
    throw new Error("The AI returned inconsistent calories and macronutrients. Another model will be tried.");
  }

  const basis = typeof raw.serving_basis === "string" ? raw.serving_basis.trim().slice(0, 180)
    : typeof raw.nutrition_basis === "string" ? raw.nutrition_basis.trim().slice(0, 180) : "";
  const ingredients = raw.ingredients === undefined || raw.ingredients === null ? []
    : Array.isArray(raw.ingredients) && raw.ingredients.length <= 20 &&
      raw.ingredients.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 120)
      ? raw.ingredients.map((item) => item.trim()) : null;
  if (ingredients === null) throw new Error("The AI returned an invalid ingredient list.");

  const identity = raw.food_identity && typeof raw.food_identity === "object" && !Array.isArray(raw.food_identity)
    ? raw.food_identity : {};
  const sourceUrl = typeof raw.source_evidence?.url === "string" ? raw.source_evidence.url
    : typeof raw.nutrition_source_url === "string" ? raw.nutrition_source_url : "";
  if (options.researchOnly) {
    if (OPTIONAL.some((key) => values[key] === null) ||
        !/^https:\/\//i.test(sourceUrl) || !options.allowedSourceUrls?.has(sourceUrl)) {
      throw new Error("Reviewed-source extraction requires complete values and a URL from the sources you selected.");
    }
  }

  const uncertainty = {};
  for (const key of CORE) uncertainty[key] = "AI estimate";
  for (const key of OPTIONAL) uncertainty[key] = values[key] === null ? "Not provided by model" : "AI estimate";

  return {
    name, amount, calories: values.calories,
    protein_g: values.protein_g, carbs_g: values.carbs_g, fat_g: values.fat_g,
    fiber_g: values.fiber_g, sugar_g: values.sugar_g,
    saturated_fat_g: values.saturated_fat_g, sodium_mg: values.sodium_mg,
    brand: typeof identity.brand === "string" ? identity.brand.slice(0, 80) : typeof raw.brand === "string" ? raw.brand.slice(0, 80) : undefined,
    product_name: typeof identity.product_name === "string" ? identity.product_name.slice(0, 100) : typeof raw.product_name === "string" ? raw.product_name.slice(0, 100) : undefined,
    ingredients,
    nutrition_source: typeof raw.source_evidence?.title === "string" ? raw.source_evidence.title.slice(0, 180)
      : typeof raw.nutrition_source === "string" ? raw.nutrition_source.slice(0, 180) : options.researchOnly ? "Reviewed web source · AI structured" : "AI estimate · model generated",
    nutrition_status: options.researchOnly ? "Needs review" : "AI estimate",
    nutrition_confidence: 0,
    nutrition_method: options.researchOnly ? "ai_structured" : "ai_fallback",
    nutrition_uncertainty: uncertainty,
    nutrition_basis: basis || undefined,
    nutrition_source_url: /^https:\/\//i.test(sourceUrl) && (!options.researchOnly || options.allowedSourceUrls?.has(sourceUrl)) ? sourceUrl.slice(0, 2048) : undefined,
    nutrition_schema_version: "nutrition-v2"
  };
}
