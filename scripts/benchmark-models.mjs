#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const base = (process.env.TRACKCAKE_URL || "https://trackcake.vercel.app").replace(/\/$/, "");
const query = "milk coffee";
const providers = ["groq", "gemini", "openrouter"];
const rows = [];
const startedAt = new Date().toISOString();
let catalogueCheckedAt = "unknown";
let expectedCount = 0;

const esc = (value) => String(value ?? "").replace(/\|/g, "\\\\|").replace(/[\r\n]+/g, " ").trim();
const summarize = (items) => {
  if (!Array.isArray(items) || !items.length) return "No food items returned";
  return items.map((item) => [
    item.name,
    item.amount,
    `${item.calories} kcal`,
    `P ${item.protein_g}g / C ${item.carbs_g}g / F ${item.fat_g}g`
  ].join("; ")).join(" | ");
};

async function save(status = "RUNNING") {
  const successful = rows.filter((row) => row.status === "success").length;
  const failed = rows.length - successful;
  const table = rows.map((row) => [
    row.provider, row.model, row.status, row.ms ?? "—",
    row.totalCalories ?? "—", row.result ?? "—", row.error ?? ""
  ].map(esc));
  const body = table.map((cells) => `| ${cells.join(" | ")} |`).join("\n");
  const md = [
    "# TrackCake AI Model Benchmark",
    "",
    `- Query: \`${query}\``,
    `- Target: ${base}`,
    `- Started: ${startedAt}`,
    `- Updated: ${new Date().toISOString()}`,
    `- Status: ${status}`,
    `- Catalogue checked: ${catalogueCheckedAt}`,
    `- Progress: ${rows.length}/${expectedCount} model entries; ${successful} successful; ${failed} failed/unavailable`,
    "- Protocol: exactly one POST to /api/estimate per distinct provider/model pair; sequential; no retries; no automatic provider fallback when a specific model is selected.",
    "- Latency is end-to-end TrackCake latency and includes nutrition research after model generation; it is not raw model-only latency.",
    "- Result fields preserve returned food names, portions, calories and macros. Accuracy still requires comparison with a consistent nutrition reference.",
    "- This single query is a smoke/quality comparison, not a universal model ranking.",
    "",
    "## Results",
    "",
    "| Provider | Model ID | Status | Latency (ms) | Total kcal | Returned items | Error / notes |",
    "|---|---|---:|---:|---:|---|---|",
    body || "| — | — | pending | — | — | No requests run | — |",
    "",
    "## Review notes",
    "",
    "Review whether the model correctly interprets 'milk coffee', chooses a plausible serving size, and returns plausible calories/macros. Compare like-for-like portions before ranking. A fast but nutritionally implausible response should not win.",
    ""
  ].join("\n");
  await writeFile("benchmark.md", md, "utf8");
}

const statusResponse = await fetch(`${base}/api/provider-status`, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(20000)
});
const status = await statusResponse.json();
if (!statusResponse.ok) throw new Error(`Provider discovery failed: HTTP ${statusResponse.status}`);
catalogueCheckedAt = status.checkedAt || new Date().toISOString();

const models = [];
const seen = new Set();
for (const provider of providers) {
  const entry = status.providers?.find((item) => item.provider === provider);
  if (!entry?.configured || !entry.ok) {
    rows.push({
      provider, model: "(catalogue)", status: "provider_unavailable",
      result: "No model requests sent", error: entry?.message || entry?.status || "Provider not configured"
    });
    continue;
  }
  for (const model of entry.models || []) {
    if (!model.id) continue;
    const key = `${provider}::${model.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    models.push({ provider, model: model.id });
  }
}
expectedCount = models.length + rows.length;
await save();
console.log(`Discovered ${models.length} distinct models across configured providers. Query: "${query}".`);

for (let index = 0; index < models.length; index += 1) {
  const { provider, model } = models[index];
  const started = performance.now();
  let row;
  try {
    const response = await fetch(`${base}/api/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ description: query, provider, model }),
      signal: AbortSignal.timeout(75000)
    });
    const data = await response.json().catch(() => ({}));
    const ms = Math.round(performance.now() - started);
    if (response.ok) {
      row = {
        provider, model, status: "success", ms,
        totalCalories: data.total_calories ?? "—",
        result: summarize(data.items),
        error: ""
      };
    } else {
      row = {
        provider, model,
        status: response.status === 429 ? "rate_limited" : "error",
        ms, result: "—",
        error: data.detail || data.error || `HTTP ${response.status}`
      };
    }
  } catch (error) {
    row = {
      provider, model, status: "request_error",
      ms: Math.round(performance.now() - started), result: "—",
      error: error instanceof Error ? error.message : String(error)
    };
  }
  rows.push(row);
  await save();
  console.log(`[${index + 1}/${models.length}] ${provider}/${model} ${row.status} ${row.ms}ms`);
}

await save("COMPLETE");
const successCount = rows.filter((row) => row.status === "success").length;
console.log(`Benchmark complete: ${rows.length} entries, ${successCount} successful, ${rows.length - successCount} failed/unavailable.`);
