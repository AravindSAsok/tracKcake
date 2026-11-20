export interface ValidatedAiNutritionItem {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
  brand?: string;
  product_name?: string;
  ingredients: string[];
  nutrition_source: string;
  nutrition_status: string;
  nutrition_confidence: number;
  nutrition_method: string;
  nutrition_uncertainty: Record<string, string>;
  nutrition_basis?: string;
  nutrition_source_url?: string;
  nutrition_schema_version: "nutrition-v2";
}
export function validateAiNutritionItem(
  raw: unknown,
  options?: { researchOnly?: boolean; allowedSourceUrls?: Set<string> }
): ValidatedAiNutritionItem;
