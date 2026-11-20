import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateIngredientEstimates, calculateRecipe, extractNutritionFacts, matchCatalogCandidate, normalizeNutrition, reconcileNutritionSources,
  parseExplicitQuantity, parseNutritionNumber, parseServingBasis, scoreNutritionEvidence, nutrientForLabel, parseValueAndUnit, isGenericNutritionLookup
} from "../src/lib/nutrition-engine.js";

test("parses exact values, decimal comma and unresolved ranges safely", () => {
  assert.equal(parseNutritionNumber("12.5").value, 12.5);
  assert.equal(parseNutritionNumber("12,5").value, 12.5);
  assert.equal(parseNutritionNumber("10-12").qualifier, "range");
  assert.equal(parseNutritionNumber("about 8").qualifier, "about");
  assert.equal(parseNutritionNumber("12 kcal"), null);
  assert.equal(parseNutritionNumber("1,000"), null);
});

test("recognizes explicit per-100g and serving bases", () => {
  assert.deepEqual(parseServingBasis("Nutrition per 100 g"), { amount: 100, unit: "g", label: "per 100 g" });
  assert.deepEqual(parseServingBasis("Serving size: 30 g"), { amount: 30, unit: "g", label: "per serving (30 g)" });
  assert.equal(parseServingBasis("one bowl"), null);
});

test("extracts a complete deterministic nutrition table", () => {
  const source = [
    "Nutrition facts per 100 g",
    "| Energy | 210 kcal |",
    "| Protein | 4.2 g |",
    "| Carbohydrate | 31 g |",
    "| Total fat | 7.5 g |",
    "| Dietary fiber | 2 g |"
  ].join("\n");
  const facts = extractNutritionFacts(source, { sourceTitle: "Test source", sourceUrl: "https://example.com/nutrition" });
  assert.ok(facts);
  assert.equal(facts.values.calories_kcal, 210);
  assert.equal(facts.values.protein_g, 4.2);
  assert.equal(facts.values.carbs_g, 31);
  assert.equal(facts.values.fat_g, 7.5);
  assert.equal(facts.basis.unit, "g");
});

test("normalizes kJ and sodium units without confusing macros", () => {
  const source = [
    "Per 100 ml",
    "Energy: 418.4 kJ",
    "Protein: 2 g",
    "Carbohydrate: 3 g",
    "Total fat: 4 g",
    "Sodium: 250 mg"
  ].join("\n");
  const facts = extractNutritionFacts(source);
  assert.ok(facts);
  assert.equal(facts.values.calories_kcal, 100);
  assert.equal(facts.values.sodium_mg, 250);
  assert.equal(normalizeNutrition(facts, { value: 250, unit: "ml" }).values.calories_kcal, 250);
  assert.equal(normalizeNutrition(facts, { value: 250, unit: "g" }), null);
});

test("does not guess household units or convert ml to g", () => {
  assert.equal(parseExplicitQuantity("one cup"), null);
  assert.equal(parseExplicitQuantity("1 cup milk"), null);
  const facts = extractNutritionFacts("Per 100 g\nEnergy 100 kcal\nProtein 2 g\nCarbohydrate 3 g\nTotal fat 4 g");
  assert.equal(normalizeNutrition(facts, { value: 200, unit: "ml" }), null);
});

test("recipe calculation requires explicit compatible ingredient amounts", () => {
  const facts = extractNutritionFacts("Per 100 g\nEnergy 100 kcal\nProtein 2 g\nCarbohydrate 3 g\nTotal fat 4 g");
  const result = calculateRecipe([{ name: "Ingredient", amount: 50, unit: "g", facts }], 2);
  assert.equal(result.total.calories_kcal, 50);
  assert.equal(result.perServing.calories_kcal, 25);
  assert.equal(calculateRecipe([{ name: "Unknown", amount: 1, unit: "ml", facts }]), null);
});

test("confidence is capped when basis is missing or sources conflict", () => {
  const complete = { sourceType: "usda", matchType: "exact", extractionMethod: "structured_api",
    values: { calories_kcal: 100, protein_g: 2, carbs_g: 3, fat_g: 4 }, basis: { amount: 100, unit: "g" } };
  assert.equal(scoreNutritionEvidence(complete).status, "Strong source match");
  assert.equal(scoreNutritionEvidence({ ...complete, conflict: true }).status, "Needs review");
  assert.equal(scoreNutritionEvidence({ ...complete, basis: null }).status, "Needs review");
});

test("catalog matching requires an approved exact alias or barcode", () => {
  const records = [{ canonical_name: "Whole milk", aliases: ["full cream milk"], barcode: "123",
    brand: "Brand A", is_approved: true }, { canonical_name: "Milk", aliases: [], is_approved: false }];
  assert.equal(matchCatalogCandidate({ name: "full cream milk" }, records).canonical_name, "Whole milk");
  assert.equal(matchCatalogCandidate({ barcode: "123" }, records).canonical_name, "Whole milk");
  assert.equal(matchCatalogCandidate({ name: "milk" }, records), null);
});

test("extracts labelled text rows and rejects ambiguous duplicate values", () => {
  const textRows = [
    "Nutrition facts per 100 g",
    "Energy: 210 kcal",
    "Protein: 4,2 g",
    "Carbohydrate: 31 g",
    "Total fat: 7.5 g"
  ].join("\n");
  const facts = extractNutritionFacts(textRows);
  assert.ok(facts);
  assert.equal(facts.values.protein_g, 4.2);

  const conflicting = [
    "Nutrition facts per 100 g",
    "Energy: 210 kcal",
    "Energy: 240 kcal",
    "Protein: 4 g",
    "Carbohydrate: 31 g",
    "Total fat: 7 g"
  ].join("\n");
  assert.equal(extractNutritionFacts(conflicting), null);
});

test("rejects a row with multiple serving-column values", () => {
  const table = [
    "Nutrition per 100 g",
    "| Energy | 210 kcal | 105 kcal |",
    "| Protein | 4 g | 2 g |",
    "| Carbohydrate | 31 g | 15.5 g |",
    "| Total fat | 7 g | 3.5 g |"
  ].join("\n");
  assert.equal(extractNutritionFacts(table), null);
});

test("parses individual labelled nutrient rows", () => {
  assert.equal(nutrientForLabel("Energy"), "calories_kcal");
  assert.equal(nutrientForLabel("Protein"), "protein_g");
  assert.equal(nutrientForLabel("Carbohydrate"), "carbs_g");
  assert.equal(nutrientForLabel("Total fat"), "fat_g");
  assert.equal(parseValueAndUnit("210 kcal", "calories_kcal").value, 210);
  assert.equal(parseValueAndUnit("4,2 g", "protein_g").value, 4.2);
  assert.equal(parseValueAndUnit("31 g", "carbs_g").value, 31);
  assert.equal(parseValueAndUnit("7.5 g", "fat_g").value, 7.5);
});


test("aggregates explicitly estimated ingredients into a per-serving recipe", () => {
  const result = aggregateIngredientEstimates([
    { name:"Rice", amount:100, unit:"g", values:{calories_kcal:130,protein_g:2.7,carbs_g:28,fat_g:0.3}, source:"USDA" },
    { name:"Lentils", amount:80, unit:"g", values:{calories_kcal:92,protein_g:7.2,carbs_g:16,fat_g:0.4}, source:"Open Food Facts" }
  ],2);
  assert.ok(result);
  assert.equal(result.total.calories_kcal,222);
  assert.equal(result.perServing.calories_kcal,111);
  assert.equal(result.perServing.protein_g,4.95);
  assert.equal(result.contributions.length,2);
  assert.equal(result.method,"estimated_ingredient_sum");
});

test("rejects incomplete or unsupported ingredient estimate inputs", () => {
  const ingredient={name:"Rice",amount:100,unit:"g",values:{calories_kcal:130,protein_g:2,carbs_g:28,fat_g:0.3}};
  assert.equal(aggregateIngredientEstimates([ingredient,{...ingredient,name:"Dal",amount:0}],2),null);
  assert.equal(aggregateIngredientEstimates([ingredient,{...ingredient,name:"Dal",unit:"cup"}],2),null);
  assert.equal(aggregateIngredientEstimates([ingredient,{...ingredient,name:"Dal"}],0),null);
  assert.equal(aggregateIngredientEstimates([ingredient],1),null);
});


test("extracts structured nutrition from Schema.org JSON-LD", () => {
  const html = [
    '<script type="application/ld+json">',
    '{"@context":"https://schema.org","@type":"Recipe","name":"Test meal","nutrition":{"@type":"NutritionInformation","servingSize":"100 g","calories":"210 kcal","proteinContent":"4.2 g","carbohydrateContent":"31 g","fatContent":"7.5 g"}}',
    '</script>'
  ].join("\n");
  const facts = extractNutritionFacts(html,{sourceTitle:"JSON-LD fixture"});
  assert.ok(facts);
  assert.equal(facts.values.calories_kcal,210);
  assert.equal(facts.values.protein_g,4.2);
  assert.equal(facts.values.carbs_g,31);
  assert.equal(facts.values.fat_g,7.5);
  assert.equal(facts.basis.amount,100);
  assert.equal(facts.extractionMethod,"deterministic_json_ld");
});

test("extracts labelled nutrition rows from HTML tables", () => {
  const html = [
    "<h3>Nutrition facts per 100 g</h3><table>",
    "<tr><th>Energy</th><td>210 kcal</td></tr>",
    "<tr><th>Protein</th><td>4.2 g</td></tr>",
    "<tr><th>Carbohydrate</th><td>31 g</td></tr>",
    "<tr><th>Total fat</th><td>7.5 g</td></tr>",
    "</table><p>Article published in 2024 and reviewed by 3 editors.</p>"
  ].join("");
  const facts=extractNutritionFacts(html);
  assert.ok(facts);
  assert.equal(facts.values.calories_kcal,210);
  assert.equal(facts.values.protein_g,4.2);
  assert.equal(facts.values.carbs_g,31);
  assert.equal(facts.values.fat_g,7.5);
  assert.equal(facts.extractionMethod,"deterministic_html_table");
});

test("rejects incomplete or conflicting JSON-LD nutrition candidates", () => {
  const incomplete='<script type="application/ld+json">{"nutrition":{"servingSize":"100 g","calories":"100 kcal","proteinContent":"2 g","carbohydrateContent":"3 g"}}</script>';
  assert.equal(extractNutritionFacts(incomplete),null);
  const conflicting='<script type="application/ld+json">[{"nutrition":{"servingSize":"100 g","calories":"100 kcal","proteinContent":"2 g","carbohydrateContent":"3 g","fatContent":"4 g"}},{"nutrition":{"servingSize":"100 g","calories":"200 kcal","proteinContent":"2 g","carbohydrateContent":"3 g","fatContent":"4 g"}}]</script>';
  assert.equal(extractNutritionFacts(conflicting),null);
});

test("reconciles matching sources without averaging and flags material conflicts", () => {
  const first = { calories: 200, protein_g: 5, carbs_g: 30, fat_g: 4, nutrition_source: "USDA",
    nutrition_basis: "Per 100 g", nutrition_status: "Strong source match", nutrition_confidence: 90 };
  const close = { calories: 203, protein_g: 5.2, carbs_g: 30.5, fat_g: 4.1, nutrition_source: "Open Food Facts",
    nutrition_basis: "Per 100 g", nutrition_status: "Good source match", nutrition_confidence: 80 };
  const agreed = reconcileNutritionSources(first, close);
  assert.equal(agreed.conflict, false);
  assert.equal(agreed.item.calories, 200, "primary values are retained; sources are never averaged");
  assert.match(agreed.item.nutrition_source, /Open Food Facts/);
  const conflicting = reconcileNutritionSources(first, { ...close, calories: 260, nutrition_basis: "Per 100 g" });
  assert.equal(conflicting.conflict, true);
  assert.equal(conflicting.item.nutrition_status, "Needs review");
  assert.equal(conflicting.item.nutrition_confidence, 0);
  assert.match(conflicting.item.nutrition_conflict, /calories differs/);
  const incompatible = reconcileNutritionSources(first, { ...close, nutrition_basis: "Per 100 ml" });
  assert.equal(incompatible.conflict, true);
  assert.match(incompatible.item.nutrition_conflict, /incompatible serving units/);
});


test("USDA generic lookup is not used to fill branded or named products", () => {
  assert.equal(isGenericNutritionLookup({ name: "apple" }), true);
  assert.equal(isGenericNutritionLookup({ name: "apple", brand: "Example" }), false);
  assert.equal(isGenericNutritionLookup({ name: "apple", product_name: "Example Apple Juice" }), false);
  assert.equal(isGenericNutritionLookup({ name: "apple", brand: " ", product_name: "" }), true);
});
