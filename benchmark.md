# TrackCake AI Model Benchmark

- **Query:** `milk coffee`
- **Providers:** Groq, Google Gemini, OpenRouter
- **Status:** Awaiting execution. No model results have been fabricated.
- **Run:** `node scripts/benchmark-models.mjs` from the repository root.

The runner discovers live provider catalogues and sends exactly one request per model, with no retries. It records model ID, status, latency, returned food/portion/calorie/macronutrient summary, and errors. Progress is saved after every request.

Latency includes TrackCake's nutrition lookup after model generation. Accuracy must be reviewed against a consistent nutrition reference; one prompt cannot establish a universal winner.
