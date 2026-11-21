import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNutritionSearchQueries,
  isRelevantNutritionEvidence,
  normalizeNutritionSearchInput
} from "../src/lib/web-research-query.ts";

test("normalizes milk coffee without sugar while preserving the no-added-sugar constraint", () => {
  const result = normalizeNutritionSearchInput("milk coffee without sugar");
  assert.equal(result.food, "milk coffee");
  assert.deepEqual(result.constraints, ["no added sugar"]);
});

test("generates multiple queries and includes the AI-refined query", () => {
  const input = normalizeNutritionSearchInput("milk coffee without sugar");
  const queries = buildNutritionSearchQueries(
    input.original,
    input.food,
    ["unsweetened coffee with milk nutrition facts"],
    input.constraints
  );
  assert.ok(queries.length >= 3);
  assert.ok(queries.some((query) => query.includes("milk coffee without sugar")));
  assert.ok(queries.some((query) => query.includes("no added sugar")));
  assert.ok(queries.some((query) => query.includes("unsweetened coffee with milk")));
});

test("does not require every preparation modifier to appear on a nutrition page", () => {
  const page = [
    "Coffee with milk - Nutrition information",
    "Serving size: 100 ml",
    "Energy: 32 kcal",
    "Protein: 1.7 g",
    "Carbohydrates: 2.4 g",
    "Total fat: 1.6 g"
  ].join("\n");
  assert.equal(isRelevantNutritionEvidence("milk coffee", "Coffee with milk", page), true);
});

test("rejects unrelated pages and pages without nutrition metrics", () => {
  assert.equal(isRelevantNutritionEvidence("milk coffee", "Chocolate cake", "Energy 300 kcal protein 4 g"), false);
  assert.equal(isRelevantNutritionEvidence("milk coffee", "Milk coffee recipe", "A warm drink made with milk and coffee."), false);
});
