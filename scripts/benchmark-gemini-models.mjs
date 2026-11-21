#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const base = (process.env.TRACKCAKE_URL || "https://trackcake.vercel.app").replace(/\/$/, "");
const query = "apple";
const rows = [];
const startedAt = new Date().toISOString();
const runId = process.env.GITHUB_RUN_ID || "local-" + startedAt.replace(/[:.]/g, "-");
const esc = (value) => String(value ?? "").replace(/\|/g, "\\\\|").replace(/[\r\n]+/g, " ").trim();

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

async function saveReport(status = "RUNNING", models = []) {
  const passed = rows.filter((row) => row.status === "success").length;
  const failed = rows.filter((row) => row.status !== "success").length;
  const lines = [
    "# TrackCake Gemini Model Smoke Test",
    "",
    "- Run ID: " + runId,
    "- Started: " + startedAt,
    "- Updated: " + new Date().toISOString(),
    "- Target: " + base,
    "- Status: " + status,
    "- Gemini candidates discovered in TrackCake: " + models.length,
    "- Tested: " + rows.length + "; passed: " + passed + "; failed: " + failed,
    "- Scope: one strict /api/estimate request per model for apple; strict mode disables provider/model fallback. A pass requires a complete non-empty validated nutrition item, not merely HTTP 200.",
    "",
    "| Model ID | Status | Latency (ms) | Food returned | Error |",
    "|---|---|---:|---|---|",
    ...rows.map((row) => "|" + [row.model,row.status,row.ms ?? "—",row.food ?? "—",row.error ?? ""].map(esc).join("|") + "|"),
    ""
  ];
  await writeFile("gemini-benchmark.md", lines.join("\n"), "utf8");
}

const statusResponse = await fetch(base + "/api/provider-status", {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(30000)
});
const status = await statusResponse.json().catch(() => ({}));
if (!statusResponse.ok) throw new Error("Provider discovery failed: HTTP " + statusResponse.status);
const gemini = status.providers?.find((entry) => entry.provider === "gemini");
if (!gemini?.configured || !gemini.ok) {
  throw new Error("Gemini catalogue unavailable: " + (gemini?.message || gemini?.status || "not configured"));
}
const models = [...new Set((gemini.models || []).map((model) => model.id).filter((id) => typeof id === "string"))];
if (!models.length) throw new Error("No approved Gemini text models are currently available in the live provider catalogue.");
console.log("Discovered " + models.length + " Gemini candidates; testing prompt: " + query);
await saveReport("RUNNING", models);

for (const model of models) {
  const started = performance.now();
  let row;
  try {
    const response = await fetch(base + "/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ description: query, provider: "gemini", model, strictModel: true }),
      signal: AbortSignal.timeout(90000)
    });
    const events = parseSse(await response.text());
    const complete = events.find((entry) => entry.event === "complete");
    const failure = events.find((entry) => entry.event === "error");
    const item = complete?.data?.items?.[0];
    const ms = Math.round(performance.now() - started);
    if (response.ok && item && typeof item.name === "string" && Number.isFinite(item.calories)) {
      row = { model, status: "success", ms, food: item.name, error: "" };
    } else {
      row = {
        model,
        status: response.status === 429 ? "rate_limited" : "failed",
        ms,
        food: "—",
        error: String(failure?.data?.detail || failure?.data?.error || ("HTTP " + response.status + "; no valid complete event")).slice(0, 500)
      };
    }
  } catch (error) {
    row = {
      model, status: "request_error",
      ms: Math.round(performance.now() - started),
      food: "—",
      error: (error instanceof Error ? error.message : String(error)).slice(0, 500)
    };
  }
  rows.push(row);
  await saveReport("RUNNING", models);
  console.log(model + ": " + row.status + " (" + row.ms + "ms)");
}
await saveReport("COMPLETE", models);
console.log("Gemini benchmark complete: " + rows.filter((row) => row.status === "success").length + "/" + rows.length + " passed.");
