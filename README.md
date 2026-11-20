# TrackCake

<p align="center">
  <img src="https://raw.githubusercontent.com/AravindSAsok/tracKcake/main/public/favicon.svg" width="88" alt="TrackCake logo" />
</p>

<h3 align="center">A thoughtful food diary with AI-assisted nutrition tracking.</h3>

<p align="center">
  <a href="https://trackcake.vercel.app"><strong>Open the live app</strong></a>
  · <a href="https://github.com/AravindSAsok/tracKcake/issues">Report an issue</a>
</p>

<p align="center">
  <img alt="Astro" src="https://img.shields.io/badge/Astro-5.x-BC52EE?logo=astro&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres-3FCF8E?logo=supabase&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white" />
</p>

TrackCake makes food logging easier without hiding the details. Add meals manually, describe them in natural language, or submit a food photo for an AI-assisted estimate. Review and edit suggested foods, portions, calories, and macros before saving them to your diary.

**Live app:** [trackcake.vercel.app](https://trackcake.vercel.app)

> Nutrition values are estimates for personal tracking, not medical advice. Image recognition and portion estimation can be wrong; review every result.

## Features

- **Three food-entry workflows:** manual logging, natural-language estimates, and photo-based food recognition.
- **Multi-provider AI:** connect Groq, Google Gemini, and OpenRouter; discover models available to configured API keys.
- **Model selection and fallback:** select a provider/model or use automatic provider fallback.
- **Review before saving:** AI suggestions are editable and never silently added to the diary.
- **Food diary:** edit and delete entries, search and filter history, and review meal-level breakdowns.
- **Daily nutrition goals:** track calories and macronutrients against a personal calorie target.
- **Calkie assistant:** ask questions about your diary through a floating chat interface, with provider/model selection and saved conversation history.
- **Flexible persistence:** use local browser storage or Supabase Auth and cloud-backed PostgreSQL storage.
- **Nutrition research:** text and photo estimates share a server-side lookup that checks branded products in Open Food Facts and generic foods in USDA FoodData Central, then calculates values for the stated quantity.
- **Live web research:** when configured, Firecrawl searches and extracts nutrition facts from live pages for the first three unmatched foods in a meal. Extracted values must include all four macros, a matching food name, a per-100 g/ml basis, page content, and a source URL before they can be used.
- **Optional Google Search grounding:** Gemini Google Search remains an additional fallback and is disabled by default.

## Screenshots

A curated screenshot set is not currently committed. Add real application captures under docs/screenshots/ and link them here when available; do not use mockups that suggest features the app does not have.

## Technology

| Layer | Technology |
| --- | --- |
| Framework | Astro 5 |
| Language | TypeScript |
| Server runtime | Astro server output; Vercel adapter, with standalone Node adapter option for Render |
| Authentication and database | Supabase Auth, PostgreSQL, Row Level Security |
| AI providers | Groq, Google Gemini, OpenRouter |
| Nutrition sources | Open Food Facts, USDA FoodData Central, optional Firecrawl live web research, optional Gemini Google Search grounding |
| Hosting | Vercel |

## Architecture

~~~mermaid
flowchart TD
  U[User] --> UI[Astro diary interface]
  UI --> M[Manual entry]
  UI --> T[Text estimate]
  UI --> P[Photo estimate]
  T --> API[Server API routes]
  P --> API
  API --> AI[Groq / Gemini / OpenRouter]
  API --> N[Shared nutrition research]
  N --> OFF[Open Food Facts]
  N --> USDA[USDA FoodData Central]
  N -. optional .-> FC[Firecrawl live web search and extraction]
  N -. optional .-> WEB[Gemini Google Search]
  AI --> N
  N --> R[Review and edit]
  M --> DB[Local storage or Supabase]
  R --> DB
  DB --> D[Diary, goals and nutrition summaries]
  D --> C[Calkie assistant]
  C --> API
~~~

Provider credentials stay on the server. In cloud mode, Supabase Auth identifies the user and PostgreSQL Row Level Security scopes diary data to that user.

## Run locally

**Requirements:** Node.js 22 and npm.

~~~bash
git clone https://github.com/AravindSAsok/tracKcake.git
cd tracKcake
npm install
cp .env.example .env
npm run dev
~~~

Open [http://localhost:4321](http://localhost:4321).

The app can start without environment variables. Manual logging and local browser storage are available in local-only mode. Configure an AI provider for AI-assisted estimates; configure Supabase if you want cloud persistence and account-based access.

## Environment variables

Add the credentials for the services you intend to use to your local .env file:

~~~dotenv
GROQ_API_KEY=
GROQ_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
USDA_FDC_API_KEY=
FIRECRAWL_API_KEY=
GEMINI_WEB_SEARCH_ENABLED=false
GEMINI_WEB_SEARCH_MODEL=gemini-3.6-flash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
~~~

USDA_FDC_API_KEY is optional; without it, the limited public USDA DEMO_KEY is used. For production usage, create a free FoodData Central API key and add it server-side. FIRECRAWL_API_KEY enables bounded live web research after Open Food Facts and USDA lookups fail. Firecrawl is called server-side only and is limited to the first three unmatched foods in a meal. Gemini Google Search grounding is disabled unless GEMINI_WEB_SEARCH_ENABLED=true; review Google's current grounding pricing and limits before enabling it. Never commit .env files or expose AI provider keys through PUBLIC_ variables. The Supabase URL and anon/publishable key are browser configuration and must be protected by the included Row Level Security policies. Never put a Supabase service-role key in the browser.

### AI providers and model catalogue

1. Create an API key with one or more supported providers.
2. Add the corresponding server-side variable(s) to .env or your hosting environment.
3. Restart the development server or redeploy.
4. Use the provider selector to retrieve the model catalogue available to each configured key.

The provider-status endpoint queries provider model-list APIs and returns model IDs and availability status, not secret values. Catalogues, account access, rate limits, and model availability can change. A model appearing in a catalogue does not guarantee every request will succeed.

Automatic mode tries configured providers in the server-defined order and can fall back after a provider error. Selecting a specific provider keeps the request on that provider.

### Supabase setup (optional)

1. Create a Supabase project.
2. Enable **Anonymous sign-ins** if guest cloud sessions are required.
3. Run the SQL migration in supabase/migrations/ in the Supabase SQL Editor.
4. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.
5. Restart the app.

The migration creates the food diary and tracker settings tables, indexes, grants, and user-scoped Row Level Security policies. Anonymous sessions are browser-dependent; create or sign in to a recoverable account before relying on access across devices.

## Build and verify

~~~bash
npm run check
npm run build
npm run preview
~~~

| Command | Purpose |
| --- | --- |
| npm run dev | Start the development server |
| npm run check | Run Astro and TypeScript diagnostics |
| npm run build | Create the production build |
| npm run preview | Preview the production build locally |

## Deployment

The production application uses the Astro Vercel adapter because AI features require server-side API routes.

1. Import this repository into Vercel.
2. Keep the framework preset set to Astro.
3. Add the required AI keys and optional Supabase variables to project environment settings.
4. Deploy and verify the production build.

A standalone Node adapter option is available for Render builds using TRACKCAKE_HOST=render. Static-only hosting cannot run the server API routes needed by AI estimates and Calkie.

## Project structure

~~~text
src/
├── layouts/                  Shared page layout
├── lib/                      Storage and Supabase integration
├── pages/
│   ├── index.astro           Main food diary interface
│   └── api/
│       ├── estimate.ts       Text-based nutrition estimation
│       ├── food-image.ts     Image-based food recognition and estimation
│       ├── provider-status.ts Provider/model discovery
│       └── assistant.ts      Authenticated Calkie API
├── scripts/
│   ├── app.ts                Diary and food-entry interactions
│   ├── ai-account.ts         Provider/model selector and account flows
│   └── calkie.ts             Floating assistant interface
└── styles/
    └── global.css            Application styles
supabase/
└── migrations/               Database schema and RLS policies
~~~

## Privacy and nutrition accuracy

- AI provider keys are used by server-side routes and must remain secret.
- Supabase cloud data is protected by user-scoped Row Level Security policies.
- Calkie requires a valid Supabase session to retrieve diary context and conversation history.
- Food text and photos are sent to the selected AI provider for analysis. Do not submit information you do not want processed by that provider.
- Nutrition lookup checks Open Food Facts for identified branded products and USDA FoodData Central for generic foods, then optionally uses Firecrawl to search and extract live page data. Web results are best-effort and are not a guarantee of laboratory-verified nutrition values.
- Firecrawl web research is disabled until FIRECRAWL_API_KEY is configured, runs server-side, and is bounded to three unmatched items per meal. Its returned source link and research label are shown in the review popup.
- Optional Gemini Google Search grounding is disabled by default. If enabled, its returned source link is shown in the review popup; Google's usage limits and pricing apply.
- When no reliable match is found, TrackCake labels the values as an AI estimate instead of presenting them as verified.
- Food names, portions, calories, and macros generated by AI may be inaccurate. Review and correct every estimate.

## Contributing

Focused issues and pull requests are welcome. Read agent.md before changing authentication, storage, provider handling, or diary behavior.

## Maintainer

Built and maintained by **Aravind S Asok**.

- Portfolio: [aravindsasok.netlify.app](https://aravindsasok.netlify.app/)
- GitHub: [@AravindSAsok](https://github.com/AravindSAsok)

---

<p align="center">Made with care for more mindful food tracking.</p>

