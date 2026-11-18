# TrackCake AI Model Benchmark

- Run ID: `44328509966`
- Query: `milk coffee`
- Target: https://trackcake.vercel.app
- Started: 2026-11-18T14:49:32.162Z
- Updated: 2026-11-18T14:50:33.620Z
- Status: RUNNING
- Catalogue checked: 2026-11-18T14:49:33.663Z
- Progress: 10/393 entries; 5 successful; 5 failed/unavailable
- Protocol: exactly one POST to /api/estimate per distinct provider/model pair; sequential; no retries; no automatic provider fallback when a specific model is selected.
- Durability: each result is committed and pushed to main before the next model request. The workflow also uploads benchmark.md as an artifact on success or failure.
- Latency is end-to-end TrackCake latency and includes nutrition research after model generation; it is not raw model-only latency.
- Result fields preserve returned food names, portions, calories and macros. Accuracy requires comparison with a consistent nutrition reference.
- This single query is a smoke/quality comparison, not a universal model ranking.

## Results

| Provider | Model ID | Status | Latency (ms) | Total kcal | Returned items | Error / notes |
|---|---|---:|---:|---:|---|---|
| groq | openai/gpt-oss-120b | success | 3169 | 148 | coffee; 240 ml; 2 kcal; P 0g / C 0g / F 0g \\| milk; 240 ml; 146 kcal; P 7.9g / C 11.5g / F 8g |  |
| groq | qwen/qwen3.8-27b | success | 734 | 32 | Coffee, black; 1 cup; 2 kcal; P 0.3g / C 0.4g / F 0g \\| Milk, whole; 1/4 cup; 30 kcal; P 0.7g / C 1.2g / F 1.6g |  |
| groq | openai/gpt-oss-20b | success | 1267 | 20 | coffee; 8 oz; 2 kcal; P 0.3g / C 0g / F 0g \\| milk; 2 tbsp; 18 kcal; P 1g / C 1.5g / F 1g |  |
| groq | allam-2-7b | error | 527 | — | — | groq/allam-2-7b: The AI provider returned an incomplete nutrition estimate. |
| gemini | gemma-4-26b-a4b-it | error | 1346 | — | — | gemini/gemma-4-26b-a4b-it: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. |
| gemini | gemma-4-31b-it | error | 30261 | — | — | gemini/gemma-4-31b-it: The operation was aborted due to timeout |
| gemini | gemini-flash-latest | error | 1925 | — | — | gemini/gemini-flash-latest: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. |
| gemini | gemini-flash-lite-latest | success | 2470 | 60 | milk coffee; 1 cup; 60 kcal; P 3g / C 6g / F 3g |  |
| gemini | gemini-pro-latest | error | 684 | — | — | gemini/gemini-pro-latest: You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor y |
| gemini | gemini-3-flash-preview | success | 5600 | 30 | milk coffee; 8 fl oz; 30 kcal; P 2g / C 3g / F 1g |  |

## Review notes

Review whether the model correctly interprets 'milk coffee', chooses a plausible serving size, and returns plausible calories/macros. Compare like-for-like portions before ranking. A fast but nutritionally implausible response should not win.
