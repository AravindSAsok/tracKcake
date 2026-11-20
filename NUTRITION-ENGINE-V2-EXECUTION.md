# TrackCake Nutrition Engine V2 — One-Shot Execution Plan

> **Purpose:** This is an executable engineering task, not a proposal. When the user says “Read NUTRITION-ENGINE-V2-EXECUTION.md and execute it”, the coding agent must implement the complete scope below, verify it, update the project documentation and this execution log, and push the finished work directly to `main`.
>
> **Repository:** `AravindSAsok/tracKcake`  
> **Production URL:** https://trackcake.vercel.app  
> **Current baseline at authoring:** main includes nutrition research reliability commit `87aed9643b3f41c10acdb9c88faea6851022cbcf`. Always fetch and inspect the actual latest `main`; do not assume this remains HEAD.

---

## 0. Mandatory instructions before coding

1. Read the entire `AGENTS.md` first. It is the single source of truth for repository workflow, architecture, safety, and release requirements. This file is a task-specific execution plan, not a replacement for `AGENTS.md`.
2. Fetch/sync the latest `origin/main`; work directly on `main`. Do not create branches, worktrees, or pull requests. Do not force-push or rewrite history.
3. Inspect the current code, migrations, types, provider integrations, existing tests, and actual production configuration before deciding implementation details. Treat the current implementation as authoritative; this plan describes outcomes, not assumed file layouts.
4. Trace the full data flow from food input through matching/research/extraction/normalization/validation/AI fallback/review/save and cloud/local persistence.
5. Preserve all existing features and user data. Do not reset, truncate, overwrite, or bulk-recalculate diary records.
6. Do not expose, print, log, or commit secrets, API keys, tokens, private diary data, or service-role credentials.
7. Do not invent successful tests, live provider behavior, deployment state, or production smoke tests. Record exactly what was and was not verified.
8. Implement the complete scope in this document in one coordinated delivery. Do not stop after the first slice or merely write another plan. If an external credential, provider outage, or unavailable environment blocks a specific live test, still complete code and deterministic tests where possible, then report that precise blocker.
9. Keep dependencies minimal. Reuse existing project architecture and helpers unless a demonstrated limitation requires a change.
10. Keep the application responsive and accessible. Preserve the existing review-before-save user experience.

## 1. Product outcome

Build a dependable, evidence-first Nutrition Engine V2 that can produce structured nutrition results with deterministic code wherever possible, use AI as a constrained fallback rather than the default calculator, and make uncertainty visible.

The system must support:
- Single-ingredient foods (e.g. apple, rice, egg).
- Packaged/branded foods and products.
- Beverages (including milk coffee).
- Mixed meals, recipes, and restaurant-style foods.
- User-specified quantities, serving units, and ingredient amounts.
- Missing, ambiguous, conflicting, or low-quality source data without fabricated certainty.

A nutrition result must preserve its source, source record/reference, serving basis, normalized amount, extraction method, and confidence/verification status. Never imply that estimated values are laboratory-verified.

## 2. Phase A — Audit and architecture design

Before changing code:
- Inspect `src/lib/nutrition-research.ts`, `src/pages/api/web-research.ts`, `src/pages/api/estimate.ts`, `src/pages/api/food-image.ts`, food-entry client code, provider/model selection and fallback, storage abstractions, Supabase migrations/RLS, and package scripts.
- Identify existing nutrition matching and calculation logic. Reuse it; do not create duplicate parallel pipelines.
- Inspect current database tables and indexes before proposing a new food catalog. Prefer extending a suitable existing table/model only when its semantics and ownership are appropriate.
- Map the current Firecrawl explicit-action workflow and ensure it remains separate from ordinary estimates.
- Write a concise architecture note in the implementation log describing the chosen pipeline and any deliberate deviations from this plan.

## 3. Phase B — Deterministic nutrition extraction

Implement reusable, typed extraction utilities that transform trusted provider/source payloads into structured nutrition facts without an LLM.

Support, as applicable to the actual source formats:
- USDA FoodData Central structured nutrient records.
- Open Food Facts product nutrition fields and serving metadata.
- Firecrawl-reviewed page content, including HTML-derived tables/Markdown tables, nutrition labels, JSON-LD where available, and clearly labeled text lines.
- Explicitly supported units and aliases for energy/calories, protein, carbohydrate, total fat, fiber, sugar, saturated fat, and sodium. Add other nutrients only where source data and product UI support them.

Requirements:
- Parse numeric values safely, including decimal commas only when unambiguous, ranges, less-than/greater-than qualifiers, and units.
- Do not treat arbitrary numbers in surrounding prose as nutrition values.
- Associate each value with its nutrient label, unit, serving basis, and source.
- Reject malformed, ambiguous, unsupported, or unlabelled values rather than guessing.
- Preserve original raw value/unit alongside normalized value/unit.
- Handle duplicate labels, multiple columns/servings, per-portion versus per-100g rows, and table headers explicitly.
- Do not merge values from different serving bases until they have been normalized correctly.
- Make extraction deterministic and independently testable. No AI calls from these utilities.

For Firecrawl:
- Firecrawl remains **explicit user action only**. Never call it automatically during normal text estimation, photo estimation, background jobs, page load, retries, or provider fallback.
- Preserve the Live web search button and source-review step.
- Keep the existing strict maximum of two candidate pages per explicit search unless a documented credit/safety reason requires an even lower cap.
- Do not spend Firecrawl credits during tests or implementation verification. Mock its network boundary.
- Continue to bound response size and source count, reject unsafe URLs/SSRF targets, and sanitize/render scraped content safely.
- Extract facts from reviewed evidence deterministically first. AI may structure only the compact, user-reviewed evidence when deterministic parsing is insufficient.
- Do not silently treat a search result snippet or generic article as authoritative nutrition data.

## 4. Phase C — Serving-size and unit normalization

Build one central normalization layer with explicit units and conversion rules.

Support only conversions that are defensible:
- g, kg, mg, mcg where relevant.
- ml and l for volume.
- kcal and kJ with correct conversion.
- Per 100 g, per 100 ml, per serving, per package, and explicitly quantified user portions.
- Common household units (cup, tablespoon, teaspoon, piece, slice, scoop, etc.) only when a source-specific or food-specific gram/ml equivalence is known.

Rules:
- Do not assume 1 ml = 1 g except when a density is explicitly known or the product/source supports that assumption.
- Do not assume a generic weight for “one piece”, “one cup”, or “one serving”.
- If a quantity cannot be converted reliably, ask for clarification or retain a clearly labelled source serving basis; do not fabricate grams.
- Normalize all macro values consistently and preserve original source basis.
- Avoid double-scaling values that are already expressed per serving or per 100 g/ml.
- Validate energy/macro plausibility, but do not silently overwrite source values with formula-derived values. Flag discrepancies for review.

## 5. Phase D — Internal approved-food catalog

Implement a reusable catalog of verified/approved food facts, with the schema chosen after auditing existing storage.

Each catalog record should support, where applicable:
- Stable ID.
- Canonical food/product name.
- Search aliases and normalized matching tokens.
- Brand and barcode/product identifier when applicable.
- Food category/type.
- Nutrition facts with values, units, and basis.
- Serving definitions and known gram/ml equivalents.
- Source/provider name and source record ID or URL.
- Source attribution and retrieval/verification timestamp.
- Extraction method.
- Confidence/quality status and review status.
- Created/updated timestamps and versioning or supersession strategy.

Data safety:
- Prefer curated shared reference data only if it is safe to expose and does not contain user-private data.
- If user-submitted custom foods are supported, keep them scoped to the owner and protected by RLS.
- Do not let one user's custom food become globally approved automatically.
- Use additive migrations only; never edit already-applied migrations.
- Add indexes/unique constraints for normalized names, aliases, barcodes, and source IDs where justified.
- Avoid duplicate catalog entries and define deterministic upsert/deduplication behavior.
- Never seed fake nutrition facts or pretend sample fixtures are real catalog data.
- If a catalog migration is not needed because an appropriate existing schema already exists, document and reuse it.

Catalog lookup should be fast and should prioritize exact barcode/product IDs, exact canonical names/aliases, then carefully scored fuzzy candidates. Ambiguous matches must be surfaced for selection rather than silently choosing an arbitrary food.

## 6. Phase E — Ingredient-based composite food calculations

Implement deterministic calculations for mixed foods and recipes.

Requirements:
- Parse or accept a list of ingredients with explicit amounts and units.
- Resolve each ingredient against the catalog/provider sources.
- Normalize each ingredient quantity to a compatible basis.
- Calculate total calories and macros by summing each ingredient's scaled nutrition values.
- Support recipe yield/servings and calculate per-serving nutrition only when the total yield or serving count is known.
- Preserve each ingredient's source and quantity contribution so the result is explainable.
- Handle missing ingredient facts transparently. Do not silently substitute a different ingredient.
- Do not infer quantities from a food name alone. For example, “milk coffee” must not be assigned arbitrary milk, coffee, sugar, or serving amounts.
- When ingredient quantities are missing, either ask the user for them or provide a clearly marked rough AI estimate through the existing review UI; never label it deterministic/verified.
- Avoid double counting ingredients and preserve user edits.

The user must be able to review and correct ingredient quantities and the resulting nutrition before saving. Do not automatically save calculated meals to the diary.

## 7. Phase F — Evidence quality and confidence scoring

Create a transparent, deterministic confidence/quality assessment based on evidence, not on an LLM's self-reported confidence.

Consider:
- Source authority and data provenance.
- Exactness of food/product match.
- Barcode or source-record match where available.
- Completeness of required nutrients.
- Clarity of serving basis and unit conversion.
- Extraction quality (structured API field vs table vs prose vs AI-only).
- Freshness where meaningful.
- Conflicting values across sources.
- Whether ingredient quantities are explicit or assumed.

Requirements:
- Define documented scoring/status rules and thresholds in code and tests.
- Use human-readable statuses such as Verified source match, Strong match, Needs review, and AI estimate (final labels may fit existing UI vocabulary).
- A high score must never override missing serving information or a serious source conflict.
- Do not describe a result as verified solely because a provider returned HTTP 200.
- Show the source and serving basis in the review UI when available.
- Keep the score/status explainable; avoid false precision and avoid exposing a meaningless 0–100 number if the underlying evidence cannot support it.
- Make conflict handling explicit. Do not average incompatible source values without a documented basis.

## 8. Phase G — AI fallback and structured output

Retain existing Groq, Gemini, and OpenRouter provider/model selection and fallback behavior.

Make deterministic paths first:
1. Exact known catalog/barcode match.
2. Structured Open Food Facts / USDA match.
3. Deterministic extraction from reviewed Firecrawl evidence, only after explicit user action.
4. Deterministic ingredient calculation when quantities and ingredient facts are known.
5. AI fallback only when the above cannot provide a sufficiently complete result.

AI requirements:
- Use a strict typed/schema-validated response contract.
- Require separate fields for food identity, amount, serving basis, calories, protein, carbohydrates, fat, optional nutrients, ingredients, source evidence, and uncertainty/status.
- Require AI to distinguish supplied facts from inferred estimates.
- AI must not invent citations, URLs, brands, barcodes, ingredient amounts, or source-backed claims.
- AI must not fill missing values with fabricated values merely to satisfy a schema. Allow nullable/unknown fields and return a clear incomplete result.
- Never treat AI-generated values as verified catalog facts without a separate review/approval process.
- Keep the current user-selected provider/model behavior. Preserve automatic fallback rules and visible error handling.
- Keep model-specific allowlists and text/vision capability distinctions intact.
- Limit prompt and evidence sizes. Do not send entire scraped articles or unnecessary diary history.
- Preserve the user's ability to edit all suggested values before saving.

## 9. Phase H — UX integration

Integrate the new engine into the existing food entry flow without redesigning unrelated parts of the app.

The UI should:
- Show a clear loading/status progression, e.g. “Checking saved foods”, “Looking up nutrition source”, “Extracting nutrition facts”, “Calculating ingredients”, “Using AI fallback”.
- Never show a misleading progress message if the corresponding stage did not run.
- Identify the chosen source and serving basis.
- Distinguish structured source-backed values from AI estimates.
- Show uncertainty, missing fields, and conflicting source values in plain language.
- Allow the user to edit the food name, amount, serving, calories, and macros.
- For mixed foods, allow ingredient and quantity review/editing where supported.
- Preserve the existing food review popup and explicit Save action.
- Preserve manual entry, text estimates, photo estimates, cancellation/progress behavior, and all existing diary interactions.
- Keep the experience compact, touch-friendly, keyboard accessible, and responsive.
- Do not introduce automatic diary writes or change historical diary entries.

## 10. Phase I — API, security, performance and resilience

- Validate all user input and API payloads server-side with size and count limits.
- Keep provider keys server-only.
- Preserve Supabase Auth and user-scoped RLS for user-owned records.
- Add authorization checks to all new user-specific endpoints.
- Prevent SSRF in URL handling, including private IPv4/IPv6, localhost, redirects to private networks, non-HTTPS URLs, and DNS/rebinding edge cases as far as the current runtime allows. Prefer fixed provider endpoints and never fetch arbitrary user-supplied URLs.
- Treat external source text as untrusted data, never instructions.
- Add timeouts, bounded retries, and graceful provider failure handling. Avoid retry storms.
- Cache safe deterministic lookups where appropriate, with clear cache keys and invalidation/version behavior. Never cache one user's private data for another user.
- Do not add background Firecrawl calls or hidden credit consumption.
- Avoid logging raw food diaries, photos, tokens, or provider secrets.
- Avoid unnecessary network calls when a strong catalog match exists.
- Ensure API errors are actionable but do not leak internals or credentials.

## 11. Phase J — Automated tests

Add a meaningful automated test suite using the existing project test framework if one exists; otherwise select a minimal compatible test runner and document why.

At minimum, cover:
- Numeric parsing and nutrient label aliases.
- Tables with multiple columns and serving bases.
- Decimal values, supported units, missing values, malformed values, ranges, and ambiguous values.
- kcal/kJ conversion.
- g/mg/mcg and ml/l conversion.
- Per-100g/per-100ml/per-serving scaling.
- Density/household conversion safeguards.
- Duplicate nutrients and conflicting source values.
- Exact and alias catalog matching, barcode matching, ambiguous matches, deduplication/upsert.
- Ingredient scaling, recipe totals, yield/per-serving calculations, missing ingredient values and quantities.
- Confidence/status thresholds and conflict overrides.
- AI schema validation, nullable fields, invalid outputs, invented/missing source references.
- Provider failure/fallback and timeout behavior with mocked network boundaries.
- Firecrawl opt-in contract: no Firecrawl invocation during ordinary text/photo estimates; explicit research route only; maximum two candidate pages; no external Firecrawl calls in automated tests.
- API validation, authorization, payload limits, and unsafe URL rejection.
- Review-before-save behavior and no automatic diary persistence.
- Regression tests for existing manual entry, text/photo estimates, and food storage where practical.

Use deterministic fixtures clearly marked as test data. Never use live API keys or spend Firecrawl credits in CI. Avoid flaky tests and real network dependencies.

## 12. Phase K — Documentation and handoff

Update:
- `AGENTS.md`: add a dated execution log with implemented phases, architecture decisions, migrations, files changed, commands/tests and exact outcomes, commit SHA, CI status, Vercel deployment ID/status, production alias verification, and remaining blockers. Keep existing rules intact.
- `README.md`: describe the actual implemented nutrition pipeline, source order, catalog behavior, AI fallback, serving rules, confidence/status semantics, Firecrawl opt-in behavior, environment variables, and test commands. Do not document planned features as implemented.
- This file: add a completion section with phase checkboxes and factual verification results. Do not mark any phase complete until implemented and verified.
- Add/update relevant architecture or data-contract documentation if it materially helps future agents.

Keep docs truthful and consistent with code.

## 13. Phase L — Verification and direct push to main

Before commit:
1. Inspect the full diff and ensure only intended files changed.
2. Run dependency install only if needed and respect the committed lockfile.
3. Run the project's full type/Astro check (currently expected: `npm run check`).
4. Run the production build (currently expected: `npm run build`).
5. Run the full automated test suite.
6. Run lint/type checks if configured.
7. Review migrations and RLS policies for data safety.
8. Verify no secrets, local environment files, real user data, or debug output are included.
9. Verify Firecrawl is not called by normal text/photo estimates and tests mock the network boundary.
10. Review mobile/desktop UI behavior using available browser tooling. If browser tooling is unavailable, state that clearly.

Commit and release:
1. Commit all intended implementation, tests, migrations, and documentation directly to `main`.
2. Push directly to `origin/main`; never force-push.
3. Verify the pushed commit SHA on GitHub.
4. Inspect GitHub Actions/checks for that exact SHA.
5. Verify Vercel Production deployment corresponds to that exact SHA and reaches a terminal successful state.
6. Verify the production alias points to the intended deployment.
7. Run safe production smoke checks that do not modify or expose real user data. Do not trigger Firecrawl or AI provider spend unless the user explicitly authorizes it.
8. If any required check fails, fix it and repeat. Do not call the task complete while known regressions remain.
9. If GitHub direct push is blocked, stop and report the exact blocker; do not silently create a branch or PR.

Final report must include:
- What each phase delivered.
- Exact files changed and migrations added.
- Tests/checks actually run and results.
- Any test not run and why.
- Security/data integrity notes.
- Commit SHA and GitHub link.
- CI status.
- Vercel deployment ID, URL, status and alias verification.
- Remaining known limitations.

---

## 14. Definition of done

- [ ] Deterministic extraction is implemented and tested.
- [ ] Serving/unit normalization is implemented and tested.
- [ ] Internal approved-food catalog is implemented or a suitable existing schema is reused and documented.
- [ ] Ingredient-based calculations are implemented and tested without inventing quantities.
- [ ] Evidence-based confidence/status scoring is implemented and tested.
- [ ] Structured deterministic nutrition is preferred over AI where evidence supports it.
- [ ] AI is a constrained fallback with schema validation and uncertainty handling.
- [ ] Existing review-before-save and diary behavior remain intact.
- [ ] Firecrawl remains opt-in, capped, and absent from normal estimate paths.
- [ ] Security, authorization, RLS and data-preservation requirements are met.
- [ ] Automated tests cover the core pipeline and critical regressions.
- [ ] `AGENTS.md`, `README.md`, and this file are updated truthfully.
- [ ] Checks/build/tests pass, or each blocker is precisely documented.
- [ ] Changes are pushed directly to `main`.
- [ ] GitHub checks and Vercel Production deployment are verified for the exact commit.

## 15. Execution log

### Prepared — 2026-11-20
- This file records the one-shot implementation scope requested by the project owner.
- No application code, database schema, or production behavior is changed by this planning document.
- Execution begins only when the user explicitly asks an agent to read and execute this file.

### Execution record — 2026-11-20
- Status: Core deterministic extraction, unit normalization, catalogue schema/lookup, recipe math helper, confidence scoring, deterministic-first simple-food lookup, deterministic-first reviewed-web extraction, and unit tests have been authored.
- Status is **partial**, not complete: recipe editor UI, full source reconciliation, broader extraction formats, and complete nullable AI field-level schema remain outstanding.
- Implementation commit: Pending.
- Test/build/CI status: Pending GitHub Actions; local checks unavailable because the connected development laptop is offline.
- Supabase migration: pending application and verification on TrackCake project `rdjjlwupwobyojmkaqau`.
- Vercel deployment: Pending.
- Notes: Do not treat the remaining partial features as implemented functionality.


---

## Final execution verification — 2026-11-20

### Released and verified

- Final code/documentation commit: `582c30c8e43956bce6ff45c549d4ec2e8caef04a`
- GitHub Actions run #244: `SUCCESS` — `npm test` (11/11), `npm run check` (0 errors, 0 warnings; 2 hints), and `npm run build` passed.
- Vercel Production deployment `dpl_8xVq9oosymqZrM8b9Y8zBdcGYwxt` reached `READY` from the exact final commit. Production alias `trackcake.vercel.app` verified.
- Supabase migration `202611200001_nutrition_catalog` applied to TrackCake project `rdjjlwupwobyojmkaqau`. RLS SELECT policy and anon/authenticated read-only grants verified. Catalogue currently has 0 approved rows; no synthetic facts were seeded.
- Safe unauthenticated GET smoke check of production succeeded. No diary writes, authenticated tests, or Firecrawl requests were performed.

### Definition-of-done assessment

- [x] Deterministic extraction core implemented and unit-tested for labelled rows and Markdown tables.
- [x] Serving/unit normalization core implemented and tested; incompatible g/ml bases are rejected.
- [x] Approved-food catalogue schema, RLS and exact/alias/barcode lookup implemented; curated data population/admin workflow remains outstanding.
- [x] Deterministic ingredient/recipe calculation helper implemented and tested; interactive ingredient editor is not implemented.
- [x] Evidence confidence/status helper implemented and tested.
- [x] Deterministic source paths run before AI for explicitly quantified single foods and complete reviewed web evidence.
- [ ] Full nullable AI nutrition schema, field-level uncertainty, and ingredient/source evidence validation.
- [x] Existing review-before-save workflow preserved.
- [x] Firecrawl remains opt-in, two-page capped, and unused by automated tests.
- [x] Additive RLS-protected catalogue migration applied and verified.
- [ ] Full app regression suite and authenticated browser/device testing.
- [x] README, AGENTS.md, and this execution plan updated truthfully.
- [x] Core unit tests, Astro/TypeScript check, and production build pass in GitHub Actions.
- [x] Changes pushed directly to `main`; exact commit and Vercel Production deployment verified.

### Final status

**Partially complete, core released.** The remaining unchecked items above are real scope gaps, not deployment blockers. Do not describe the entire Nutrition Engine V2 plan as finished until the recipe UI, curated catalogue workflow, full AI schema, and full regression/authenticated browser tests are implemented.


---

## Recipe editor implementation — 2026-11-20

- Added a user-facing **Build recipe** dialog with a recipe name, serving count, and 2–8 measured ingredient lines.
- Each line must contain an explicit g/ml amount. The client rejects missing quantities and unsupported household units rather than guessing.
- Each ingredient is estimated independently through the existing estimate API. The API remains responsible for deterministic source lookup before its configured AI fallback. The recipe workflow does not invoke Firecrawl.
- Added tested aggregation logic for ingredient totals and per-serving macros. The user reviews one recipe item in the existing review dialog and must explicitly save it.
- Ingredient details are displayed during calculation but are not persisted as a structured recipe record. Future work may add durable recipe/ingredient provenance after a separate data-model review.
- Verification and deployment: pending exact-commit GitHub Actions and Vercel results. Local checks and interactive browser testing are unavailable because the linked development laptop is offline.


---

## Recipe editor verification closeout — 2026-11-20

- Final main commit at verification: `6f3623d76b4bae0aae1424c723c9e021fec34748`.
- GitHub Actions run #254: [SUCCESS](https://github.com/AravindSAsok/tracKcake/actions/runs/44789966155). `npm test`: 13 passed / 0 failed; `npm run check`: 0 errors / 0 warnings (2 existing hints); `npm run build`: passed.
- Vercel Production deployment: `dpl_6Zx8p2cpmwA1dYwW4a2BeY1C9PbV`, READY, built from the exact main commit. Verified aliases: `trackcake.vercel.app`, `trackcake-kukki.vercel.app`, and `trackcake-git-main-kukki.vercel.app`.
- Recipe builder implementation and aggregation tests are included in the verified main tree. CI confirms build/type/test integrity; it does not replace interactive authenticated browser testing.
- The linked development laptop is offline. No manual UI interaction, provider API request, authenticated diary save, or Firecrawl request was performed during this release.
- Current limitation: the builder stores one aggregate recipe diary entry and displays ingredient provenance during calculation, but it does not persist a structured ingredient list to the database. The catalogue remains empty pending a trusted curation/admin workflow.
- Status: basic user-facing ingredient recipe builder released and CI/deployment verified; Nutrition Engine V2 remains partially complete.
