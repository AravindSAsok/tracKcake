const MODIFIER_STOP_WORDS = new Set([
  "with", "and", "the", "for", "from", "one", "small", "large", "medium", "fresh",
  "without", "sugar", "sugared", "unsweetened", "sweetened", "no", "added", "less",
  "low", "fat", "skimmed", "whole", "hot", "cold", "iced", "homemade", "plain"
]);

export function normalizeNutritionSearchInput(value: string): { original: string; food: string; constraints: string[] } {
  const original = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 180);
  const lower = original.toLowerCase();
  const constraints: string[] = [];
  if (/\b(without|no|zero|unsweetened|sugar free|sugar-free)\b.{0,18}\bsugar\b|\bunsweetened\b/.test(lower)) {
    constraints.push("no added sugar");
  }
  if (/\b(low[- ]fat|skimmed|skim milk)\b/.test(lower)) constraints.push("low-fat or skimmed milk");
  if (/\b(whole milk|full[- ]fat milk)\b/.test(lower)) constraints.push("whole milk");
  if (/\b(iced|cold)\b/.test(lower)) constraints.push("iced or cold preparation");
  const food = original
    .replace(/\b(?:without|no|zero|unsweetened|sugar[- ]free|low[- ]fat|skimmed|whole|full[- ]fat|iced|cold|hot|homemade|plain|added)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  return { original, food: food || original, constraints };
}

export function buildNutritionSearchQueries(
  original: string,
  canonicalFood: string,
  aiQueries: string[] = [],
  constraints: string[] = []
): string[] {
  const clean = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
  const queries = [
    clean(original) + " nutrition facts calories protein carbohydrates fat",
    clean(canonicalFood) + " nutrition facts per 100 g OR per 100 ml",
    clean(canonicalFood) + (constraints.length ? " " + clean(constraints.join(" ")) : "") + " calories nutrition information",
    ...aiQueries.slice(0, 2).map(clean)
  ];
  return [...new Set(queries.filter((query) => query.length >= 12))].slice(0, 4);
}

export function isRelevantNutritionEvidence(food: string, title: string, markdown: string): boolean {
  const ignored = new Set([...MODIFIER_STOP_WORDS, "nutrition", "facts", "calories", "calorie", "protein", "carbohydrates", "carbs"]);
  const tokens = food.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ")
    .split(" ").filter((token) => token.length > 2 && !ignored.has(token));
  const haystack = (title + " " + markdown).toLowerCase();
  if (tokens.length && !tokens.some((token) => haystack.includes(token))) return false;
  const metrics = [
    /calor(?:ie|ies)|energy|kcal/i,
    /protein/i,
    /carbohydrate|\bcarbs?\b/i,
    /total fat|\bfat\b/i
  ];
  const metricCount = metrics.filter((pattern) => pattern.test(markdown)).length;
  return metricCount >= 2 && /\d+(?:\.\d+)?\s*(?:kcal|calories|g|grams|mg|kj)\b/i.test(markdown);
}
