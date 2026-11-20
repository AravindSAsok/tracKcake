# TrackCake Ã¢â‚¬â€ AGENT INSTRUCTIONS (single source of truth)

**This is the only agent instruction file.** All AI coding agents and human contributors must read this entire AGENTS.md before making changes. Do not create another agent.md, agents.md, or duplicate agent guide.

## Mandatory Git workflow
- Work only on main. Fetch and sync origin/main before starting.
- Make changes directly on local main and push commits directly to origin/main after verification.
- Do not create feature/fix branches, worktrees, or pull requests unless the user explicitly overrides this rule.
- Never force-push, rewrite shared history, or reset away user work.
- If GitHub blocks a direct push due to branch protection or permissions, stop and report the blocker; do not silently switch to a branch/PR workflow.
- Always leave the repository on main.

## Project entry point
TrackCake is an Astro 5 + TypeScript food diary and calorie tracker deployed on Vercel. Preserve user food data, Supabase Auth/PostgreSQL/RLS, local/cloud sync, nutrition providers, and Calkie behavior. Keep secrets server-side and out of Git.

---
# TrackCake Agent Guide

This file is the working agreement for AI coding agents and human contributors maintaining TrackCake. Read it before making changes.

## 1. Product and priorities

TrackCake is a lightweight, privacy-conscious food diary and calorie tracker. The product helps people record meals, review estimated nutrition, understand daily calorie and macro progress, and ask Calkie questions about their own diary.

Priorities, in order:

1. Preserve user data, authentication, authorization, and cloud-sync correctness.
2. Preserve all existing food logging and AI workflows.
3. Make the experience reliable and usable on phones, tablets, and desktops.
4. Keep the interface calm, fast, accessible, and uncluttered.
5. Prefer small, reviewable changes over broad rewrites.

Do not replace working behavior with mocks, fixtures, placeholders, or hard-coded account data.

## 2. Technology and architecture

- Framework: Astro 5 with TypeScript.
- Runtime/deployment: Vercel using the Astro Vercel adapter.
- Browser persistence and cloud data: Supabase JS client, Supabase Auth, Postgres, and Row Level Security.
- AI providers: Groq, Gemini, and OpenRouter. Provider credentials must remain server-side.
- Styling: shared stylesheet at `src/styles/global.css`.
- Main dashboard markup: `src/pages/index.astro`.
- Main diary and food-entry interactions: `src/scripts/app.ts`.
- Account and food-estimation model selector behavior: `src/scripts/ai-account.ts`.
- Calkie popup and chat client: `src/scripts/calkie.ts`.
- Shared document shell: `src/layouts/Layout.astro`.
- Server endpoints: `src/pages/api/`.
- Supabase migrations and database policy source: `supabase/migrations/`.

Use the existing modules and storage abstractions. Do not introduce a second competing state-management or persistence layer.

## 3. Non-negotiable product contracts

### Authentication and user data

- Preserve Supabase email/password sign-up, sign-in, sign-out, session persistence, token refresh, and guest/anonymous behavior.
- Never expose service-role keys or provider API keys in browser code, public environment variables, logs, or committed files.
- Keep Row Level Security assumptions intact. Every user-owned database operation must remain scoped to the authenticated user.
- Do not change table names, columns, API payload shapes, or migration history unless the task explicitly requires it and the change is reviewed end-to-end.
- Guest diary import must not overwrite another user's rows. Preserve the existing safe ID regeneration and insert behavior.
- Do not clear local or cloud data as a side effect of cosmetic UI changes.
- Display the authenticated user's metadata name when present; otherwise derive a readable label from the email local-part. Keep the full email available in account details.

### Food diary

Preserve all of the following:
- Manual food entry, editing, and deletion.
- AI text-based food estimates and the review-before-save step.
- AI photo-based food estimates, progress updates, cancellation, and review-before-save.
- Provider/model discovery and selection for Groq, Gemini, and OpenRouter.
- Automatic provider fallback.
- Local storage fallback and optional Supabase cloud synchronization.
- Daily calorie goal, rolling 24-hour calorie balance, macro totals, meal breakdown, searchable/date-filtered history, and seven-day consistency summary.

Nutrition values are estimates, not medical advice. Do not imply that estimates are exact.

### Calkie

- Calkie is a floating popup/chat widget on the dashboard, never a separate page or route.
- Opening or closing Calkie must not navigate, reload, or replace the dashboard.
- Preserve chat history, suggestions, provider/model selection, authenticated API requests, and message submission.
- Keep the dashboard mounted underneath the mobile overlay.
- Do not automatically open the mobile keyboard when the popup is opened.
- Maintain accessible close controls, sensible focus behavior, and scrollable message history.

## 4. Development workflow

Before editing:

1. Read this guide and the relevant source files.
2. Check the current branch and latest commit. Always work directly on `main`; do not switch to or create topic branches.
3. Inspect the existing implementation and identify the actual cause of the issue.
4. Trace affected data flow from UI to client logic to API/storage before changing contracts.
5. Check for existing styles and helpers before adding new ones.
6. Define the smallest safe patch and list the behaviors that must remain unchanged.

During implementation:

1. Make targeted changes in the existing architecture.
2. Keep TypeScript types explicit and handle network/auth errors visibly.
3. Avoid duplicated event listeners, global fetch monkey-patches, duplicated CSS declarations, and conflicting media queries.
4. Prefer semantic HTML, accessible labels, keyboard support, and visible focus states.
5. Use stable IDs and existing API contracts.
6. Keep mobile controls touch-friendly and avoid viewport zoom caused by undersized form-control text.
7. Do not introduce new dependencies unless necessary; explain why if one is added.
8. Never commit secrets, local environment files, tokens, or user data.

Before committing:

1. Run `npm ci` when the lockfile is present and dependencies need installing.
2. Run `npm run check`.
3. Run `npm run build`.
4. Run relevant automated tests if present; add focused tests for new non-trivial logic where practical.
5. Review the diff for accidental changes, dead code, debug output, secrets, and unrelated formatting.
6. Verify the working tree and commit only the intended files.

After committing:

1. Push directly to origin/main after checks; do not create feature branches or PRs unless the user explicitly overrides this rule.
2. Confirm the CI/Vercel deployment corresponds to the exact commit.
3. Inspect build logs and wait for a terminal deployment state.
4. Verify the production alias points to the intended deployment.
5. Perform smoke tests against the deployed app when browser tooling is available.
6. Report exactly what was tested. Distinguish build checks from real browser, authenticated-user, provider, and device tests.

## 5. Responsive UI standards

Design for these viewport ranges:
- 320ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“360px: compact phones.
- 375ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“430px: standard phones.
- 431ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“680px: large phones and narrow landscape layouts.
- 681ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1024px: tablets.
- 1025px and above: laptops and desktops.

Rules:
- Use mobile-first layout decisions; do not merely scale down desktop layouts.
- Prevent horizontal page overflow and clipped text.
- Keep important account details readable. On narrow screens, use a compact account trigger and put the complete name/email in an expandable or dialog-based profile view.
- Use at least 16px text for mobile form controls to prevent automatic browser focus zoom.
- Respect safe-area insets on devices that expose them.
- Make dialogs and popups fit the available viewport and remain scrollable.
- Keep touch targets comfortable (aim for approximately 44px).
- Avoid fixed heights for content that can grow or be affected by the on-screen keyboard.
- Prefer `dvh` with a sensible fallback where dynamic viewport sizing is needed.
- Respect `prefers-reduced-motion`.
- Test long emails, long names, empty states, loading states, and error messages.

## 6. AI provider and API safety

- Provider keys are read only in server-side API routes.
- Never send secrets to the browser or echo them in API responses.
- Treat provider model catalogs as dynamic; do not hard-code a model as available without checking the provider response.
- Preserve explicit provider/model selection and automatic fallback behavior.
- Validate and bound user input on the server.
- Handle malformed JSON and non-2xx responses without crashing the UI.
- Do not silently swallow meaningful failures; show concise actionable errors without leaking secrets.
- Avoid logging full prompts, food diaries, access tokens, or personal account details.

## 7. Database and migration safety

- Read the current migration and RLS policies before proposing a schema change.
- Prefer additive, backward-compatible migrations.
- Never edit an already-applied migration to change production history; add a new migration instead.
- Never run destructive SQL, truncate tables, drop columns, or weaken RLS as a shortcut.
- Do not use the Supabase service-role key in the browser.
- Verify user ownership and guest-to-account migration behavior whenever persistence code changes.

## 8. Verification checklist

For UI changes:
- [ ] Check 320px, 360px, 390px, 430px, 768px, 1024px, and desktop widths.
- [ ] Check for horizontal scrolling and clipped content.
- [ ] Check browser zoom/scale and input focus behavior.
- [ ] Check keyboard-open and keyboard-closed states on mobile when possible.
- [ ] Check safe-area spacing and dialog scrolling.
- [ ] Check keyboard navigation, labels, and focus visibility.

For account changes:
- [ ] Guest state still works.
- [ ] Signed-in display name uses available profile metadata.
- [ ] Email fallback is readable.
- [ ] Full email is visible in account details, including long addresses.
- [ ] Sign-up, sign-in, verification resend, sign-out, and session restoration remain intact.

For Calkie changes:
- [ ] Opens and closes without route changes or page reload.
- [ ] Dashboard remains mounted underneath the overlay.
- [ ] History loads and remains visible after closing/reopening.
- [ ] Provider and model selectors work.
- [ ] Suggestions and Enter-to-send work.
- [ ] Sending, error, and loading states remain usable.
- [ ] Mobile keyboard does not unexpectedly open on launch.

For diary and AI changes:
- [ ] Manual add, edit, and delete work.
- [ ] Text estimate and review-before-save work.
- [ ] Photo estimate, progress/cancel, and review-before-save work.
- [ ] Provider selection and fallback remain intact.
- [ ] Daily totals, macros, meal breakdown, weekly consistency, and goal editing remain correct.
- [ ] Local storage and cloud sync behavior remain intact.

## 9. Git and release conventions

- Keep commits focused and use imperative messages, for example: `Fix mobile account profile display`.
- Do not force-push or rewrite shared history.
- ALWAYS work directly on main. Fetch and sync origin/main before starting; make changes on local main and push directly to origin/main after verification. Do not create feature/fix branches, worktrees, or pull requests unless the user explicitly overrides this rule.
- Do not deploy an unbuilt or unverified change when a build check is available.
- If a check cannot be run, say so clearly and do not describe it as passing.
- If production deployment fails, keep the last known-good deployment intact and report the failure; do not claim the release is live.

## 10. Completion report

Every completed task should report:
- Root cause.
- Files changed and why.
- User-visible behavior changed.
- Checks actually run and their results.
- Tests not run and why.
- Commit SHA and link.
- Deployment URL and terminal status, if deployment was requested.

Accuracy is more important than a green-looking report. Never claim a feature, test, commit, or deployment succeeded unless the corresponding result was observed.


---

## 11. Verified project handoff ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-19

This section is the shared continuation record for all coding agents. Update it whenever work is completed, deployed, or blocked.

### Current verified repository state

- Repository: `AravindSAsok/tracKcake`
- Production branch: `main`
- Main HEAD at audit start: `fcb81d2bedc944a4fe10d538c875f2120d3d93c8`
- Production URL: https://trackcake.vercel.app
- Framework: Astro 5 + TypeScript; Vercel server deployment.
- Data/auth: Supabase Auth + PostgreSQL + RLS; local browser-storage fallback.
- AI providers: Groq, Gemini, OpenRouter.
- Nutrition sources: Open Food Facts and USDA FoodData Central; optional Gemini Google Search grounding, disabled by default.
- Existing full contributor/architecture rules remain in this file. Read this file before touching application behavior.

### Work previously reported (historical; not freshly re-tested in this audit)

- Nutrition research lookup was implemented and locally checked on branch `feat/nutrition-research-lookup`, commit `84c6b84f3f3195641d21d537f8f703ab000339b1`. The branch is now an ancestor of `main` (zero commits ahead), so this work is already represented in main's history.
- Earlier local verification was reported as `npm run check` and `npm run build` passing for that feature. Do not treat this as a fresh verification of current main.
- An earlier Vercel preview deployment for that work was reported failed with inaccessible logs. Re-check Vercel before making any current deployment claim.
- Production environment still needs confirmation for `USDA_FDC_API_KEY`; without it the app uses USDA's limited public DEMO_KEY.
- Gemini Google Search grounding must remain disabled unless explicitly enabled after reviewing current provider pricing/limits.

### Branch inventory from GitHub audit

At audit time there were 15 branches total (main + 14 topic branches), and zero open pull requests.

| Branch | Commits ahead of main | Files changed vs merge base | Audit note |
|---|---:|---|---|
| `docs/configure-trackcake-auth-smtp` | 1 | `docs/auth-email-delivery.md` (new) | Documentation-only; candidate for safe merge after PR check. |
| `feat/account-recovery-auth-feedback` | 6 | `src/pages/index.astro`, `src/scripts/ai-account.ts`, `src/styles/global.css` | Stale/diverged; overlaps account UI. Review before merge. |
| `feat/edit-delete-todays-food` | 2 | `src/scripts/app.ts`, `src/styles/global.css` | Stale/diverged; overlaps diary UI. |
| `feat/food-row-action-menu` | 3 | `src/pages/index.astro`, `src/scripts/app.ts`, `src/styles/global.css` | Stale/diverged; overlaps diary UI and another UX branch. |
| `feat/in-session-password-reset` | 4 | `src/pages/index.astro`, `src/scripts/ai-account.ts`, `src/styles/global.css` | Stale/diverged; overlaps account UI. |
| `feat/nutrition-research-lookup` | 0 | none | Already ancestor of main; no merge needed. |
| `feature/trackcake-android-wrapper-ui` | 0 | none | Already ancestor of main; no merge needed. |
| `fix/android-webview-camera-file-chooser` | 5 | Android workflow/build/manifest/MainActivity/file paths | Stale/diverged; Android-specific; verify against current Android project before merge. |
| `fix/complete-password-reset-flow` | 2 | `src/scripts/ai-account.ts` | Stale/diverged; overlaps password recovery branches. |
| `fix/food-entry-preservation-and-smart-meals` | 7 | `src/lib/store.ts`, `src/pages/index.astro`, `src/scripts/app.ts`, `src/styles/global.css` | Stale/diverged; high-risk data/storage and diary overlap. |
| `fix/food-history-10-per-page` | 2 | `src/lib/store.ts`, `src/scripts/app.ts` | Stale/diverged; overlaps history pagination. |
| `fix/food-history-pagination` | 2 | `src/lib/store.ts` | Stale/diverged; overlaps history/storage. |
| `fix/password-reset-rate-limit-feedback` | 1 | `src/scripts/ai-account.ts` | Stale/diverged; overlaps password recovery branches. |
| `ux/todays-food-row-actions-menu` | 1 | `src/pages/index.astro` | Stale/diverged; overlaps food-row action UI. |

Important: branch "ahead" counts are commits not reachable from main, not proof that the user-visible behavior is absent from main. The branches are based on older histories (main is hundreds of commits ahead of their merge bases). Do not merge stale branches blindly or force-update/delete them. Compare their intent and code with current main first; preserve useful changes by selectively porting only what is still missing.

### Current task status (2026-11-19)

- [x] Confirmed current main branch and HEAD.
- [x] Enumerated all remote branches.
- [x] Confirmed there are no open PRs.
- [x] Consolidated all agent instructions into the single uppercase AGENTS.md and removed lowercase agent.md.
- [x] Add uppercase `AGENTS.md` entry point and keep this detailed guide as the source of truth.
- [x] Review all 12 stale topic branches against current main using Git merges with the ours conflict preference; no resulting source-tree changes remained versus the audited main tree.
- [x] Merge all 14 topic branch histories into main; two were already ancestors and the other 12 now have merge commits. Main source tree remained unchanged by these merges, confirming the feature code was already present in main.
- [x] npm ci completed with package-lock.json under Node 22.23.4.
- [x] Verify Vercel production deployment for the nutrition matching fix. [ ] Complete signed-in auth/recovery with a dedicated test account and inbox.
- [x] Verify nutrition matching after the latest fix using the configured provider and USDA DEMO_KEY. [ ] Add a production USDA_FDC_API_KEY to avoid DEMO_KEY rate limits.

### Instructions for the next agent

1. Read this complete AGENTS.md before changing code.
2. Always work directly on latest main; do not create feature branches or PRs unless the user explicitly asks.
3. Review current source and tests before porting any branch work.
4. Prioritize data integrity, Supabase RLS/auth, and preserving existing food diary entries.
5. Keep Google Search grounding off by default.
6. Do not expose credentials or use production user data for tests.
7. Record each phase, exact files, checks, commit SHA, deployment ID/status, and remaining blockers in this AGENTS.md.
8. Do not mark a task complete unless the corresponding behavior was actually tested.


### Merge review update Ã¢â‚¬â€ 2026-11-19

- All 14 topic branch histories were merged into main; two were already ancestors and 12 merge commits were created.
- The merged tree is identical to the original main tree; branch code was already represented in current main.
- One canonical instruction file remains: AGENTS.md. The lowercase agent.md file was removed.
### Consolidation execution update Ã¢â‚¬â€ 2026-11-19

- Working copy: D:\AI-Projects\TrackCake, checked out on main.
- All 14 remote topic branch histories were merged into local main. Twelve merge commits were created; feat/nutrition-research-lookup and feature/trackcake-android-wrapper-ui were already ancestors.
- The merge strategy preferred current main on conflicting hunks. The final tree comparison against the original remote main (git diff origin/main..HEAD) was empty; the feature code was already represented in main.
- Created package-lock.json because the repository had no lockfile and the machine-level npm config had package-lock=false. This enables the requested reproducible npm ci workflow.
- The local machine's Node 22.23.4 is the project's required runtime; Node 24 was initially selected by the remote execution environment, so PATH was explicitly adjusted to Node 22 for verification.
- npm install reported 11 dependency audit findings (1 low, 3 moderate, 6 high, 1 critical). Do not run npm audit fix --force without reviewing breaking changes.
- Final check/build, Vercel deployment verification, and authenticated browser smoke tests are pending and must be recorded below after they run.


### Verification results Ã¢â‚¬â€ 2026-11-19

- Runtime used: Node v22.23.4 (matches the project engine).
- npm ci: PASS; 457 packages installed from the newly generated lockfile.
- npm run check: PASS; 0 errors, 0 warnings, 2 hints. Hints: unused ProviderResult type in src/pages/api/estimate.ts and unused currentMeal function in src/scripts/app.ts.
- npm run build: PASS; Astro server and Vercel output generated successfully.
- Dependency audit during install: 11 findings (1 low, 3 moderate, 6 high, 1 critical). No automatic force-fix applied.
- Not yet verified: real signed-in signup/sign-in/password-reset email flows and multi-page history pagination. These require a dedicated test account and inbox; do not mark them complete based on UI rendering alone.
### Production smoke-test findings and nutrition correction â€” 2026-11-19

- An isolated headless Chrome profile was used against https://trackcake.vercel.app. No existing account was used and no real user data was entered.
- Guest manual food add: PASS. A unique QA item appeared in today's timeline and food history.
- Guest edit: PASS. The QA item name, portion, and calories updated in local storage and the history UI.
- Guest delete: PASS. The app displayed "Food entry deleted"; the QA item was removed from local storage, today's timeline, and history. No QA item remains.
- Account UI: sign-up, sign-in, and forgot-password modes rendered and toggled. Actual signup/sign-in, verification email, and password-reset email delivery were NOT tested because no test inbox/account was connected.
- History: one-entry history rendering and navigation controls were visible; multi-page pagination is not yet verified.
- Provider status endpoint: PASS (HTTP 200); Groq, Gemini, and OpenRouter all reported configured and reachable.
- Nutrition lookup quality test initially FAILED: "1 medium banana (about 118 g)" was matched to "Bananas, dehydrated, or banana powder" (408 kcal). The USDA search returned both raw and processed banana candidates with equal token-overlap scores; the first result won.
- Targeted correction made in src/lib/nutrition-research.ts: when the requested item is fresh produce and no preparation is specified, score down dehydrated/dried/powder/chips/nectar/pudding and cooked variants, and favor raw matches.
- Post-fix npm run check: PASS (0 errors, 0 warnings, 2 hints). Post-fix npm run build: PASS under Node 22.23.4.
- The nutrition fix was pushed to main as d2b957d06907f075a7ffaf3e828a55237885e0ff and deployed successfully. Production retest passed: the same banana request now returns 114 kcal with USDA description Banana, raw (FDC 2709224).
- TinyFish browser automation could not start because its separate wallet balance was negative. Local isolated Chrome/CDP was used instead.
### Final production verification — 2026-11-19

- Main HEAD: d2b957d06907f075a7ffaf3e828a55237885e0ff.
- All 14 topic branches compare as ahead_by=0 against main; their remote refs remain as historical branches, but every branch commit is now an ancestor of main. Agents must continue using main only.
- Vercel production deployment: READY, deployment ID dpl_2bG1qmhV3ELDPYWSPhtxCxbx1oHj, commit d2b957d06907f075a7ffaf3e828a55237885e0ff. Production alias trackcake.vercel.app is attached.
- Production home page returned HTTP 200.
- Production provider-status endpoint returned HTTP 200; Groq, Gemini, and OpenRouter each reported configured=true and ok=true.
- Production nutrition retest: POST /api/estimate for 1 medium banana (about 118 g) returned 114 kcal, nutrition source USDA FoodData Central, matched description Banana, raw, FDC ID 2709224. PASS.
- Production environment inventory shows USDA_FDC_API_KEY is not configured. The successful lookup used DEMO_KEY; add a proper key when available to avoid demo quota limits.
- Guest UI tests in isolated Chrome: manual add PASS; edit PASS; delete PASS; QA record absent after deletion and after reload. History rendering showed the saved QA item and Page 1 of 1 before deletion.
- Auth UI tests: sign-up, sign-in, and forgot-password modes rendered and switched correctly. Real authentication, verification delivery, and password-reset email receipt remain untested without a dedicated test account/inbox.
- Multi-page history pagination remains untested. Single-page history rendering and page controls were observed.
- npm ci, npm run check, npm run build all pass under Node 22.23.4; check has 0 errors, 0 warnings, 2 existing hints.
- One canonical instruction file: AGENTS.md. Lowercase agent.md is deleted. package-lock.json is committed.
- The local working copy at D:\AI-Projects\TrackCake is synchronized to origin/main and clean.

---

## 12. Critical clarification: main-only development and real feature porting

**The only working and delivery branch is `main`.** Every agent must make application-code changes directly in the repository's `main` branch and commit/push those changes to `main` after verification.

Mandatory rules:

1. Start by fetching the latest `origin/main` and working on the local `main` branch. Confirm the branch before editing and before committing.
2. Never create, switch to, or develop on a feature/fix/topic branch or a worktree. Never open a PR as a substitute for direct work on `main`, unless the user explicitly changes this instruction.
3. If a requested feature or fix exists only in an old branch, inspect that branch remotely and selectively port the required source changes into the current `main` working tree. Do not check out that branch. Do not merge stale branch histories just to make their commits ancestors of `main`.
4. **A merge commit, an ancestor relationship, or `ahead_by=0` is not proof that the feature code is present.** Verify the actual implementation in current `main` source files and tests, then run the relevant behavior tests.
5. Never use `git merge -s ours` (or an equivalent strategy that discards the other side's code) to claim a feature was merged or ported. If a merge is necessary for an explicitly requested history operation, separately inspect and port every required code change.
6. Before declaring a branch's work complete, create a feature-by-feature checklist: branch intent, files/commits containing the implementation, whether equivalent behavior exists in current `main`, exact code/tests ported, and verification result. Mark items as missing or unverified when evidence is incomplete.
7. Keep all changes, commits, and pushes directly on `main`. If direct push is blocked by permissions/protection, stop and report the blocker; do not silently use another branch or PR.
8. After each task, confirm the commit is on remote `main`, the working tree is clean, checks pass, and the deployment corresponds to that commit when deployment is part of the task.

### Correction to the 2026-11-19 branch-consolidation record

The earlier statement that the 12 stale branches' feature code was already represented in `main` was too strong. Their histories were connected to `main`, but the merge strategy preferred the existing `main` tree and the resulting source tree did not change. That history operation alone did **not** prove that the branch implementations were ported. Treat the branch feature inventory above as requiring a source-level audit and selective port into `main`; do not report those feature tasks complete solely because branch refs are ancestors of `main`.


## 13. AI model benchmark allowlist — 2026-11-19

- Benchmark source: `benchmark.md`, run `44328509966`, completed 2026-11-18 against production using one sequential end-to-end `POST /api/estimate` smoke test per discovered model.
- 393 distinct provider/model entries were tested: 11 returned valid nutrition results; 382 failed or were unavailable. This is a single-prompt smoke test, not a universal accuracy ranking or a guarantee of continuing availability.
- The 11 benchmark-passed models are:
  - Groq (3): `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`.
  - Gemini (5): `gemini-flash-lite-latest`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`.
  - OpenRouter (3): `baidu/ernie-5.5-flash-preview:free`, `particle-ai/particle-1:free`, `nvidia/nemotron-3.5-super-vl:free`.
- Changed `src/pages/api/provider-status.ts` to intersect the benchmark-passed allowlist with each provider's live catalogue. The model selector clients (quick estimate and Calkie) consume this endpoint, so only currently listed benchmark-passed models appear. The response reports `benchmarkTestedAt: 2026-11-18` and per-provider filtered counts.
- Commit: `e0ac352dc3ad4159d3da1be722f0a261d38d434d` (`Show only benchmark-passed AI models`), pushed directly to `main`.
- Production deployment: `dpl_1s4m1oFcVQQn4oakPfxJmnt9xdRx`, READY; production alias `trackcake.vercel.app`; Vercel status check PASS.
- Production endpoint smoke test on 2026-11-19: `/api/provider-status` returned HTTP 200, all 3 providers configured/reachable, and exactly 3 Groq + 5 Gemini + 3 OpenRouter models (11 total). The provider catalogues still list all 11 allowlisted IDs.
- Limitation: the 11 individual model generation calls were run on 2026-11-18, not repeated after this UI allowlist change. Re-run the benchmark periodically to refresh the allowlist. No per-model live generation test was run during the 2026-11-19 deployment verification.


## 14. Fresh model smoke test — 2026-11-19

- Workflow run: `44560753359` (GitHub Actions; completed successfully).
- Test query: `milk coffee`; one `POST /api/estimate` was sent for each of the 11 models in the then-current allowlist.
- The benchmark harness was defective: `/api/estimate` returns Server-Sent Events, while `scripts/benchmark-models.mjs` called `response.json()`. The script incorrectly marked all HTTP 200 responses as successes and captured no food items/calories/macros. The original 11/11 count is invalid.
- Vercel runtime logs were used to inspect the actual model selected in each request. Direct generation results: Groq 3/3 passed; Gemini 4/5 passed; OpenRouter 2/3 passed; total 9/11.
- Failed direct models:
  - Gemini `gemini-3.1-flash-lite`: timed out at approximately 30 seconds. The endpoint then fell back to `gemini-flash-lite-latest`; fallback success does not count as a pass for the requested model.
  - OpenRouter `particle-ai/particle-1:free`: provider returned an error. The endpoint then fell back to `baidu/ernie-5.5-flash-preview:free`; fallback success does not count as a pass for the requested model.
- Removed those two failing models from `src/pages/api/provider-status.ts`. The app should now expose only 9 models, intersected with the provider's current live catalogue.
- Corrected `benchmark.md` to show 9/11 direct generation passes and explicitly document that nutrition output was not captured by the defective harness.
- Before the next benchmark, fix `scripts/benchmark-models.mjs` to parse SSE `progress`, `complete`, and `error` events, and add strict-model mode so benchmark requests cannot silently fall back. Count a pass only when `complete.provider` and `complete.model` match the requested pair and a non-empty `items` array is returned.
- Do not claim calorie/macro accuracy from this run; only generation availability was verified.

### OpenRouter-only model smoke test — 2026-11-19

- User-requested prompt: `apple`.
- Scope: live OpenRouter free text-generation models only; no Groq/Gemini requests and no paid model IDs.
- The benchmark discovers the live OpenRouter catalogue through the server-side provider-status endpoint and filters model IDs ending in `:free`.
- A strict single-model option in `/api/estimate` prevents fallback to other OpenRouter models or other providers. Strict smoke tests skip nutrition research so this measures model generation + TrackCake JSON validation only.
- The benchmark parser reads the endpoint's SSE events and counts a pass only when it receives a `complete` event with at least one valid item; HTTP 200 alone is not sufficient.
- OpenRouter no-credit free-model daily allowance is limited, so each run is capped at 50 requests. This run discovered only 13 eligible free text models and tested all 13 once each, without retries.
- Verified result: **6/13 passed**.
  - Passed: `baidu/ernie-5.5-flash-preview:free`, `recursive/flint-v1.0:free`, `nvidia/nemotron-3.5-super-vl:free`, `cohere/north-mini-code:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`.
  - Failed: `inclusionai/ling-3.2-flash:free` (provider error), `liquid/lfm-3-1.7b:free` (9-second request timeout), `particle-ai/particle-1:free` (provider error), `dots-studio/dots-3-note-preview:free` (9-second request timeout), `nvidia/nemotron-3.5-lightning:free` (empty response), `google/gemma-4-26b-a4b-it:free` (provider error), `google/gemma-4-31b-it:free` (provider error).
- Benchmark report: `benchmark.md`; GitHub Actions run: https://github.com/AravindSAsok/tracKcake/actions/runs/44564110062 (completed successfully).
- Files changed for this task: `src/pages/api/provider-status.ts` (opt-in full free text catalogue), `src/pages/api/estimate.ts` (strict single-model test mode), `scripts/benchmark-models.mjs` (OpenRouter-only apple test and SSE validation), `.github/workflows/benchmark-models.yml` (wait for deployment, run test, publish one final report).
- Vercel production deployment for the tested code: commit `7800e015f15f75bcfcb1c4b5b92663a959aeac50`, deployment `dpl_EF6kkUXNqzaFEAJAa7ZN1hJ6Qbz6`, state READY. GitHub Astro build for that commit passed.
- This is a smoke test of response availability and valid TrackCake output, not a nutrition accuracy benchmark. The allowlist used by the app was not broadened by this test.


## AI model approval and fallback policy — 2026-11-19

- Canonical model allowlist: `src/lib/ai-models.ts`. Do not duplicate provider model IDs in UI/API code.
- `VERIFIED_MODELS` is the only source for selectable text models and text-generation fallback candidates. Provider catalogues are used only to confirm that an allowlisted model is still currently offered; never append arbitrary catalogue entries to a user's selector or fallback chain.
- The estimate endpoint must validate explicit model IDs against the allowlist and must use live catalogue presence for normal requests. Its strict benchmark mode calls exactly one allowlisted model and must not fall back.
- Calkie's `/api/assistant` must use the same allowlist. A selected model is tried first, followed by approved models in provider priority order, including other configured providers.
- Image analysis has a separate `VERIFIED_VISION_MODELS` allowlist. A text-only model must never be sent an image. Do not promote a model to the vision list without a successful image-input test.
- Environment model overrides must not bypass the registry.
- Existing registry entries are based on prior successful provider-response/schema checks. This is not a claim that every model has been repeatedly validated for nutrition accuracy. Before adding new candidates, run isolated exact-model tests with non-empty structured output, repeat tests to detect intermittent failures, and separately review nutrition quality against a fixed reference dataset.
- Keep the user's model preference first, but fall back only to currently available, allowlisted models. Report the actual provider/model used.

### Production model recheck — 2026-11-19

- Production was tested with strict single-model requests; the exact model is known and no fallback can mask a failure.
- Current registry decision: 3 Groq models and 2 OpenRouter models remain approved. Gemini has no approved models for now: its only simple-prompt pass timed out on the mixed-meal prompt and then returned a provider high-demand error on retry; the other three Gemini candidates also failed current checks.
- Detailed per-model timings and outputs are recorded in `docs/ai-model-validation-2026-11-19.md`.
- Strict tests skip nutrition research. They verify provider response, item schema, portions and non-empty macro fields, but do not prove nutrition accuracy. Raw calorie estimates varied across models; keep the nutrition research layer and review final results separately.
- The model selectors disable providers that currently have no configured, live, approved models. Do not re-enable Gemini until it passes repeated simple and mixed-meal checks.

---

## Live nutrition web research implementation update — 2026-11-20

### Implemented on main
- Added `src/lib/web-research.ts` for server-side Firecrawl v2 web search and page extraction.
- Integrated Firecrawl into the shared `researchNutrition` pipeline, so text estimates and photo estimates use the same source order.
- Lookup order is Open Food Facts → USDA FoodData Central → Firecrawl live web research → optional Gemini Google Search grounding → clearly labelled AI estimate.
- Firecrawl research is optional and requires the server-side `FIRECRAWL_API_KEY`.
- Firecrawl is limited to the first three unmatched foods per meal. It is skipped when the portion cannot be scaled from a supported gram/ml quantity.
- Extracted values are accepted only when all four nutrition values, a per-100 g/ml basis, a matching food name, page content, and an HTTPS source URL are present and pass bounds checks.
- Source links and nutrition labels use the existing review UI fields; no database migration or browser-side provider key was introduced.
- Updated `.env.example` and README setup, architecture, and privacy documentation.

### Deliberate scope decisions
- A separate Browserless/Playwright service was not added. Firecrawl's search-and-scrape endpoint already handles page rendering/extraction, while a second browser service would add credentials, cost, and another external dependency without demonstrated need. Revisit only if real target sites cannot be read by Firecrawl.
- Gemini Google Search grounding remains disabled by default.
- No database schema changes were needed.

### Verification status
- [x] Confirmed the existing text and photo endpoints both call the shared nutrition research function.
- [x] Confirmed the existing review UI renders the source label, basis, and source link.
- [x] Added server-side Firecrawl module and shared pipeline integration.
- [x] Documented `FIRECRAWL_API_KEY` and live research behavior.
- [ ] Run `npm run check` and `npm run build` against this exact main commit.
- [ ] Configure `FIRECRAWL_API_KEY` in Vercel Production and Preview environments.
- [ ] Verify a live Firecrawl request with a configured key and inspect the resulting source attribution.
- [ ] Verify the resulting Vercel deployment and production smoke test.

Do not mark live web lookup or deployment as production-verified until the pending checks above are completed.


### Verification closeout — 2026-11-20

- Final implementation commit checked: `12523f2f2a3e79aca444bbf87f6a75977129125b`.
- GitHub Actions: [Build Astro app run #212](https://github.com/AravindSAsok/tracKcake/actions/runs/44770788403) completed successfully. Dependency install, `npm run check`, and `npm run build` all passed.
- Vercel Production deployment: `dpl_EDdvStinksfXCfbciYhTPEa1vwfo`, state `READY`, deployed from the exact implementation commit. Production aliases include https://trackcake.vercel.app.
- Production smoke test: fetched the live dashboard successfully; page title was `trackcake — Your food, in focus` and the dashboard rendered.
- Firecrawl API integration was validated against the official v2 API documentation and the documented `data.web` response shape. The Firecrawl connector also returned structured JSON plus markdown for a test nutrition search.
- **Activation blocker:** Vercel Production does not currently contain `FIRECRAWL_API_KEY`. The deployed code safely skips Firecrawl until the user adds this secret in Vercel Project Settings → Environment Variables (Production), then redeploys. No API key was requested or exposed in chat.
- The app's existing Open Food Facts and USDA sources continue to work ahead of Firecrawl. Google Search grounding remains disabled by default.
- No Browserless/Playwright service was added because Firecrawl already provides the needed browser-backed search and extraction path; revisit only if real sources prove inaccessible.
- A live Firecrawl request from the deployed TrackCake backend, authenticated-user diary flow, and per-food end-to-end nutrition verification remain untested until the Production API key is configured.


---

## Gemini user-test enablement — 2026-11-20

- User explicitly requested that Gemini be turned on so they can test it in the app, even if the mixed-meal retest is not yet conclusive.
- Updated `src/lib/ai-models.ts` to add only `gemini-flash-lite-latest` to the text-model allowlist.
- This model passed the prior strict single-model simple-food test (`apple`, 13.0 s) but failed the mixed-meal test twice (30.1 s timeout, then provider high-demand response). It is therefore enabled provisionally for user testing, not certified reliable or nutrition-accurate.
- Gemini remains text-only; no Gemini model was added to `VERIFIED_VISION_MODELS`.
- Provider selector still requires a configured Gemini key and confirms the model is present in Gemini's live model catalogue before displaying it.
- No new Gemini generation request was run during this change. Verify in the app and capture real test results before calling it stable.
- Implementation commit: `f088c7945443f21d435a5b1fb6d43a5b79a72d6e`.
- Documentation commit: pending verification in this update.
- Run `npm run check`, `npm run build`, verify GitHub Actions, and confirm the Vercel Production deployment before marking complete.

### Firecrawl usage notes checked against official docs — 2026-11-20

- Free plan: 1,000 credits per month, reset each billing cycle; unused credits do not roll over.
- Search: 2 credits per 10 results (rounded up); optional scraping of search results adds per-page scrape costs.
- Scrape: 1 credit per page.
- Free-plan rate limits: 10 requests/minute for Search, Scrape, and Map; 2 requests/minute for Crawl, Agent, and Interact.
- Free plan stops with HTTP 402 after credits are exhausted; no automatic pay-as-you-go on Free.
- API keys on one Firecrawl team share the team's rate-limit counters. Per-key credit spend limits can be configured in the Firecrawl dashboard.
- Official references: https://docs.firecrawl.dev/billing and https://docs.firecrawl.dev/rate-limits.
- TrackCake's current Firecrawl integration caps live lookup at the first three unmatched foods per meal. Actual credit use depends on search result count and how many pages are scraped; inspect usage at https://www.firecrawl.dev/app.

---

## User-triggered Firecrawl research workflow — 2026-11-20

- Product decision: conserve Firecrawl credits. Firecrawl must never run automatically during ordinary text or photo food estimation.
- Added the **Live web search** button to the quick food entry controls. It is an explicit action and calls the server-only `/api/web-research` endpoint.
- The endpoint calls Firecrawl Search with up to four results, returns raw scraped Markdown and safe HTTPS source URLs, and does not ask Firecrawl to produce nutrition JSON.
- Added a source-review popup that displays each scraped page in a collapsible source section, including its title and source link.
- The user must tap **Use AI to Save Data** to send reviewed page content to the selected/available AI provider. The AI uses a strict extraction prompt: it must not invent, calculate, or combine missing nutrition values. Each structured record must include all macros and cite one of the source URLs from the reviewed result set.
- AI-structured values are passed into the existing food review dialog; the user still edits and explicitly saves the food to the diary. No automatic diary writes occur.
- Normal researchNutrition no longer calls Firecrawl. Existing Open Food Facts and USDA matching remain unchanged; optional Gemini Google Search grounding remains off by default.
- Added researchOnly mode to /api/estimate to reuse existing provider/model fallback and JSON parsing without invoking database nutrition lookup. Source title, basis, and URL metadata are preserved in the response.
- Files changed: src/pages/api/web-research.ts (new), src/pages/api/estimate.ts, src/pages/index.astro, src/scripts/app.ts, src/lib/nutrition-research.ts, src/styles/global.css, README.md.
- Security: API key remains server-side; scraped content is rendered as escaped text; source URLs are HTTPS-only; model output URLs must match the reviewed source URL list; provider errors do not expose API keys.
- Verification: GitHub Actions run #228 for commit 9a8997aadfd71238568f6b02cf77f7593f05274e completed successfully. Its `Check Astro and TypeScript` and `Build production app` steps both passed. Vercel Production deployment dpl_DYkJkKMH9dCxoiMGWjWQPNNsBz3x for the same commit reached READY and retains the `https://trackcake-git-main-kukki.vercel.app` branch alias. Manual authenticated browser testing of Firecrawl search, AI structuring, and diary save remains outstanding; do not claim those flows were manually smoke-tested.
- Commit history for this task: implementation changes were committed directly to main in sequential commits, latest code commit before this handoff: f62c3747121cb0b0ae9504a54c9428e7d5ab4286. Follow-up documentation update will record final verification.
- Follow-up credit cap: each explicit Live web search returns at most three scraped pages (not four). The earlier 2026-11-20 Firecrawl implementation note describing automatic lookups for three unmatched foods is superseded by this opt-in workflow.


---

## Nutrition research reliability update — 2026-11-20

### Implemented on main

- Firecrawl live research remains explicitly user-triggered; ordinary text/photo nutrition estimates do not invoke Firecrawl.
- `src/pages/api/web-research.ts` now limits each search to at most two candidate pages (previously three).
- Search queries now explicitly request calories, protein, carbohydrates, total fat and serving size.
- Candidate pages are filtered before being returned: the page must contain at least three nutrition metric categories, a numeric nutrition value with a recognized unit, and the requested food terms.
- Returned page content is reduced to nutrition-focused lines and immediate context, capped at 4,200 characters per source. Unrelated article sections and recipe galleries are not sent to the browser or AI.
- `src/scripts/app.ts` now describes the content as compact nutrition-focused excerpts and caps the combined AI research payload at 9,000 characters (previously 22,000).
- The existing review-before-save workflow and selected provider/model flow are preserved.
- `README.md` documents the new two-page and compact-evidence behavior.

### Important limitations / next phases

- This is a first reliability and payload-size pass, not the complete Nutrition Engine V2 blueprint.
- Deterministic numeric extraction into a structured nutrition object, source/serving-basis reconciliation, ingredient decomposition, and a reusable approved-food catalog are not yet implemented.
- The relevance filter is deliberately conservative and may reject useful pages when the exact food wording is absent. Users can retry with a more specific food name or brand.
- No Firecrawl credits were spent during implementation or verification.
- Automated tests, TypeScript check, production build, GitHub Actions and Vercel deployment must be verified for the resulting commit before this work is described as released.


---

## Nutrition Engine V2 execution plan prepared — 2026-11-20

- Added `NUTRITION-ENGINE-V2-EXECUTION.md` as the one-shot, task-specific implementation brief for the complete Nutrition Engine V2.
- The plan covers deterministic nutrition extraction, serving/unit normalization, reusable approved-food catalog, ingredient-based calculations, evidence confidence/status scoring, constrained AI fallback, UX integration, API/security safeguards, automated tests, documentation, and direct-main release verification.
- The plan explicitly preserves the existing review-before-save workflow and requires Firecrawl to remain user-triggered only, capped at two candidate pages, with no Firecrawl credit spend in automated tests.
- This commit adds planning documentation only. No application code, database schema, or production behavior was changed; none of the planned features should be considered implemented.
- Execution starts only after the project owner explicitly asks an agent to read and execute the plan.
- Plan: https://github.com/AravindSAsok/tracKcake/blob/main/NUTRITION-ENGINE-V2-EXECUTION.md


---

## Nutrition Engine V2 execution — 2026-11-20

### Implemented in this delivery (verification pending)

- Added `src/lib/nutrition-engine.js` plus TypeScript declarations. It provides strict numeric/unit parsing, serving-basis detection, deterministic extraction from labelled text and Markdown nutrition tables, same-basis scaling, explicit-quantity parsing, deterministic recipe totals, exact/alias/barcode catalogue matching, and evidence-quality scoring.
- Extraction rejects unresolved numeric ranges, ambiguous thousands-style decimal commas, duplicate conflicting values, unsupported units, and rows containing multiple nutrition-column values.
- Updated `src/lib/nutrition-research.ts` to use the shared normalization and confidence helpers. Generic ml↔g density assumptions were removed; a value is scaled only when source basis and requested quantity use the same unit.
- Added lookup of approved shared catalogue records through Supabase's public Data API. Results are cached in the server process for five minutes. The query selects only approved records; external provider lookups remain fallback paths.
- Added additive migration `supabase/migrations/202611200001_nutrition_catalog.sql`. The table has RLS enabled, read-only SELECT for anon/authenticated on approved rows, and no client write policies. It is intentionally empty until trusted records are curated.
- Updated `src/pages/api/estimate.ts`: a single explicitly quantified food can use approved catalogue / Open Food Facts / USDA source records before any AI provider call. If no source match exists, the existing provider/model fallback continues. Missing macro values are rejected rather than silently defaulted to zero.
- Updated `src/pages/api/web-research.ts` and `src/scripts/app.ts`: after the explicit Firecrawl search and source-review step, TrackCake attempts deterministic extraction first. A complete, non-conflicting same-basis result goes directly to the existing review dialog without an AI call. Conflicting or incomplete evidence continues through the existing selected AI provider flow.
- Firecrawl remains user-triggered only and capped at two candidate pages. No Firecrawl calls or credits are used by automated tests.
- Added `tests/nutrition-engine.test.mjs` and an `npm test` script; CI now runs the unit tests before Astro/TypeScript and production build checks.
- Updated README to document the actual pipeline and the current limitations.

### Scope still incomplete / must not be described as finished

- The recipe calculation core is implemented, but a user-facing ingredient/recipe editor and review workflow have not yet been integrated into the diary UI.
- The approved-food catalogue schema and lookup are implemented, but the catalogue contains no seeded records. It must be populated only with reviewed, traceable nutrition facts; no placeholder values were inserted.
- The deterministic Firecrawl parser supports explicit labelled text rows and Markdown tables. It does not yet cover every possible HTML/JSON-LD nutrition schema or all manufacturer label layouts.
- Source conflict handling currently rejects conflicting extracted values and sends the reviewed evidence to the existing AI fallback; a full cross-provider reconciliation UI is not implemented.
- The AI fallback is stricter about missing macro values and labels outputs as AI estimates / needs review, but a complete nullable nutrition schema with field-level uncertainty and ingredient evidence is not yet integrated end-to-end.
- Full regression coverage for all app flows, mobile/desktop browser smoke tests, and authenticated user testing remain outstanding.

### Verification and release log

- Current implementation changes were authored through GitHub Git Data API because the linked development laptop was offline; no local checkout or terminal was available in this session.
- `npm test`, `npm run check`, and `npm run build` have not yet been run locally. GitHub Actions will be checked against the exact pushed commit.
- The Supabase production migration is not yet applied in this log. Apply it only to TrackCake project `rdjjlwupwobyojmkaqau` after the migration file is committed, then verify the table, grants, RLS and advisors.
- No production data rows were modified or migrated.
- Commit SHA: pending.
- GitHub Actions: pending.
- Supabase migration verification: pending.
- Vercel Production deployment and alias verification: pending.


---

## Nutrition Engine V2 execution closeout — 2026-11-20

### Exact release

- Final implementation commit: `582c30c8e43956bce6ff45c549d4ec2e8caef04a`
- GitHub: https://github.com/AravindSAsok/tracKcake/commit/582c30c8e43956bce6ff45c549d4ec2e8caef04a
- GitHub Actions run #244: https://github.com/AravindSAsok/tracKcake/actions/runs/44785361282 — SUCCESS.
- CI results: `npm test` 11 passed / 0 failed; `npm run check` 0 errors / 0 warnings (2 existing hints); `npm run build` passed.
- Vercel Production deployment: `dpl_8xVq9oosymqZrM8b9Y8zBdcGYwxt`, READY, built from the exact final commit. Production aliases verified: `trackcake.vercel.app`, `trackcake-kukki.vercel.app`, and `trackcake-git-main-kukki.vercel.app`.
- Safe read-only production smoke check fetched `https://trackcake.vercel.app` successfully. No authenticated account or diary writes were used.
- Supabase project: `rdjjlwupwobyojmkaqau`. Migration `202611200001_nutrition_catalog` applied successfully.
- Verified policy: SELECT only for anon/authenticated where `is_approved=true AND approved_at IS NOT NULL`. Privileges verified: anon SELECT true / INSERT false; authenticated SELECT true / UPDATE false. Catalogue row count is 0 by design; no unverified or synthetic food facts were seeded.
- Supabase security advisor still reports pre-existing anonymous-session policies on `assistant_messages`, `food_entries`, `tracker_settings`, and `workout_plans`, plus leaked-password protection disabled. No nutrition_catalog anonymous-write policy was found. Performance advisor reports the new catalogue indexes as unused because the catalogue is currently empty; retain them for planned lookups.
- Firecrawl was not called during implementation, tests, or smoke checks. No Firecrawl credits were spent.
- No diary records or historical nutrition entries were changed.

### Verified implementation scope

- Deterministic parser and tests: labelled text rows, Markdown nutrition tables, supported units, kJ→kcal and mass-unit normalization, explicit serving basis, ambiguity/conflict rejection.
- Deterministic-first path: a single explicitly quantified text food tries the approved catalogue and structured OFF/USDA lookups before AI; reviewed Firecrawl excerpts use deterministic extraction first when a complete, same-basis, non-conflicting result is available.
- Removed generic ml↔g density assumptions from the structured scaling path.
- Approved-food reference table, RLS and read-only lookup are in place. It has no curated records yet.
- Recipe sum calculation helper and confidence scoring helper are implemented and covered by unit tests.

### Remaining work — do not mark Nutrition Engine V2 fully complete

- A user-facing ingredient/recipe editor, ingredient lookup orchestration, and recipe review/save UX are not implemented.
- The approved-food catalogue needs a curated, source-attributed seed/administration workflow before it can return matches.
- Deterministic extraction does not yet cover all HTML/JSON-LD and manufacturer-label layouts.
- Full cross-source reconciliation and field-level uncertainty UI are not implemented.
- AI fallback still uses the existing numeric result contract; full nullable per-field nutrition schema and ingredient/source evidence validation remain future work.
- The current 11 unit tests cover the deterministic core, not the complete app regression suite.
- Authenticated browser testing of text, photo, live web research, catalogue matches, and diary save remains outstanding. The production smoke check was unauthenticated/read-only.
- The linked development laptop was offline, so no local working-copy test run or interactive local browser session was possible. GitHub Actions provided the verified check/build/test run.

Status: core deterministic delivery released and verified; full one-shot plan remains partially complete.


---

## Nutrition Engine V2 recipe editor implementation — 2026-11-20

- Added the first user-facing recipe workflow in the existing food-entry UI. Users can enter 2–8 ingredients, one per line, with explicit g/ml quantities and a declared serving count.
- Each ingredient is sent separately through the existing `/api/estimate` route using the currently selected provider/model preference. That route retains its deterministic-first source lookup and existing AI fallback. No Firecrawl endpoint is called by this workflow.
- Added a pure `aggregateIngredientEstimates` helper that validates ingredient count, quantities, servings and macro values before calculating recipe totals and per-serving values.
- The calculated meal is presented as one editable item in the existing review dialog. Diary persistence remains behind the existing explicit Save to diary action. Ingredient breakdown is displayed during calculation and is not persisted as a new recipe data model.
- Household units are deliberately rejected because no defensible food-specific conversion is available in this workflow. Ingredient requests are sequential and capped at eight to bound provider usage.
- Files changed: `src/pages/index.astro`, `src/scripts/app.ts`, `src/styles/global.css`, `src/lib/nutrition-engine.js`, `src/lib/nutrition-engine.d.ts`, `tests/nutrition-engine.test.mjs`, `README.md`, `AGENTS.md`, and `NUTRITION-ENGINE-V2-EXECUTION.md`.
- Verification: GitHub Actions run #254 for final main commit `6f3623d76b4bae0aae1424c723c9e021fec34748` completed successfully. `npm test`: 13 passed / 0 failed; `npm run check`: 0 errors / 0 warnings (2 existing hints); `npm run build`: passed. The linked development laptop is offline, so interactive browser/device checks remain unavailable.
- Vercel Production deployment `dpl_6Zx8p2cpmwA1dYwW4a2BeY1C9PbV` reached `READY` from that exact commit. Verified production aliases: `trackcake.vercel.app`, `trackcake-kukki.vercel.app`, and `trackcake-git-main-kukki.vercel.app`. No authenticated diary or provider/Firecrawl end-to-end test was performed.


---

## Nutrition extraction format expansion — 2026-11-20

- Extended src/lib/nutrition-engine.js to read Schema.org JSON-LD nutrition records, including serving size and core calorie/protein/carbohydrate/fat values. Optional fiber, sugar, saturated fat and sodium values are retained when they carry supported units.
- Added deterministic HTML nutrition-table normalization. Table rows are kept separate before passing labelled values through the existing strict parser.
- Multiple complete JSON-LD candidates are accepted only when their serving bases and core values agree. Incomplete or conflicting candidates are rejected; the parser does not select an arbitrary candidate.
- Added regression tests for JSON-LD, HTML tables, incomplete records, and conflicting records.
- Final code commit: 8baff130641ea29338a014f18983d292e73ff417.
- GitHub Actions run #256: SUCCESS. npm test: 16 passed / 0 failed; npm run check: 0 errors / 0 warnings (2 existing hints); npm run build: passed.
- Vercel Production deployment dpl_2K4N6DFtZxzj7EXb4mRX1v3AtQqB reached READY from the exact code commit. Production aliases verified: trackcake.vercel.app, trackcake-kukki.vercel.app, and trackcake-git-main-kukki.vercel.app.
- No Firecrawl calls, production diary writes, or authenticated browser tests were performed. The linked development laptop remains offline; CI verifies code/build/tests, not interactive UI behavior.


## Execution log — source reconciliation and field-level uncertainty — 2026-11-20

- Added a deterministic source reconciliation helper. It compares calories and macros after each source has been normalized to the requested quantity, rejects incompatible g/ml bases, uses documented absolute/relative tolerances, retains the primary source values without averaging, and marks material differences as **Needs review**.
- The nutrition research pipeline now requests Open Food Facts and USDA results concurrently after the approved catalogue lookup and reconciles them when both return usable records. No source is represented as independently verified merely because an HTTP request succeeded.
- Added source conflict details and secondary-source comparison values to the existing review UI. AI outputs now carry explicit per-field uncertainty labels for calories, protein, carbohydrates and fat.
- Added regression coverage for agreement, material disagreement, incompatible serving units, and the no-averaging rule.
- Verification status for this change: pending GitHub Actions and Vercel Production deployment. Interactive authenticated browser testing remains unavailable in this execution environment; do not claim it passed.


## Execution log — source reconciliation and field-level uncertainty release — 2026-11-20

- Implementation includes deterministic cross-source comparison when both Open Food Facts and USDA return usable nutrition records for a request. The comparison happens after serving normalization, checks compatible g/ml basis, uses the greater of 5 kcal or 10% for calories and the greater of 0.5 g or 15% for each macro, and never averages source values.
- A conflict or incompatible serving basis downgrades the item to **Needs review** and exposes the secondary source's values, provenance and conflict reason in the review UI. The primary source values remain the editable starting values.
- AI-generated nutrition carries field-level uncertainty labels for calories, protein, carbohydrates and fat. Review mappings preserve the evidence metadata.
- Added tests for matching sources, conflicting values, incompatible bases and no-averaging behavior.
- Exact final implementation commit: `41c52d0f68d64d315bf978a3f8d41ebd2cf78899`.
- GitHub commit: https://github.com/AravindSAsok/tracKcake/commit/41c52d0f68d64d315bf978a3f8d41ebd2cf78899
- Vercel Production deployment: `dpl_2FWSNkrDoRM1ZqvZjrE9gPN6qyKQ`, state **READY**, built from the exact commit above. Production alias `trackcake.vercel.app` was verified to map to this deployment.
- Vercel build log reached `Build Completed` and `Deployment completed`; GitHub's combined commit status reports the Vercel check as success.
- Local `npm test` / `npm run check` could not be executed because this environment has no DNS/network route to clone the repository. The existing GitHub Actions workflow is configured to run `npm test`, `npm run check`, and `npm run build` on pushes to main, but its run/job result was not exposed by the available GitHub connector in this session. Do not report those commands as run or passed based on the Vercel build alone.
- No Firecrawl requests, AI provider requests, Supabase mutations, or diary writes were performed.
- Remaining limitation: the reconciliation path only compares two usable records returned for the same lookup. It does not establish that two different product identities are equivalent, and source-backed values remain subject to manual review.

---

## Nutrition Engine V2 continuation — 2026-11-20

### Implemented on main after the earlier partial-release handoff

- Added additive migration `202611200002_nutrition_recipe_history.sql`. It extends the approved catalogue with category, serving definitions, optional nutrients, provenance, supersession and review metadata, and creates `nutrition_recipes` with owner-scoped RLS and a unique diary-entry link.
- Applied the migration to Supabase project `rdjjlwupwobyojmkaqau`. The migration registry reports `nutrition_recipe_history`; a read-only information-schema query confirmed both `nutrition_catalog` and `nutrition_recipes` exist. No user records were read or changed.
- Added structured recipe persistence in `src/lib/store.ts`: validated local storage fallback plus authenticated Supabase CRUD/list operations scoped by `user_id`.
- Integrated recipe history into the recipe dialog: saved recipes can be retrieved, ingredient lines edited and recalculated, then saved against the existing linked diary row when available; deletion removes only recipe history and deliberately leaves the diary row unchanged. Added responsive controls in `src/styles/global.css`.
- Added `scripts/manage-nutrition-catalog.mjs` and the `nutrition:catalog` npm command for trusted admin validation/upsert. The script refuses malformed nutrition, unsupported bases, non-HTTPS provenance, invalid barcodes and duplicate input/existing identities. It requires a server-side service-role key only for the explicit upsert action. No catalogue records were invented or seeded.
- Added `src/lib/nutrition-ai-schema.js` plus its TypeScript declaration and regression tests. AI core values are required; optional nutrients are nullable; invalid values, invalid ingredient arrays, unsupported research citations and large calorie/macro inconsistencies are rejected. Server-derived uncertainty labels are applied field by field.
- Structured source-backed nutrition now reports field-level provenance labels after quantity scaling.
- Documentation updates are in progress; exact CI, check/build and production deployment verification are pending. Do not report this continuation as complete until CI and Vercel results are confirmed.

### Additional hardening and verification — 2026-11-20

- Added generic-food identity gating: USDA generic lookup is skipped for any item with an explicit brand or product name. Curated catalogue matching now requires brand parity unless an exact barcode match is supplied.
- Added mocked integration tests for Open Food Facts/USDA agreement, source conflicts (primary values retained; no averaging), and branded-product generic-lookup suppression.
- Added a reusable estimate API request validator with provider/model allowlisting, description limits, reviewed-source allowlisting and request-body size checks. Added tests without invoking paid AI providers.
- Added request-body size guards to text estimate, photo estimate and explicit Firecrawl research routes.
- Added reusable recipe record validation and tests for ingredient quantities, g/ml units, HTTPS source links, serving counts, and core nutrition values.
- Supabase read-only policy inspection confirms RLS is enabled on both nutrition tables. `nutrition_catalog` has approved-only SELECT for anon/authenticated; `nutrition_recipes` has owner-scoped SELECT/INSERT/UPDATE/DELETE policies for authenticated sessions.
- GitHub Actions on commit `d7fcb83c25d4de9c3cd9c5dfcff3548f316767c0`: 34 tests passed, 0 failed; `astro check` 0 errors and 0 warnings; production build completed.
- Remaining: authenticated browser/device testing is unavailable because no authenticated browser session is connected. The catalogue is still empty until a maintainer supplies and reviews actual source-backed records. Full live-provider fallback tests are not run to avoid paid API calls.

### Release verification blocker — 2026-11-20

- Latest verified source commit before this log: `7452d212d520bf0a7f10400a1dc4f82eaf51753f`. GitHub Actions passed: 34/34 tests, 0 Astro/TypeScript errors, 0 warnings, production build completed.
- A manual Vercel Production deployment was requested for that exact commit and rejected with HTTP 402 `api-deployments-free-per-day` (more than 100 deployments in the rolling day; retry-after 86400 seconds). No deployment was created for the final SHA.
- The mapped Vercel CLI fallback could not run because the connected Desktop Commander laptop is offline (last seen 130 hours ago). Do not claim the final commit is deployed.
- Current `trackcake.vercel.app` alias still points to deployment `dpl_BGdkR8fFG7Mck3ASJsoQ51nhrX51`, built from commit `3331f34da8d93e1d5bbef6c87d0299453dcbdf12`, not the latest main commit.
- Public production homepage fetch succeeded. Authenticated/browser-interaction testing could not be performed: no authenticated browser profile is connected, and the browser automation wallet is below zero. No user data was changed.
- Required release action: after Vercel's 24-hour deployment API quota resets, or from an online machine with the linked repository and authorized Vercel CLI credentials, pull latest `main` and deploy to Production with the `kukki` team. Then confirm `trackcake.vercel.app` maps to that exact commit.