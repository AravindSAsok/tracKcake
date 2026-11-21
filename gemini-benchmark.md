# TrackCake Gemini Model Smoke Test

- Run ID: 44883378865
- Started: 2026-11-21T08:07:35.099Z
- Updated: 2026-11-21T08:08:20.632Z
- Target: https://trackcake.vercel.app
- Status: COMPLETE
- Gemini candidates discovered in TrackCake: 5
- Tested: 5; passed: 2; failed: 3
- Scope: one strict /api/estimate request per model for apple; strict mode disables provider/model fallback. A pass requires a complete non-empty validated nutrition item, not merely HTTP 200.

| Model ID | Status | Latency (ms) | Food returned | Error |
|---|---|---:|---|---|
| gemini-flash-lite-latest | success | 1246 | apple | |
| gemini-3.1-flash-lite | success | 2296 | apple | |
| gemini-3.5-flash-lite | failed | 9382 | — | Provider reported temporary high demand |
| gemini-3.6-flash | failed | 1229 | — | Provider reported temporary high demand |
| gemini-3.8-flash | failed | 30290 | — | TrackCake Gemini request timed out |

## Interpretation

- Confirmed working on this run: gemini-3.1-flash-lite and gemini-flash-lite-latest.
- The other three failures are availability/timeout failures from this single run. They are not evidence that the models are permanently incapable of food estimation.
- This benchmark exercises TrackCake's strict single-model food-estimation endpoint with the simple prompt "apple". It does not yet prove mixed-meal quality or Live Web Search normalization quality.
