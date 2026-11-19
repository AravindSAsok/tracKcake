#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const base = (process.env.TRACKCAKE_URL || "https://trackcake.vercel.app").replace(/\/$/, "");
const query = "apple";
const DAILY_FREE_REQUEST_CAP = 50;
const rows = [];
const startedAt = new Date().toISOString();
const runId = process.env.GITHUB_RUN_ID || `local-${startedAt.replace(/[:.]/g, "-")}`;
let catalogueCheckedAt = "unknown";
let discoveredCount = 0;

const esc = (value) => String(value ?? "").replace(/\|/g, "\\\\|").replace(/[\r\n]+/g, " ").trim();

async function saveReport(status = "RUNNING") {
  const successful = rows.filter((row) => row.status === "success").length;
  const failed = rows.filter((row) => row.status !== "success" && row.status !== "skipped_daily_limit").length;
  const skipped = rows.filter((row) => row.status === "skipped_daily_limit").length;
  const table = rows.map((row) => [
    row.model, row.status, row.ms ?? "—", row.response ?? "—", row.error ?? ""
  ].map(esc));
  const body = table.map((cells) => `| ${cells.join(" | ")} |`).join("\n");
  const md = [
    "# OpenRouter Free Model Smoke Test",
    "",
    `- Run ID: \`${runId}\``,
    `- Prompt: \`${query}\``,
    `- Target: ${base}`,
    `- Started: ${startedAt}`,
    `- Updated: ${new Date().toISOString()}`,
    `- Status: ${status}`,
    `- Catalogue checked: ${catalogueCheckedAt}`,
    `- Discovered free text models: ${discoveredCount}`,
    `- Tested: ${rows.length - skipped}; passed: ${successful}; failed: ${failed}; skipped by daily cap: ${skipped}`,
    "- Scope: OpenRouter only; only model IDs ending in :free; one request per model; no retries; strict single-model mode prevents fallback to Groq/Gemini/another OpenRouter model.",
    "- Pass criteria: TrackCake receives a complete non-empty SSE complete event containing at least one returned item. HTTP 200 alone is not a pass.",
    "- Limit: at most 50 requests in this run to respect the no-credit free-model daily allowance. OpenRouter may count failed requests toward that allowance.",
    "",
    "## Results",
    "",
    "| Model ID | Status | Latency (ms) | Response | Error |",
    "|---|---:|---:|---|---|",
    body || "| — | pending | — | No model requests run | — |",
    ""
  ].join("\n");
  await writeFile("benchmark.md", md, "utf8");
}

function parseSse(raw) {
  const events = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    let event = "message";
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length) {
      try { events.push({ event, data: JSON.parse(data.join("\n")) }); }
      catch { events.push({ event, data: { error: "Invalid SSE JSON payload" } }); }
    }
  }
  return events;
}

const statusResponse = await fetch(`${base}/api/provider-status?includeAllOpenRouterFree=true`, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(30000)
});
const status = await statusResponse.json().catch(() => ({}));
if (!statusResponse.ok) throw new Error(`Provider discovery failed: HTTP ${statusResponse.status}`);
catalogueCheckedAt = status.checkedAt || new Date().toISOString();
const openrouter = status.providers?.find((entry) => entry.provider === "openrouter");
if (!openrouter?.configured || !openrouter.ok) {
  throw new Error(`OpenRouter catalogue unavailable: ${openrouter?.message || openrouter?.status || "not configured"}`);
}

const models = [...new Set((openrouter.models || [])
  .map((model) => model.id)
  .filter((id) => typeof id === "string" && id.endsWith(":free")))];
discoveredCount = models.length;
if (!models.length) throw new Error("No OpenRouter :free text models were returned by the live catalogue.");

const toTest = models.slice(0, DAILY_FREE_REQUEST_CAP);
for (const model of models.slice(DAILY_FREE_REQUEST_CAP)) {
  rows.push({ model, status: "skipped_daily_limit", response: "Not requested", error: "50-request free daily cap for this run" });
}
await saveReport();
console.log(`Discovered ${models.length} OpenRouter free text models; testing ${toTest.length} with the prompt "${query}".`);

for (let index = 0; index < toTest.length; index += 1) {
  const model = toTest[index];
  const started = performance.now();
  let row;
  try {
    const response = await fetch(`${base}/api/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ description: query, provider: "openrouter", model, strictModel: true }),
      signal: AbortSignal.timeout(75000)
    });
    const raw = await response.text();
    const events = parseSse(raw);
    const complete = events.find((entry) => entry.event === "complete");
    const failure = events.find((entry) => entry.event === "error");
    const ms = Math.round(performance.now() - started);
    if (response.ok && Array.isArray(complete?.data?.items) && complete.data.items.length > 0) {
      const items = complete.data.items;
      row = {
        model, status: "success", ms,
        response: items.map((item) => item.name || "unnamed").join(", ").slice(0, 240),
        error: ""
      };
    } else {
      row = {
        model,
        status: response.status === 429 ? "rate_limited" : "failed",
        ms, response: "No complete result",
        error: String(failure?.data?.detail || failure?.data?.error || `HTTP ${response.status}; no valid complete event`).slice(0, 500)
      };
    }
  } catch (error) {
    row = {
      model, status: "request_error",
      ms: Math.round(performance.now() - started),
      response: "No complete result",
      error: error instanceof Error ? error.message : String(error)
    };
  }
  rows.push(row);
  await saveReport();
  console.log(`[${index + 1}/${toTest.length}] ${model} ${row.status} ${row.ms}ms`);
}

await saveReport("COMPLETE");
const successful = rows.filter((row) => row.status === "success").length;
const tested = rows.length - rows.filter((row) => row.status === "skipped_daily_limit").length;
console.log(`OpenRouter test complete: ${successful}/${tested} passed; ${discoveredCount} free text models discovered.`);
