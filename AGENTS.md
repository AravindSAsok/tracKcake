# TrackCake — Agent Entry Point

All AI coding agents and human contributors must read this file and then read the complete [agent.md](agent.md) before changing code.

## Project
TrackCake is an Astro 5 + TypeScript food diary and calorie tracker deployed on Vercel. It uses Supabase Auth/PostgreSQL with Row Level Security, browser-local storage fallback, Groq/Gemini/OpenRouter AI providers, Open Food Facts, and USDA FoodData Central.

## Non-negotiable rules
- Preserve user food data, authentication, authorization, Supabase RLS, and local/cloud sync.
- Do not introduce mock data, replace working flows, or perform destructive database operations.
- Keep provider secrets server-side; never commit .env files, tokens, API keys, or user data.
- Keep Gemini Google Search grounding disabled by default.
- Make small, source-verified changes; inspect affected UI → script → API → storage paths.
- Before committing, run `npm run check` and `npm run build`; report checks honestly.
- Never force-push, rewrite shared history, or blindly merge stale branches.
- Read the full `agent.md` for architecture, workflow, responsive standards, verification checklists, and completion-report requirements.

## Current handoff — 2026-11-19
- Production branch: `main`; HEAD at audit start: `fcb81d2bedc944a4fe10d538c875f2120d3d93c8`.
- Production URL: https://trackcake.vercel.app
- GitHub audit found 15 branches including main (14 topic branches) and no open PRs.
- `feat/nutrition-research-lookup` and `feature/trackcake-android-wrapper-ui` are already ancestors of main; no merge is required for those.
- Eleven other topic branches contain commits not reachable from main, but are hundreds of commits behind their merge bases and several overlap the same account, diary, storage, history, and CSS files. They must be reviewed against current main and selectively ported only if their behavior is still missing.
- `AGENTS.md` and `agent.md` are now committed on main. The detailed branch-by-branch inventory, historical verification caveats, pending tasks, and next-agent instructions are maintained in the **Verified project handoff** section of `agent.md`.
- Branch consolidation is not complete: the SMTP docs file is already identical on main, and nutrition/Android-wrapper branches are already ancestors. The remaining stale branches have overlapping changed files and were deliberately not blindly merged. See `agent.md` for the audit inventory and next steps.

## Required continuation
1. Read `agent.md`.
2. Audit each stale branch against current main before porting; do not blind-merge or force-push.
3. Preserve existing behavior and data.
4. Port only verified missing behavior and use PRs where appropriate.
5. Run checks/build after all code changes.
6. Verify Vercel deployment and production smoke tests.
7. Update both this handoff and `agent.md` with exact commits, tests, deployment status, and blockers.
