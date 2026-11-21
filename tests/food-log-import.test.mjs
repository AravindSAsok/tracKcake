import test from "node:test";
import assert from "node:assert/strict";
import { parseTrackCakeFoodLog } from "../src/lib/food-log-import.js";

const valid = {
  trackcake_import: "food-log-v1",
  date: "2026-11-21",
  entries: [{
    name: "Cooked rice", amount: "250 g", calories: 325,
    protein_g: 6, carbs_g: 71, fat_g: 1, meal_type: "lunch", time: "13:15"
  }]
};

test("leaves ordinary food descriptions for the AI estimator", () => {
  assert.equal(parseTrackCakeFoodLog("2 idlis and sambar"), null);
});

test("parses a valid TrackCake food log", () => {
  assert.deepEqual(parseTrackCakeFoodLog(JSON.stringify(valid)), {
    date: "2026-11-21",
    entries: [{ ...valid.entries[0] }]
  });
});

test("rejects JSON without the TrackCake import marker", () => {
  assert.throws(() => parseTrackCakeFoodLog('{"hello":"world"}'), /not a supported TrackCake food log/);
});

test("rejects invalid JSON instead of sending it to AI", () => {
  assert.throws(() => parseTrackCakeFoodLog('{"trackcake_import":'), /not valid JSON/);
});

test("rejects impossible dates and invalid meal types", () => {
  assert.throws(() => parseTrackCakeFoodLog(JSON.stringify({ ...valid, date: "2026-02-30" })), /real date/);
  assert.throws(() => parseTrackCakeFoodLog(JSON.stringify({ ...valid, entries: [{ ...valid.entries[0], meal_type: "brunch" }] })), /meal_type/);
});

test("rejects missing or non-numeric nutrition before any import", () => {
  assert.throws(() => parseTrackCakeFoodLog(JSON.stringify({ ...valid, entries: [{ ...valid.entries[0], calories: "325" }] })), /calories must be a number/);
});
