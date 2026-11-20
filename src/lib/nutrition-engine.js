const CORE_KEYS = ["calories_kcal", "protein_g", "carbs_g", "fat_g"];

const ALIASES = [
  ["calories_kcal", /^(?:energy|calories?|calorie value|energy value)$/i],
  ["protein_g", /^(?:protein|proteins)$/i],
  ["carbs_g", /^(?:carbohydrates?|carbs?|total carbohydrate)$/i],
  ["fat_g", /^(?:total fat|fat|total lipid)$/i],
  ["fiber_g", /^(?:dietary fiber|fibre|fiber)$/i],
  ["sugar_g", /^(?:total sugars?|sugars?)$/i],
  ["saturated_fat_g", /^(?:saturated fat|saturates)$/i],
  ["sodium_mg", /^(?:sodium)$/i]
];

const round = (value, digits = 2) => Number(value.toFixed(digits));
const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;

export function normalizeFoodName(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\s+/g, " ");
}

export function parseNutritionNumber(input) {
  if (typeof input === "number") {
    return finiteNonNegative(input) ? { value: input, qualifier: "exact", min: input, max: input } : null;
  }
  if (typeof input !== "string") return null;
  let raw = input.trim();
  if (raw.includes(",")) {
    if (raw.includes(".") || (raw.match(/,/g) || []).length !== 1 || !/,\d{1,2}$/.test(raw)) return null;
    raw = raw.replace(",", ".");
  }
  const qualifierMatch = raw.match(/^\s*(<|>|≤|≥|less than|more than|about|approximately|~)\s*/i);
  const qualifier = qualifierMatch ? qualifierMatch[1].toLowerCase() : "exact";
  if (qualifierMatch) raw = raw.slice(qualifierMatch[0].length);
  const range = raw.match(/^\s*(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*$/i);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    if (!finiteNonNegative(first) || !finiteNonNegative(second) || second < first) return null;
    return { value: null, qualifier: "range", min: first, max: second };
  }
  const match = raw.match(/^\s*(\d+(?:\.\d+)?|\.\d+)\s*$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!finiteNonNegative(value)) return null;
  return { value, qualifier, min: value, max: value };
}

export function parseServingBasis(text) {
  const value = String(text ?? "");
  const per = value.match(/\bper\s*(100|\d+(?:\.\d+)?)\s*(g|grams?|ml|millilit(?:er|re)s?)\b/i);
  if (per) {
    const amount = Number(per[1]);
    const unit = /^g/i.test(per[2]) ? "g" : "ml";
    if (amount > 0) return { amount, unit, label: "per " + amount + " " + unit };
  }
  const serving = value.match(/\bserving(?:\s*size)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(g|grams?|ml|millilit(?:er|re)s?)\b/i);
  if (serving) {
    const amount = Number(serving[1]);
    const unit = /^g/i.test(serving[2]) ? "g" : "ml";
    if (amount > 0) return { amount, unit, label: "per serving (" + amount + " " + unit + ")" };
  }
  return null;
}

export function nutrientForLabel(label) {
  const clean = normalizeFoodName(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
  return ALIASES.find(([, pattern]) => pattern.test(clean))?.[0] ?? null;
}

export function parseValueAndUnit(valueText, key) {
  const text = String(valueText);
  const values = text.match(/(?:<|>|≤|≥|~)?\s*\d+(?:[.,]\d+)?\s*(?:kcal|calories?|kj|g|grams?|mg|mcg|µg|μg|ml|millilit(?:er|re)s?)\b/gi) || [];
  if (values.length !== 1) return null;
  const match = text.match(/(?:^|\s)(<|>|≤|≥|~)?\s*(\d+(?:[.,]\d+)?|[.,]\d+)(?:\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?))?\s*(kcal|calories?|kj|g|grams?|mg|mcg|µg|μg|ml|millilit(?:er|re)s?)\b/i);
  if (!match || match[3]) return null;
  if (match[2].includes(",") && !/,\d{1,2}$/.test(match[2])) return null;
  const numeric = match[2].replace(",", ".");
  const parsed = parseNutritionNumber(match[1] ? match[1] + numeric : numeric);
  if (!parsed || parsed.value === null) return null;
  let value = parsed.value;
  const unit = match[4].toLowerCase()
    .replace("calories", "kcal").replace("calorie", "kcal")
    .replace("grams", "g").replace("gram", "g")
    .replace("milliliters", "ml").replace("milliliter", "ml")
    .replace("millilitres", "ml").replace("millilitre", "ml")
    .replace("µg", "mcg").replace("μg", "mcg");
  if (key === "calories_kcal") {
    if (unit === "kj") value /= 4.184;
    else if (unit !== "kcal") return null;
  } else if (key === "sodium_mg") {
    if (unit === "g") value *= 1000;
    else if (unit !== "mg") return null;
  } else if (key.endsWith("_g")) {
    if (unit === "mg") value /= 1000;
    else if (unit === "mcg") value /= 1_000_000;
    else if (unit !== "g") return null;
  } else return null;
  if (!finiteNonNegative(value) || value > (key === "calories_kcal" ? 10000 : 1000)) return null;
  return { value: round(value, 4), raw: match[0].trim(), rawUnit: match[4], unit: key === "calories_kcal" ? "kcal" : key === "sodium_mg" ? "mg" : "g", qualifier: match[1] || "exact" };
}


function schemaNutritionCandidates(value, output = [], depth = 0, budget = { count: 0 }) {
  if (depth > 12 || budget.count > 1200 || value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    for (const item of value) schemaNutritionCandidates(item, output, depth + 1, budget);
    return output;
  }
  if (typeof value !== "object") return output;
  budget.count += 1;
  const required = ["servingSize", "calories", "proteinContent", "carbohydrateContent", "fatContent"];
  if (required.every((key) => value[key] !== undefined && value[key] !== null && value[key] !== "")) output.push(value);
  for (const child of Object.values(value)) schemaNutritionCandidates(child, output, depth + 1, budget);
  return output;
}

function factsFromJsonLd(content, metadata) {
  const scripts = [...content.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) return null;
  const candidates = [];
  for (const match of scripts) {
    try { schemaNutritionCandidates(JSON.parse(match[1].trim()), candidates); } catch { /* Ignore malformed JSON-LD. */ }
  }
  const complete = [];
  for (const candidate of candidates) {
    const calories = typeof candidate.calories === "number" ? candidate.calories + " kcal" : String(candidate.calories);
    const rows = [
      "Serving size: " + String(candidate.servingSize),
      "Energy: " + calories,
      "Protein: " + String(candidate.proteinContent),
      "Carbohydrate: " + String(candidate.carbohydrateContent),
      "Total fat: " + String(candidate.fatContent)
    ];
    for (const [property, label] of [["fiberContent","Dietary fiber"],["sugarContent","Total sugars"],
      ["saturatedFatContent","Saturated fat"],["sodiumContent","Sodium"]]) {
      if (candidate[property] !== undefined && candidate[property] !== null) rows.push(label + ": " + String(candidate[property]));
    }
    const facts = extractNutritionFacts(rows.join("\n"), { ...metadata, extractionMethod:"deterministic_json_ld" });
    if (facts) complete.push(facts);
  }
  if (!complete.length) return null;
  const first = complete[0];
  const sameBasis = complete.every(candidate => candidate.basis.amount === first.basis.amount && candidate.basis.unit === first.basis.unit);
  const sameValues = complete.every(candidate => CORE_KEYS.every(key => Math.abs(candidate.values[key] - first.values[key]) <= 0.01));
  return sameBasis && sameValues ? first : null;
}

function normalizeHtmlNutritionText(content) {
  if (!/<(?:table|tr|td|th|caption|br)\b/i.test(content)) return content;
  return content
    .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/tr\s*>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, " | ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ");
}

export function extractNutritionFacts(markdown, metadata = {}) {
  const rawContent = String(markdown ?? "").slice(0, 14000);
  const jsonLdFacts = factsFromJsonLd(rawContent, metadata);
  if (jsonLdFacts) return jsonLdFacts;
  const content = normalizeHtmlNutritionText(rawContent);
  const basis = parseServingBasis(content);
  if (!basis) return null;
  const values = {};
  const rawFacts = {};
  const conflicts = new Set();
  for (const line of content.split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim().replace(/^[-:]+|[-:]+$/g, "")).filter(Boolean);
    let candidates = cells.length > 1 ? cells : [line.trim()];
    if (cells.length <= 1) {
      const colon = line.indexOf(":");
      if (colon > 0) {
        const label = line.slice(0, colon).trim();
        if (nutrientForLabel(label)) candidates = [label, line.slice(colon + 1).trim()];
      } else {
        const labelled = line.match(/^\s*(Energy|Calories?|Protein|Carbohydrates?|Carbs?|Total fat|Fat|Total lipid|Dietary fiber|Fibre|Fiber|Total sugars?|Sugars?|Saturated fat|Sodium)\s+(.+)$/i);
        if (labelled) candidates = [labelled[1], labelled[2]];
      }
    }
    for (let index = 0; index < candidates.length; index += 1) {
      const key = nutrientForLabel(candidates[index]);
      if (!key || conflicts.has(key)) continue;
      const valueText = candidates.slice(index + 1).join(" ") || line;
      const parsed = parseValueAndUnit(valueText, key);
      if (!parsed) continue;
      if (values[key] !== undefined && Math.abs(values[key] - parsed.value) > 0.01) {
        delete values[key];
        delete rawFacts[key];
        conflicts.add(key);
        continue;
      }
      values[key] = parsed.value;
      rawFacts[key] = parsed;
    }
  }
  if (!CORE_KEYS.every((key) => Number.isFinite(values[key]))) return null;
  return {
    values,
    rawFacts,
    basis,
    sourceTitle: String(metadata.sourceTitle ?? "").slice(0, 180),
    sourceUrl: String(metadata.sourceUrl ?? "").slice(0, 2048),
    extractionMethod: metadata.extractionMethod || (rawContent.toLowerCase().includes("<table") ? "deterministic_html_table" : "deterministic_label_or_table")
  };
}

export function normalizeNutrition(facts, quantity) {
  if (!facts || !facts.values || !facts.basis || !quantity) return null;
  const amount = Number(quantity.value);
  const unit = quantity.unit;
  if (!finiteNonNegative(amount) || amount <= 0 || unit !== facts.basis.unit) return null;
  const factor = amount / facts.basis.amount;
  const values = {};
  for (const [key, value] of Object.entries(facts.values)) {
    if (!finiteNonNegative(Number(value))) return null;
    values[key] = round(Number(value) * factor, 2);
  }
  return { values, basisLabel: facts.basis.label, requestedAmount: { value: amount, unit } };
}

export function parseExplicitQuantity(text) {
  const match = String(text ?? "").match(/(?:^|\b)(\d+(?:\.\d+)?)\s*(kg|g|grams?|ml|l|lit(?:er|re)s?)\b/i);
  if (!match) return null;
  let value = Number(match[1]);
  const raw = match[2].toLowerCase();
  const unit = raw === "kg" ? "g" : raw === "l" || raw.startsWith("lit") ? "ml" : raw === "g" || raw.startsWith("gram") ? "g" : "ml";
  if (raw === "kg" || raw === "l" || raw.startsWith("lit")) value *= 1000;
  return finiteNonNegative(value) && value > 0 ? { value, unit } : null;
}

export function calculateRecipe(ingredients, servings = 1) {
  if (!Array.isArray(ingredients) || ingredients.length === 0 || !Number.isFinite(servings) || servings <= 0) return null;
  const totals = { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const contributions = [];
  for (const ingredient of ingredients) {
    const amount = Number(ingredient?.amount);
    const unit = ingredient?.unit;
    const facts = ingredient?.facts;
    if (!finiteNonNegative(amount) || amount <= 0 || !facts?.values || !facts?.basis || unit !== facts.basis.unit) return null;
    for (const key of CORE_KEYS) {
      if (!finiteNonNegative(Number(facts.values[key]))) return null;
      totals[key] += Number(facts.values[key]) * amount / facts.basis.amount;
    }
    contributions.push({ name: String(ingredient.name ?? "").slice(0, 100), amount, unit, source: String(facts.sourceTitle ?? "") });
  }
  const total = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value, 2)]));
  const perServing = Object.fromEntries(Object.entries(total).map(([key, value]) => [key, round(value / servings, 2)]));
  return { total, perServing, servings, contributions, method: "deterministic_ingredient_sum" };
}

export function scoreNutritionEvidence(input = {}) {
  const source = String(input.sourceType ?? "unknown");
  const match = String(input.matchType ?? "none");
  const extraction = String(input.extractionMethod ?? "ai");
  const coreComplete = CORE_KEYS.every((key) => finiteNonNegative(Number(input.values?.[key])));
  const hasBasis = Boolean(input.basis?.amount > 0 && ["g", "ml"].includes(input.basis?.unit));
  const conflict = input.conflict === true;
  const assumedQuantity = input.assumedQuantity === true;
  let score = 0;
  score += source === "usda" ? 35 : source === "open_food_facts" ? 32 : source === "approved_catalog" ? 35 : source === "reviewed_web" ? 18 : 0;
  score += match === "barcode" ? 25 : match === "exact" ? 22 : match === "alias" ? 15 : 0;
  score += extraction === "structured_api" ? 20 : extraction === "deterministic_label_or_table" ? 16 : extraction === "ai_structured" ? 4 : 0;
  score += coreComplete ? 10 : 0;
  score += hasBasis ? 10 : 0;
  if (conflict) score = Math.min(score, 35);
  if (assumedQuantity || !hasBasis || !coreComplete) score = Math.min(score, 55);
  const status = conflict || !coreComplete || !hasBasis || assumedQuantity
    ? "Needs review"
    : score >= 85 ? "Strong source match" : score >= 65 ? "Good source match" : "Needs review";
  return { score, status, reasons: [
    !coreComplete ? "One or more core nutrition values are missing." : null,
    !hasBasis ? "Serving basis is missing or unsupported." : null,
    conflict ? "Sources contain conflicting values." : null,
    assumedQuantity ? "The requested quantity was assumed." : null
  ].filter(Boolean) };
}

export function matchCatalogCandidate(item, records) {
  if (!Array.isArray(records)) return null;
  const barcode = String(item?.barcode ?? "").trim();
  const brand = normalizeFoodName(item?.brand);
  const wanted = normalizeFoodName(item?.product_name || item?.name);
  const matches = records.filter((record) => {
    if (record?.is_approved !== true) return false;
    if (barcode && String(record.barcode ?? "") === barcode) return true;
    const recordBrand = normalizeFoodName(record.brand);
    if (brand && recordBrand !== brand) return false;
    const names = [record.canonical_name, ...(Array.isArray(record.aliases) ? record.aliases : [])].map(normalizeFoodName);
    return names.includes(wanted);
  });
  return matches.length === 1 ? matches[0] : null;
}


export function aggregateIngredientEstimates(ingredients, servings = 1) {
  if (!Array.isArray(ingredients) || ingredients.length < 2 || ingredients.length > 8 ||
      !Number.isInteger(servings) || servings < 1 || servings > 50) return null;
  const totals = { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const contributions = [];
  for (const ingredient of ingredients) {
    const name = String(ingredient?.name ?? "").trim();
    const amount = Number(ingredient?.amount);
    const unit = ingredient?.unit;
    const values = ingredient?.values;
    if (!name || name.length > 100 || !finiteNonNegative(amount) || amount <= 0 ||
        !["g", "ml"].includes(unit) || !values) return null;
    for (const key of CORE_KEYS) {
      const value = Number(values[key]);
      if (!finiteNonNegative(value) || value > (key === "calories_kcal" ? 10000 : 1000)) return null;
      totals[key] += value;
    }
    contributions.push({ name, amount, unit, source: String(ingredient.source ?? "").slice(0,180),
      sourceUrl: String(ingredient.sourceUrl ?? "").slice(0,2048) });
  }
  const total = Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,round(value,2)]));
  const perServing = Object.fromEntries(Object.entries(total).map(([key,value])=>[key,round(value/servings,2)]));
  return { total, perServing, servings, contributions, method:"estimated_ingredient_sum" };
}
