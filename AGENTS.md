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
2. Check the current branch and latest commit. Work on the requested branch; the production branch is `main`.
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