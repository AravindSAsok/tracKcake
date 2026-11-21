# Smart Nutrition Search V3

Live web research is an explicit user action. Normal text/photo estimation does not invoke Firecrawl.

## Request flow

1. Validate the submitted food phrase and preserve the original text.
2. Apply deterministic normalization to separate the food identity from detectable preparation constraints (for example, "milk coffee without sugar" becomes "milk coffee" plus "no added sugar").
3. If a configured provider is available, verify its selected TrackCake model against the provider's live model catalogue and ask it for a canonical food identity plus alternate search queries. Provider/model failures fall back to deterministic normalization; they do not block web search.
4. Build up to three focused queries from the original phrase, normalized identity, constraints and AI refinement.
5. Run the queries concurrently through Firecrawl, requesting up to five web results per query.
6. Validate HTTPS source URLs, deduplicate by URL, and retain pages with a meaningful food-identity match and at least two nutrition metric labels plus a numeric nutrition value.
7. Extract compact nutrition-focused excerpts. Attempt deterministic extraction from the excerpt; if complete facts are unavailable, keep the page as evidence for the existing user-triggered AI structuring step.
8. Rank government, education and Open Food Facts domains ahead of general web domains, then prefer pages with deterministic nutrition extraction. Return at most eight sources.
9. Show the interpreted food, preserved constraints and search/result counts in the research dialog. The user must still review and explicitly save any nutrition values.

## Accuracy and security boundaries

- AI normalization creates search queries only. It does not create nutrition facts or verify a source.
- The original user phrase is always included in the query set.
- Negative/preparation constraints are retained separately and included in at least one query. A source does not need to repeat every modifier verbatim to be considered useful evidence.
- Search relevance is not source verification. A returned page may have facts set to null; the existing AI structuring flow may only extract values supported by the supplied source excerpts and URLs.
- Deterministic extraction remains strict about explicit nutrient labels, values, units and serving basis.
- URLs must be HTTPS and cannot contain credentials, localhost, local hostnames or raw IPv4 addresses.
- Provider credentials and the Firecrawl key remain server-side. Model availability is checked against the provider's live catalogue before query refinement.
- Firecrawl calls occur only after the user explicitly chooses Live web search.

## Cost and runtime

A request performs up to three Firecrawl search calls in parallel, each requesting at most five results. The merged candidate set is deduplicated and capped at eight returned evidence sources. AI normalization is a small structured request (maximum 400 output tokens) and is skipped when no verified configured model is available. Search still proceeds with deterministic normalization.

## Regression coverage

tests/web-research-query.test.mjs covers:
- "milk coffee without sugar" normalization and preservation of the no-added-sugar constraint;
- original, constraint-aware and AI-refined query generation;
- acceptance of a nutrition page that does not repeat every preparation modifier;
- rejection of unrelated pages and pages without nutrition metrics.

Run npm test, npm run check and npm run build before release. Verify the live route with a configured Firecrawl key and provider key in a non-production test environment; do not use a user's personal diary data for provider tests.
