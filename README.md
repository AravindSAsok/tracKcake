# trackcake

A calm, lightweight food and calorie tracker. Describe what you ate, review a Gemini-powered nutrition estimate, and save it to your food diary.

## What it does

- Log food in natural language, including portions (for example, "2 idlis, one cup of sambar and a banana").
- Ask Gemini for an estimated calorie and macronutrient breakdown.
- Review and edit every suggested item before saving. Estimates are never saved automatically.
- Add or edit entries manually whenever you need to correct an amount or calorie value.
- See a rolling **last 24 hours** food history, calorie total, and macro breakdown.
- Set your own daily calorie goal.
- Save locally in the browser before cloud credentials are configured; optionally enable private Supabase cloud storage later.

Nutrition values are estimates, not medical advice. Actual calories vary with portion size, recipe, and preparation.

## Stack

- Astro + TypeScript
- Astro Vercel server adapter for the private Gemini API endpoint
- Gemini REST API (server-side only)
- Supabase Auth + Postgres with Row Level Security (optional cloud persistence)
- Local browser storage as an immediate fallback

## Run locally

Requirements: Node.js 20.19+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:4321.

The app works without any environment variables. In local mode, entries and your goal stay in this browser on this device. The AI estimate button will explain how to configure Gemini until a key is supplied; manual logging and editing remain available.

## Configure Gemini

1. Create an API key in Google AI Studio.
2. Add the following server-only environment variable to `.env` and your hosting provider:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-4-hydrogen
```

3. Restart the dev server or redeploy.

The key is read only by `src/pages/api/estimate.ts` and is sent to Google from the server. It is never placed in a `PUBLIC_*` variable or browser bundle. The tested default model is `gemini-4-hydrogen`; the endpoint automatically falls back to `gemini-3.6-flash` if the primary model is temporarily unavailable or rate-limited. You can change `GEMINI_MODEL` without changing application code.

## Configure Supabase (optional)

The app starts in local mode. To enable cloud persistence:

1. Create a Supabase project.
2. In Supabase Authentication settings, enable **Anonymous sign-ins**. The app creates a browser-scoped anonymous session so database rows can be protected by `auth.uid()` without requiring a sign-up form.
3. Run `supabase/migrations/202611150001_trackcake.sql` in the Supabase SQL Editor.
4. Add the project URL and publishable/anon key to `.env`:

```dotenv
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

5. Restart or redeploy. The footer status will show whether the app is using local storage or Supabase.

The migration enables RLS and restricts each food entry and goal to the authenticated user ID. The browser key is safe to expose only with these policies enabled. **Never add a Supabase service-role key to this app.**

Anonymous accounts persist in the browser's Supabase session. Clearing browser storage or moving to another browser can make an anonymous account inaccessible; add a real sign-in/recovery flow before relying on cross-device access.

## Deploy

This project uses the Astro Vercel adapter because the Gemini endpoint needs a server runtime.

1. Push the repository to GitHub and import it into Vercel.
2. Set the framework preset to Astro (Vercel normally detects it).
3. Add `GEMINI_API_KEY` and, optionally, `GEMINI_MODEL`, `PUBLIC_SUPABASE_URL`, and `PUBLIC_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables.
4. Redeploy after adding or changing environment variables.

For a local production build:

```bash
npm run check
npm run build
npm run preview
```

A static-only GitHub Pages deployment cannot run the private Gemini API route. Use a server-capable host such as Vercel for the complete app.

## Project layout

```text
src/
  lib/                 Supabase/local storage adapter
  pages/
    api/estimate.ts    Server-side Gemini nutrition estimate
    index.astro        Dashboard
  scripts/app.ts       Browser interactions and diary state
  styles/global.css   Responsive app styling
supabase/
  migrations/          Postgres schema, indexes, and RLS policies
```

## Privacy and accuracy

- The Gemini request contains only the food description entered for that estimate.
- API keys remain server-side.
- Cloud mode uses Supabase anonymous auth and row-level security; no service-role credential is used.
- Calorie and macro values are approximations. Review the suggested portions and edit the result to match what you actually ate.
