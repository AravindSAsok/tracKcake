import test from "node:test";
import assert from "node:assert/strict";
import { POST as estimatePost } from "../src/pages/api/estimate.ts";

function call(body, headers = {}) {
  return estimatePost({
    request: new Request("https://trackcake.test/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body)
    })
  });
}

test("estimate API rejects empty descriptions and unsupported providers", async () => {
  const empty = await call({ description: " " });
  assert.equal(empty.status, 400);
  const provider = await call({ description: "100 g apple", provider: "unknown" });
  assert.equal(provider.status, 400);
});

test("estimate API rejects research-only requests without selected source URLs", async () => {
  const response = await call({ description: "Nutrition facts", researchOnly: true, sourceUrls: [] });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /source list is missing/);
});

test("estimate API bounds request body size before parsing", async () => {
  const response = await call({ description: "100 g apple" }, { "Content-Length": "50000" });
  assert.equal(response.status, 413);
});
