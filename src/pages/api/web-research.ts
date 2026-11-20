import type { APIRoute } from "astro";

export const prerender = false;
export const maxDuration = 45;

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
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: food + " nutrition facts ingredients calories protein carbohydrates fat",
        limit: 4,
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
    const sources = results.slice(0, 4).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const row = raw as Record<string, unknown>;
      const url = safeUrl(row.url);
      const markdown = typeof row.markdown === "string" ? row.markdown.slice(0, 14000) : "";
      if (!url || markdown.trim().length < 40) return [];
      return [{
        title: typeof row.title === "string" ? row.title.slice(0, 180) : "Web result",
        url,
        content: markdown
      }];
    });
    if (!payload.success || !sources.length) return json({ error: "Search returned no readable food information. Try a more specific food or brand." }, 404);
    return json({ food, sources });
  } catch (error) {
    console.warn("[trackcake-web-research] Search unavailable", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not reach live web search. Please try again." }, 502);
  }
};
