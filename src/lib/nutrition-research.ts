import { matchCatalogCandidate, normalizeNutrition, scoreNutritionEvidence } from "./nutrition-engine.js";

export type NutritionItem = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  brand?: string;
  product_name?: string;
  barcode?: string;
  nutrition_source?: string;
  nutrition_basis?: string;
  nutrition_source_url?: string;
  nutrition_status?: string;
  nutrition_confidence?: number;
  nutrition_method?: string;
};

type Quantity = { value: number; unit: "g" | "ml" };

const OFF_AGENT = "TrackCake/1.0 (food nutrition verification)";
const USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search";

function normalise(value: unknown): string {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function quantityFromAmount(amount: string): Quantity | null {
  const match = amount.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === "kg" || unit.startsWith("kilogram")) return { value: value * 1000, unit: "g" };
  if (unit === "g" || unit.startsWith("gram")) return { value, unit: "g" };
  if (unit === "l" || unit.startsWith("liter") || unit.startsWith("litre")) return { value: value * 1000, unit: "ml" };
  return { value, unit: "ml" };
}

function isLiquid(name: string): boolean {
  return /\b(juice|smoothie|milk|drink|beverage|water|soup|broth|tea|coffee)\b/i.test(name);
}

function scaledItem(
  item: NutritionItem,
  nutrients: { calories: number; protein: number; carbs: number; fat: number },
  quantity: Quantity,
  basisUnit: "g" | "ml",
  source: string,
  basisLabel: string,
  sourceUrl?: string
): NutritionItem | null {
  // Grams and millilitres are never interchangeable without a source-specific density.
  const normalized = normalizeNutrition({
    values: {
      calories_kcal: nutrients.calories,
      protein_g: nutrients.protein,
      carbs_g: nutrients.carbs,
      fat_g: nutrients.fat
    },
    basis: { amount: 100, unit: basisUnit, label: basisLabel }
  }, quantity);
  if (!normalized) return null;
  const sourceLower = source.toLowerCase();
  const sourceType = sourceLower.includes("open food facts") ? "open_food_facts" : sourceLower.includes("usda") ? "usda" : "reviewed_web";
  const extractionMethod = sourceLower.includes("google search") ? "ai_structured" : "structured_api";
  const quality = scoreNutritionEvidence({
    sourceType, matchType: "exact", extractionMethod,
    values: normalized.values, basis: { amount: 100, unit: basisUnit }
  });
  return {
    ...item,
    calories: Math.round(normalized.values.calories_kcal),
    protein_g: normalized.values.protein_g,
    carbs_g: normalized.values.carbs_g,
    fat_g: normalized.values.fat_g,
    nutrition_source: source + " · " + quality.status,
    nutrition_basis: basisLabel + " · calculated for " + quantity.value + " " + quantity.unit,
    nutrition_source_url: sourceUrl,
    nutrition_status: quality.status,
    nutrition_confidence: quality.score,
    nutrition_method: extractionMethod
  };
}

function findQuantity(item: NutritionItem): Quantity | null {
  return quantityFromAmount(item.amount);
}

type CatalogRecord = {
  canonical_name: string; normalized_name: string; aliases?: string[]; brand?: string | null; barcode?: string | null;
  calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; basis_amount: number; basis_unit: "g" | "ml";
  source_name: string; source_record_id?: string | null; source_url?: string | null; extraction_method: string;
  confidence_status: string; is_approved: boolean; approved_at?: string | null;
};

let approvedCatalogCache: { expiresAt: number; rows: CatalogRecord[] } | null = null;

async function lookupApprovedCatalog(item: NutritionItem): Promise<NutritionItem | null> {
  const base = process.env.PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
  const quantity = findQuantity(item);
  if (!base || !anonKey || !quantity) return null;
  try {
    let rows: CatalogRecord[];
    if (approvedCatalogCache && approvedCatalogCache.expiresAt > Date.now()) {
      rows = approvedCatalogCache.rows;
    } else {
      const fields = "canonical_name,normalized_name,aliases,brand,barcode,calories_kcal,protein_g,carbs_g,fat_g,basis_amount,basis_unit,source_name,source_record_id,source_url,extraction_method,confidence_status,is_approved,approved_at";
      const response = await fetch(base + "/rest/v1/nutrition_catalog?select=" + fields + "&is_approved=eq.true&approved_at=not.is.null&limit=500", {
        headers: { apikey: anonKey, Authorization: "Bearer " + anonKey },
        signal: AbortSignal.timeout(2500)
      });
      if (!response.ok) return null;
      const payload = await response.json() as CatalogRecord[];
      rows = Array.isArray(payload) ? payload : [];
      approvedCatalogCache = { rows, expiresAt: Date.now() + 5 * 60_000 };
    }
    const record = matchCatalogCandidate(item, rows);
    if (!record) return null;
    const normalized = normalizeNutrition({
      values: { calories_kcal: Number(record.calories_kcal), protein_g: Number(record.protein_g), carbs_g: Number(record.carbs_g), fat_g: Number(record.fat_g) },
      basis: { amount: Number(record.basis_amount), unit: record.basis_unit, label: "Per " + record.basis_amount + " " + record.basis_unit },
      sourceTitle: record.source_name, sourceUrl: record.source_url || undefined, extractionMethod: record.extraction_method
    }, quantity);
    if (!normalized) return null;
    const quality = scoreNutritionEvidence({
      sourceType: "approved_catalog",
      matchType: item.barcode && item.barcode === record.barcode ? "barcode" : "exact",
      extractionMethod: "structured_api", values: normalized.values,
      basis: { amount: Number(record.basis_amount), unit: record.basis_unit }
    });
    if (quality.status === "Needs review") return null;
    return {
      ...item, name: record.canonical_name,
      calories: Math.round(normalized.values.calories_kcal), protein_g: normalized.values.protein_g,
      carbs_g: normalized.values.carbs_g, fat_g: normalized.values.fat_g,
      nutrition_source: record.source_name + " · " + quality.status,
      nutrition_basis: "Per " + record.basis_amount + " " + record.basis_unit + " · calculated for " + quantity.value + " " + quantity.unit,
      nutrition_source_url: typeof record.source_url === "string" && /^https:\/\//i.test(record.source_url) ? record.source_url : undefined,
      nutrition_status: quality.status, nutrition_confidence: quality.score, nutrition_method: "approved_catalog"
    };
  } catch {
    return null;
  }
}

async function lookupOpenFoodFacts(item: NutritionItem): Promise<NutritionItem | null> {
  const query = [item.brand, item.product_name].filter(Boolean).join(" ").trim();
  if (!query && !item.barcode) return null;
  try {
    const fields = "code,product_name,brands,quantity,nutriments";
    const url = item.barcode
      ? "https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(item.barcode) + ".json?fields=" + fields
      : "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(query) + "&search_simple=1&action=process&json=1&page_size=8&fields=" + fields;
    const response = await fetch(url, {
      headers: { "User-Agent": OFF_AGENT },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) return null;
    const payload = await response.json() as { product?: any; products?: any[] };
    const candidates = payload.product ? [payload.product] : payload.products || [];
    const wantedBrand = normalise(item.brand);
    const wantedName = normalise(item.product_name || item.name);
    const match = candidates.find((candidate) => {
      const candidateBrand = normalise(candidate.brands);
      const candidateName = normalise(candidate.product_name);
      const brandMatch = !wantedBrand || Boolean(candidateBrand && (candidateBrand.includes(wantedBrand) || wantedBrand.includes(candidateBrand)));
      const tokens = wantedName.split(" ").filter((part) => part.length > 2);
      const overlap = tokens.filter((part) => candidateName.includes(part)).length;
      return brandMatch && tokens.length > 0 && overlap >= Math.min(2, tokens.length);
    });
    if (!match) return null;

    const quantity = findQuantity(item);
    if (!quantity) return null;
    const n = match.nutriments || {};
    const per100ml = quantity.unit === "ml" && Number.isFinite(Number(n["energy-kcal_100ml"]));
    const basisUnit = per100ml ? "ml" : "g";
    const calories = Number(per100ml ? n["energy-kcal_100ml"] : n["energy-kcal_100g"]);
    const protein = Number(per100ml ? n["proteins_100ml"] : n["proteins_100g"]);
    const carbs = Number(per100ml ? n["carbohydrates_100ml"] : n["carbohydrates_100g"]);
    const fat = Number(per100ml ? n["fat_100ml"] : n["fat_100g"]);
    if (![calories, protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0) || calories <= 0) return null;

    const displayName = [match.brands, match.product_name].filter(Boolean).join(" ").slice(0, 90);
    return scaledItem(
      { ...item, name: displayName || item.name },
      { calories, protein, carbs, fat },
      quantity,
      basisUnit,
      "Open Food Facts · brand and product matched",
      "Per 100 " + basisUnit,
      match.code || item.barcode ? "https://world.openfoodfacts.org/product/" + encodeURIComponent(String(match.code || item.barcode)) : undefined
    );
  } catch (error) {
    console.warn("[trackcake-nutrition] Open Food Facts lookup unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

function nutrientValue(food: any, id: number, name: RegExp): number | null {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const byId = nutrients.find((entry: any) => Number(entry.nutrientId ?? entry.nutrient?.id) === id);
  const named = nutrients.filter((entry: any) => name.test(String(entry.nutrientName ?? entry.nutrient?.name ?? "")));
  const nutrient = byId || (id === 1008
    ? named.find((entry: any) => String(entry.unitName ?? entry.nutrient?.unitName ?? "").toLowerCase() === "kcal") || named[0]
    : named[0]);
  const value = Number(nutrient?.value ?? nutrient?.amount);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = String(nutrient?.unitName ?? nutrient?.nutrient?.unitName ?? "").toLowerCase();
  return id === 1008 && unit === "kj" ? value / 4.184 : value;
}

function matchScore(item: NutritionItem, candidate: any, context: string): number {
  const requestedText = item.name + " " + context;
  const candidateText = String(candidate.description);
  const wanted = normalise(item.name).split(" ").filter((part) => part.length > 2);
  const found = normalise(candidateText).split(" ");
  if (!wanted.length || !found.length) return 0;
  const overlap = wanted.filter((part) => found.includes(part)).length / wanted.length;
  const rawRequested = /\braw\b/i.test(requestedText);
  const cookedCandidate = /\b(cooked|boiled|roasted|fried|baked|steamed|grilled)\b/i.test(candidateText);
  const rawCandidate = /\braw\b/i.test(candidateText);
  let score = overlap;
  if (rawRequested && rawCandidate) score += 0.15;
  if (rawRequested && cookedCandidate) score -= 0.25;
  if (/\bjuice\b/i.test(item.name) && !/\bjuice\b/i.test(candidateText)) score -= 0.4;
  if (!/\bjuice\b/i.test(item.name) && /\bjuice\b/i.test(candidateText)) score -= 0.2;

  const produceRequested = /\b(apple|apples|banana|bananas|orange|oranges|mango|mangoes|grape|grapes|strawberry|strawberries|blueberry|blueberries|raspberry|raspberries|pear|pears|peach|peaches|plum|plums|pineapple|watermelon|papaya|guava|kiwi|cucumber|tomato|tomatoes|carrot|carrots|potato|potatoes|onion|onions|spinach|broccoli|cauliflower|lettuce|cabbage|avocado|eggplant|brinjal|beetroot|okra|peas|corn)\b/i.test(requestedText);
  const preparationRequested = /\b(raw|fresh|cooked|boiled|roasted|fried|baked|steamed|grilled|dried|dehydrated|powder|chips|juice|nectar|pudding|canned|frozen)\b/i.test(requestedText);
  if (produceRequested && !preparationRequested) {
    if (/\b(dehydrated|dried|powder|chips|nectar|pudding|candied|candy|preserves|syrup)\b/i.test(candidateText)) score -= 0.45;
    else if (cookedCandidate) score -= 0.25;
    else if (rawCandidate) score += 0.1;
  }
  return score;
}

async function lookupUsda(item: NutritionItem, context: string): Promise<NutritionItem | null> {
  const quantity = findQuantity(item);
  if (!quantity) return null;
  if (quantity.unit === "ml" && !isLiquid(item.name)) return null;
  const apiKey = process.env.USDA_FDC_API_KEY?.trim() || "DEMO_KEY";
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      query: item.name.slice(0, 120),
      pageSize: "8"
    });
    params.append("dataType", "Foundation");
    params.append("dataType", "SR Legacy");
    params.append("dataType", "Survey (FNDDS)");
    const response = await fetch(USDA_BASE + "?" + params.toString(), { signal: AbortSignal.timeout(5500) });
    if (!response.ok) return null;
    const payload = await response.json() as { foods?: any[] };
    const candidates = (payload.foods || [])
      .map((food) => ({ food, score: matchScore(item, food, context) }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.score < 0.48) return null;

    const food = best.food;
    const calories = nutrientValue(food, 1008, /energy/i);
    const protein = nutrientValue(food, 1003, /^protein$/i);
    const carbs = nutrientValue(food, 1005, /carbohydrate.*by difference/i);
    const fat = nutrientValue(food, 1004, /^total lipid|total fat/i);
    if (calories === null || protein === null || carbs === null || fat === null || calories <= 0) return null;

    const result = scaledItem(
      item,
      { calories, protein, carbs, fat },
      quantity,
      "g",
      "USDA FoodData Central · matched food",
      "Per 100 g",
      "https://fdc.nal.usda.gov/food-details/" + encodeURIComponent(String(food.fdcId)) + "/nutrients"
    );
    if (!result) return null;
    return { ...result, nutrition_basis: result.nutrition_basis + " · " + String(food.description).slice(0, 100) };
  } catch (error) {
    console.warn("[trackcake-nutrition] USDA lookup unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function lookupGroundedWeb(item: NutritionItem, context: string): Promise<NutritionItem | null> {
  if (process.env.GEMINI_WEB_SEARCH_ENABLED?.trim().toLowerCase() !== "true") return null;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const quantity = findQuantity(item);
  if (!quantity || (quantity.unit === "ml" && !isLiquid(item.name))) return null;

  const model = process.env.GEMINI_WEB_SEARCH_MODEL?.trim() || "gemini-3.6-flash";
  const prompt = [
    "Use Google Search to research reliable nutrition data for this exact food.",
    "Prefer government food composition databases, universities, hospitals, or the manufacturer's official nutrition label.",
    "Match the preparation state and do not substitute a different food.",
    "Return only JSON with: food_name, basis (per 100 g or per 100 ml), calories_kcal, protein_g, carbs_g, fat_g.",
    "Only return values when a credible source supports all four values. Do not guess. If no reliable match exists, return {\"not_found\":true}.",
    "Food: " + [item.brand, item.product_name || item.name].filter(Boolean).join(" "),
    "Requested amount: " + item.amount,
    "User context: " + context.slice(0, 500)
  ].join("\n");

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
        }),
        signal: AbortSignal.timeout(15_000)
      }
    );
    if (!response.ok) return null;
    const payload = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
      }>;
    };
    const candidate = payload.candidates?.[0];
    const output = candidate?.content?.parts?.map((part) => part.text || "").join("") || "";
    const data = extractJson(output);
    if (!data || data.not_found === true) return null;
    const calories = Number(data.calories_kcal);
    const protein = Number(data.protein_g);
    const carbs = Number(data.carbs_g);
    const fat = Number(data.fat_g);
    if (![calories, protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0) || calories <= 0 || calories > 1000) return null;

    const basis = String(data.basis || "").toLowerCase();
    const basisUnit = basis.includes("ml") ? "ml" : basis.includes("g") ? "g" : null;
    if (!basisUnit) return null;
    const source = candidate?.groundingMetadata?.groundingChunks?.find((chunk) => chunk.web?.uri)?.web;
    if (!source?.uri) return null;
    return scaledItem(
      item,
      { calories, protein, carbs, fat },
      quantity,
      basisUnit,
      "Google Search · AI-researched nutrition",
      "Per 100 " + basisUnit + (data.food_name ? " · " + String(data.food_name).slice(0, 80) : ""),
      source.uri
    );
  } catch (error) {
    console.warn("[trackcake-nutrition] grounded web lookup unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export async function researchNutrition(
  items: NutritionItem[],
  context = "",
  onProgress: (message: string) => void = () => {}
): Promise<NutritionItem[]> {
  return Promise.all(items.map(async (item, index) => {
    onProgress("Checking nutrition sources for " + item.name + "…");
    const approved = await lookupApprovedCatalog(item);
    if (approved) return approved;
    const product = await lookupOpenFoodFacts(item);
    if (product) return product;
    const usda = await lookupUsda(item, context);
    if (usda) return usda;

    if (index < 3) {
      // Keep optional Google Search grounding as a bounded fallback.
      const grounded = await lookupGroundedWeb(item, context);
      if (grounded) return grounded;
    }
    return {
      ...item,
      nutrition_source: "AI estimate · no verified nutrition match",
      nutrition_basis: "No reliable matching database or enabled web source was found. Please review the estimate.",
      nutrition_status: "AI estimate",
      nutrition_confidence: 0,
      nutrition_method: "ai_fallback"
    };
  }));
}
