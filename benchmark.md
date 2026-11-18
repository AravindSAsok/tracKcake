# TrackCake AI Model Benchmark

- Run ID: `44328509966`
- Query: `milk coffee`
- Target: https://trackcake.vercel.app
- Started: 2026-11-18T14:49:32.162Z
- Updated: 2026-11-18T14:49:33.801Z
- Status: RUNNING
- Catalogue checked: 2026-11-18T14:49:33.663Z
- Progress: 0/393 entries; 0 successful; 0 failed/unavailable
- Protocol: exactly one POST to /api/estimate per distinct provider/model pair; sequential; no retries; no automatic provider fallback when a specific model is selected.
- Durability: each result is committed and pushed to main before the next model request. The workflow also uploads benchmark.md as an artifact on success or failure.
- Latency is end-to-end TrackCake latency and includes nutrition research after model generation; it is not raw model-only latency.
- Result fields preserve returned food names, portions, calories and macros. Accuracy requires comparison with a consistent nutrition reference.
- This single query is a smoke/quality comparison, not a universal model ranking.

## Results

| Provider | Model ID | Status | Latency (ms) | Total kcal | Returned items | Error / notes |
|---|---|---:|---:|---:|---|---|
| — | — | pending | — | — | No requests run | — |

## Review notes

Review whether the model correctly interprets 'milk coffee', chooses a plausible serving size, and returns plausible calories/macros. Compare like-for-like portions before ranking. A fast but nutritionally implausible response should not win.
