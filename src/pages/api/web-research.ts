import type { APIRoute } from "astro";

export const prerender = false;
export const maxDuration = 45;

const MAX_SOURCES = 2;
const MAX_EVIDENCE_CHARS = 4200;
const NUTRIENT_TERMS = /calor(?:ie|ies)|energy|kcal|protein|carbohydrate|\bcarbs?\b|total fat|\bfat\b|serving size|per 100\s*(?:g|ml)|nutrition facts|nutritional value/i;
const METRIC_PATTERNS = [
  /calor(?:ie|ies)|energy|kcal/i,
  /protein/i,
  /carbohydrate|\bcarbs?\b/i,
  /total fat|\bfat\b/i
];

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
    return url.toString();
  } catch { return null; }
}

function queryTerms(food: string): string[] {
  const ignored = new Set(["with", "and", "the", "one", "small", "large", "medium", "fresh"]);
  return [...new Set(food.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ")
    .split(" ").filter((term) => term.length > 2 && !ignored.has(term)))].slice(0, 8);
}

function relevantNutritionEvidence(food: string, title: string, markdown: string): string | null {
  const terms = queryTerms(food);
  const titleText = title.toLowerCase();
  const bodyText = markdown.toLowerCase();
  if (terms.length && !terms.every((term) => titleText.includes(term) || bodyText.includes(term))) return null;

  // A source must contain several actual nutrition fields, not just general wellness copy.
  const metricCount = METRIC_PATTERNS.filter((pattern) => pattern.test(markdown)).length;
  if (metricCount < 3 || !/\d+(?:\.\d+)?\s*(?:kcal|calories|g|grams|mg|kj)\b/i.test(markdown)) return null;

  // Keep nutrition facts and their immediate context; discard recipe galleries, navigation and unrelated prose.
  const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const selected = new Set<number>();
  for (let i = 0; i < lines.length; i += 1) {
    if (!NUTRIENT_TERMS.test(lines[i])) continue;
    for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 1); j += 1) selected.add(j);
  }
  const excerpt = [...selected].sort((a, b) => a - b).map((index) => lines[index]).join("\n");
  if (excerpt.length < 80) return null;
  return excerpt.slice(0, MAX_EVIDENCE_CHARS);
}

export const POST: APIRoute = async ({ request }) => {
  let food: string;
  try {
    const body = await request.json() as { food?: unknown };
    food = typeof body.food === "string" ? body.food.trim() : "";
  } catch { return json({ error: "Enter a food to search for." }, 400); }
  if (!food) return json({ error: "Enter a food to search for." }, 400);
  if (food.length > 180) return json({ error: "Keep the food search under 180 characters." }, 400);

  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return json({ error: "Live web search is not configured. Add FIRECRAWL_API_KEY in Vercel." }, 503);

  try {
    const query = food + " nutrition facts calories protein carbohydrates total fat serving size";
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: MAX_SOURCES,
        sources: [{ type: "web" }],
        country: "IN",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true, timeout: 15000, removeBase64Images: true, lockdown: true }
      }),
      signal: AbortSignal.timeout(40000)
    });
    if (!response.ok) {
      console.warn("[trackcake-web-research] Firecrawl returned HTTP", response.status);
      return json({ error: response.status === 402 ? "Firecrawl credits are exhausted. Check your Firecrawl dashboard." : "Live search is temporarily unavailable (HTTP " + response.status + ")." }, response.status === 402 ? 402 : 502);
    }
    const payload = await response.json() as { success?: boolean; data?: { web?: unknown[] } };
    const results = Array.isArray(payload.data?.web) ? payload.data!.web! : [];
    const sources = results.slice(0, MAX_SOURCES).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const row = raw as Record<string, unknown>;
      const url = safeUrl(row.url);
      const markdown = typeof row.markdown === "string" ? row.markdown.slice(0, 14000) : "";
      const title = typeof row.title === "string" ? row.title.slice(0, 180) : "Web result";
      if (!url || markdown.trim().length < 40) return [];
      const content = relevantNutritionEvidence(food, title, markdown);
      if (!content) return [];
      return [{ title, url, content }];
    });
    if (!payload.success || !sources.length) {
      return json({ error: "No sufficiently relevant nutrition facts were found. Try the exact food name, brand, or a more specific serving description." }, 404);
    }
    return json({ food, sources });
  } catch (error) {
    console.warn("[trackcake-web-research] Search unavailable", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not reach live web search. Please try again." }, 502);
  }
};
