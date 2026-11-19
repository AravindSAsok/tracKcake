# OpenRouter Free Model Smoke Test

- Run ID: `44564110062`
- Prompt: `apple`
- Target: https://trackcake.vercel.app
- Started: 2026-11-19T16:16:45.003Z
- Updated: 2026-11-19T16:17:39.585Z
- Status: COMPLETE
- Catalogue checked: 2026-11-19T16:16:45.599Z
- Discovered free text models: 13
- Tested: 13; passed: 6; failed: 7; skipped by daily cap: 0
- Scope: OpenRouter only; only model IDs ending in :free; one request per model; no retries; strict single-model mode prevents fallback to Groq/Gemini/another OpenRouter model.
- Pass criteria: TrackCake receives a complete non-empty SSE complete event containing at least one returned item. HTTP 200 alone is not a pass.
- Limit: at most 50 requests in this run to respect the no-credit free-model daily allowance. OpenRouter may count failed requests toward that allowance.

## Results

| Model ID | Status | Latency (ms) | Response | Error |
|---|---:|---:|---|---|
| inclusionai/ling-3.2-flash:free | failed | 395 | No complete result | openrouter/inclusionai/ling-3.2-flash:free: Provider returned error |
| baidu/ernie-5.5-flash-preview:free | success | 2191 | apple |  |
| liquid/lfm-3-1.7b:free | failed | 9261 | No complete result | openrouter/liquid/lfm-3-1.7b:free: The operation was aborted due to timeout |
| particle-ai/particle-1:free | failed | 1173 | No complete result | openrouter/particle-ai/particle-1:free: Provider returned error |
| recursive/flint-v1.0:free | success | 5016 | apple |  |
| nvidia/nemotron-3.5-super-vl:free | success | 2175 | apple |  |
| dots-studio/dots-3-note-preview:free | failed | 9265 | No complete result | openrouter/dots-studio/dots-3-note-preview:free: The operation was aborted due to timeout |
| nvidia/nemotron-3.5-lightning:free | failed | 7650 | No complete result | openrouter/nvidia/nemotron-3.5-lightning:free: Empty response from provider. |
| cohere/north-mini-code:free | success | 3480 | apple |  |
| nvidia/nemotron-3-ultra-550b-a55b:free | success | 5322 | apple |  |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | success | 7061 | apple |  |
| google/gemma-4-26b-a4b-it:free | failed | 408 | No complete result | openrouter/google/gemma-4-26b-a4b-it:free: Provider returned error |
| google/gemma-4-31b-it:free | failed | 434 | No complete result | openrouter/google/gemma-4-31b-it:free: Provider returned error |
