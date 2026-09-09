// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You extract structured search filters from a natural language real estate search query.

Return strict JSON only, matching exactly this shape, with no extra keys and no prose:
{
  "bedrooms": number | null,
  "property_type": "villa" | "apartment" | "house" | null,
  "style_keywords": string[],
  "max_price": number | null
}

Rules:
- "bedrooms" is the minimum number of bedrooms mentioned. Treat "room"/"rooms" as synonymous with
  "bedroom"/"bedrooms" in this real estate context (e.g. "2 bedroom" -> 2, "two rooms" -> 2,
  "3 room apartment" -> 3). null if no count is mentioned at all.
- "property_type" must be exactly one of "villa", "apartment", "house", or null if not mentioned or ambiguous.
- "style_keywords" is a lowercase array of short descriptive style/feature words found or implied in the
  query (e.g. "modern", "beachfront", "cozy", "resort", "downtown", "pool"). Empty array if none.
- "max_price" is a numeric budget ceiling if one is mentioned (e.g. "under 500k" -> 500000). null if not mentioned.
- Never include any explanation, markdown, or text outside the JSON object.`;

type ParsedFilters = {
  bedrooms: number | null;
  property_type: "villa" | "apartment" | "house" | null;
  style_keywords: string[];
  max_price: number | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let query: unknown;
  try {
    const body = await req.json();
    query = body?.query;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (typeof query !== "string" || query.trim().length === 0) {
    return jsonResponse({ error: "\"query\" must be a non-empty string" }, 400);
  }

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.error("parse-search: OPENAI_API_KEY is not set");
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }

  try {
    const completion = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error("parse-search: OpenAI request failed", completion.status, errorText);
      return jsonResponse({ error: "AI search is temporarily unavailable" }, 502);
    }

    const completionBody = await completion.json();
    const content = completionBody?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      console.error("parse-search: unexpected OpenAI response shape", completionBody);
      return jsonResponse({ error: "AI search is temporarily unavailable" }, 502);
    }

    let parsed: ParsedFilters;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("parse-search: OpenAI returned non-JSON content", content);
      return jsonResponse({ error: "AI search is temporarily unavailable" }, 502);
    }

    const filters: ParsedFilters = {
      bedrooms: typeof parsed.bedrooms === "number" ? parsed.bedrooms : null,
      property_type:
        parsed.property_type === "villa" || parsed.property_type === "apartment" || parsed.property_type === "house"
          ? parsed.property_type
          : null,
      style_keywords: Array.isArray(parsed.style_keywords)
        ? parsed.style_keywords.filter((keyword): keyword is string => typeof keyword === "string")
        : [],
      max_price: typeof parsed.max_price === "number" ? parsed.max_price : null,
    };

    return jsonResponse(filters);
  } catch (error) {
    console.error("parse-search: unexpected error", error);
    return jsonResponse({ error: "AI search is temporarily unavailable" }, 502);
  }
});
