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

1. Push to the intended branch.
2. Confirm the CI/Vercel deployment corresponds to the exact commit.
3. Inspect build logs and wait for a terminal deployment state.
4. Verify the production alias points to the intended deployment.
5. Perform smoke tests against the deployed app when browser tooling is available.
6. Report exactly what was tested. Distinguish build checks from real browser, authenticated-user, provider, and device tests.

## 5. Responsive UI standards

Design for these viewport ranges:
- 320–360px: compact phones.
- 375–430px: standard phones.
- 431–680px: large phones and narrow landscape layouts.
- 681–1024px: tablets.
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
- Do not commit directly to `main` unless the task explicitly asks for it.
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
