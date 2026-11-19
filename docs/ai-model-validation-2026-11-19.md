# TrackCake AI model validation — 2026-11-19

## Production recheck

Tests were run against `https://trackcake.vercel.app` using exact single-model requests (`strictModel: true`). No request could silently fall back to another model.

### Simple output check: `apple`

| Provider | Model | Result | Latency |
|---|---|---:|---:|
| Groq | `qwen/qwen3.8-27b` | PASS | 394 ms |
| Groq | `openai/gpt-oss-20b` | PASS | 1,145 ms |
| Groq | `openai/gpt-oss-120b` | PASS | 795 ms |
| Gemini | `gemini-flash-lite-latest` | PASS | 13,010 ms |
| Gemini | `gemini-3-flash-preview` | FAIL — provider high demand | 2,302 ms |
| Gemini | `gemini-3.1-flash-lite-preview` | FAIL — timeout | 30,085 ms |
| Gemini | `gemini-3.5-flash-lite` | FAIL — provider high demand | 1,055 ms |
| OpenRouter | `baidu/ernie-5.5-flash-preview:free` | PASS | 2,288 ms |
| OpenRouter | `nvidia/nemotron-3.5-super-vl:free` | PASS | 3,521 ms |

All five passing models returned a non-empty, schema-valid item for apple with 95 kcal and macros of 0.5 g protein, 25 g carbs and 0.3 g fat.

### Mixed-meal output check

Prompt: `1 egg (~50 g), 1 parippu vada (~45 g), 200 ml milk tea with little sugar`

| Provider | Model | Result | Items returned |
|---|---|---:|---:|
| Groq | `openai/gpt-oss-120b` | PASS | 3 |
| Groq | `qwen/qwen3.8-27b` | PASS | 3 |
| Groq | `openai/gpt-oss-20b` | PASS | 3 |
| Gemini | `gemini-flash-lite-latest` | FAIL — timeout | 0 |
| Gemini retry | `gemini-flash-lite-latest` | FAIL — provider high demand | 0 |
| OpenRouter | `baidu/ernie-5.5-flash-preview:free` | PASS | 3 |
| OpenRouter | `nvidia/nemotron-3.5-super-vl:free` | PASS | 3 |

The five passing models preserved the three food items and returned non-empty amounts plus numeric calories/macros. Raw calorie estimates varied between models, particularly for parippu vada and milk tea. These strict tests bypass nutrition research; they validate provider response and schema/portion handling, not final nutrition accuracy.

## Registry decision

- Keep Groq: 3 models.
- Keep OpenRouter: 2 models.
- Temporarily disable Gemini: its only passing simple test failed the mixed-meal test twice, while the other Gemini candidates failed due to high demand or timeout.
- The live provider catalogue is still checked before text models are exposed or used for normal estimate fallback.
- Gemini can be reconsidered only after it passes repeated simple and mixed-meal tests. Do not re-enable it merely because the provider catalogue lists it.

## Test limitations

- These are point-in-time production checks; provider availability can change.
- The strict test mode intentionally disables cross-model fallback so the tested model is known.
- Strict tests skip nutrition research. They do not establish clinical or database-level nutrition accuracy.
- Keep free-tier/API quotas in mind; avoid frequent repeated benchmarks.