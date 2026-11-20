export type NutritionUnit = "g" | "ml";
export type NutritionBasis = { amount: number; unit: NutritionUnit; label: string };
export type NutritionFacts = {
  values: Record<string, number>;
  rawFacts?: Record<string, { value: number; raw: string; rawUnit: string; unit: string; qualifier: string }>;
  basis: NutritionBasis;
  sourceTitle?: string;
  sourceUrl?: string;
  extractionMethod?: string;
};
export function normalizeFoodName(value: unknown): string;
export function parseNutritionNumber(input: unknown): { value: number | null; qualifier: string; min: number; max: number } | null;
export function parseServingBasis(text: string): NutritionBasis | null;
export function extractNutritionFacts(markdown: string, metadata?: { sourceTitle?: string; sourceUrl?: string }): NutritionFacts | null;
export function normalizeNutrition(facts: NutritionFacts, quantity: { value: number; unit: NutritionUnit }): { values: Record<string, number>; basisLabel: string; requestedAmount: { value: number; unit: NutritionUnit } } | null;
export function parseExplicitQuantity(text: string): { value: number; unit: NutritionUnit } | null;
export function calculateRecipe(ingredients: Array<{ name: string; amount: number; unit: NutritionUnit; facts: NutritionFacts }>, servings?: number): { total: Record<string, number>; perServing: Record<string, number>; servings: number; contributions: Array<{ name: string; amount: number; unit: NutritionUnit; source: string }>; method: string } | null;
export function scoreNutritionEvidence(input?: Record<string, any>): { score: number; status: string; reasons: string[] };
export function matchCatalogCandidate(item: object, records: object[]): Record<string, any> | null;

export function nutrientForLabel(label: string): string | null;
export function parseValueAndUnit(valueText: string, key: string): { value: number; raw: string; rawUnit: string; unit: string; qualifier: string } | null;

export function aggregateIngredientEstimates(ingredients: Array<{
  name: string; amount: number; unit: NutritionUnit; values: Record<string, number>;
  source?: string; sourceUrl?: string;
}>, servings?: number): {
  total: Record<string, number>; perServing: Record<string, number>; servings: number;
  contributions: Array<{ name: string; amount: number; unit: NutritionUnit; source: string; sourceUrl: string }>;
  method: string;
} | null;

export function reconcileNutritionSources(primary: Record<string, any> | null, secondary: Record<string, any> | null): {
  item: Record<string, any>; conflict: boolean; reasons: string[];
} | null;
export function isGenericNutritionLookup(item: { brand?: string; product_name?: string }): boolean;
