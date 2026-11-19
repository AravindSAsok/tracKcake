# TrackCake AI Model Benchmark

- Run ID: `44560753359`
- Query: `milk coffee`
- Target: https://trackcake.vercel.app
- Started: 2026-11-19T15:58:15Z
- Completed: 2026-11-19T16:00:41Z
- Status: COMPLETE — RESULTS RECOVERED FROM VERCEL RUNTIME LOGS
- Models requested: 11 (one `POST /api/estimate` per allowlisted model).
- Direct model result: 9 succeeded; 2 failed.
- Important harness limitation: `/api/estimate` returns Server-Sent Events, but the original benchmark script called `response.json()`. It therefore could not capture completion payloads and incorrectly labelled every HTTP 200 as a model success. Do not use its 11/11 success count.
- Important isolation limitation: `/api/estimate` currently falls back to other models after the selected model fails. Two requests therefore caused fallback generations. Vercel runtime logs identify the originally requested model's failure and the fallback model's success.
- Nutrition item names, calories and macros were not captured by this run's broken parser. Latencies below are model-generation durations from Vercel runtime logs, not end-to-end request times.
- This is a single-prompt smoke test, not a universal model ranking.

## Results

| Provider | Requested model | Direct result | Generation latency | Notes |
|---|---|---:|---:|---|
| Groq | `qwen/qwen3.8-27b` | PASS | 504 ms | Provider logged successful generation. |
| Groq | `openai/gpt-oss-20b` | PASS | 1,334 ms | Provider logged successful generation. |
| Groq | `openai/gpt-oss-120b` | PASS | 1,245 ms | Provider logged successful generation. |
| Gemini | `gemini-flash-lite-latest` | PASS | 6,776 ms | Provider logged successful generation. |
| Gemini | `gemini-3-flash-preview` | PASS | 7,178 ms | Provider logged successful generation. |
| Gemini | `gemini-3.1-flash-lite-preview` | PASS | 2,330 ms | Provider logged successful generation. |
| Gemini | `gemini-3.1-flash-lite` | FAIL | 30,002 ms | Timed out. The endpoint then fell back to `gemini-flash-lite-latest` (23,042 ms), which succeeded; that fallback does not count as a pass for the requested model. |
| Gemini | `gemini-3.5-flash-lite` | PASS | 19,226 ms | Provider logged successful generation. |
| OpenRouter | `baidu/ernie-5.5-flash-preview:free` | PASS | 3,333 ms | Provider logged successful generation. |
| OpenRouter | `particle-ai/particle-1:free` | FAIL | 590 ms | Provider returned an error. The endpoint then fell back to `baidu/ernie-5.5-flash-preview:free` (5,396 ms), which succeeded; that fallback does not count as a pass for the requested model. |
| OpenRouter | `nvidia/nemotron-3.5-super-vl:free` | PASS | 5,485 ms | Provider logged successful generation. |

## Summary

- Groq: 3/3 passed.
- Gemini: 4/5 passed.
- OpenRouter: 2/3 passed.
- Total: **9/11 direct model generations passed**.
- Fallback generations: 2 (Gemini Flash-Lite Latest and OpenRouter ERNIE). These demonstrate fallback availability, not success of the originally selected models.
- Nutrition payloads were not recorded, so this run verifies generation/availability only. It does not validate calorie or macro quality.

## Required benchmark harness correction

Before the next run:
1. Parse the `text/event-stream` response from `/api/estimate`, handling `progress`, `complete`, and `error` events.
2. Add a strict-model test mode so a selected model is the only model attempted; no provider/model fallback during benchmarks.
3. Count success only when the final `complete` event names the requested provider/model and contains a non-empty items array.
4. Preserve one request per model, sequential execution, no retries, and publish each result before proceeding.
