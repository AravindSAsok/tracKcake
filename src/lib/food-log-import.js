const MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const MAX_ENTRIES = 100;
const MAX_AMOUNT = 10000;
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function validDate(value) {
  if (typeof value !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function validTime(value) { return typeof value === "string" && /^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(value); }
export function parseTrackCakeFoodLog(input) {
  const source = String(input ?? "").trim();
  if (!source || !(source.startsWith("{") || source.startsWith("["))) return null;
  let parsed;
  try { parsed = JSON.parse(source); }
  catch { throw new Error("This looks like JSON, but it is not valid JSON. Please check the brackets and commas."); }
  if (!isRecord(parsed) || parsed.trackcake_import !== "food-log-v1") {
    throw new Error('JSON detected, but it is not a supported TrackCake food log. Include "trackcake_import": "food-log-v1".');
  }
  if (!validDate(parsed.date)) throw new Error("TrackCake JSON needs a real date in YYYY-MM-DD format.");
  if (!Array.isArray(parsed.entries) || parsed.entries.length < 1 || parsed.entries.length > MAX_ENTRIES) {
    throw new Error("TrackCake JSON must contain between 1 and 100 food entries.");
  }
  const entries = parsed.entries.map((entry, index) => {
    const label = `Entry ${index + 1}`;
    if (!isRecord(entry)) throw new Error(`${label} must be an object.`);
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const amount = typeof entry.amount === "string" ? entry.amount.trim() : "";
    if (!name || name.length > 90) throw new Error(`${label}: name is required (maximum 90 characters).`);
    if (!amount || amount.length > 90) throw new Error(`${label}: amount is required (maximum 90 characters).`);
    if (!MEALS.has(entry.meal_type)) throw new Error(`${label}: meal_type must be breakfast, lunch, dinner, or snack.`);
    if (entry.time !== undefined && !validTime(entry.time)) throw new Error(`${label}: time must use 24-hour HH:mm format.`);
    const nutrition = {};
    for (const field of ["calories", "protein_g", "carbs_g", "fat_g"]) {
      const value = entry[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
        throw new Error(`${label}: ${field} must be a number between 0 and ${MAX_AMOUNT}.`);
      }
      nutrition[field] = value;
    }
    if (nutrition.calories <= 0) throw new Error(`${label}: calories must be greater than zero.`);
    return { name, amount, ...nutrition, meal_type: entry.meal_type, time: entry.time ?? "12:00" };
  });
  return { date: parsed.date, entries };
}
