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

const FIELDS = ["title", "description"] as const;
type Field = (typeof FIELDS)[number];

const SYSTEM_PROMPT = `You improve real estate listing copy for a property listing app.

You will be given the field being edited ("title" or "description") and its current text.
Rewrite it to sound more appealing and professional, while keeping every factual detail
(numbers, locations, room counts, amenities, prices) exactly as given — never invent new
facts, features, or claims that aren't already present in the original text.

Rules by field:
- "title": a short, punchy single-line headline, no more than about 80 characters. No
  trailing punctuation, no quotation marks.
- "description": one to three natural, engaging sentences (no bullet points, no markdown,
  no headings).

Return ONLY the improved text itself — no labels, no explanation, no surrounding quotes,
no markdown formatting.`;

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

  let text: unknown;
  let field: unknown;
  try {
    const body = await req.json();
    text = body?.text;
    field = body?.field;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return jsonResponse({ error: '"text" must be a non-empty string' }, 400);
  }

  if (typeof field !== "string" || !FIELDS.includes(field as Field)) {
    return jsonResponse({ error: '"field" must be one of "title" or "description"' }, 400);
  }

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.error("enhance-text: OPENAI_API_KEY is not set");
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
          { role: "user", content: `Field: ${field}\nCurrent text: ${text}` },
        ],
        temperature: 0.6,
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error("enhance-text: OpenAI request failed", completion.status, errorText);
      return jsonResponse({ error: "AI enhancement is temporarily unavailable" }, 502);
    }

    const completionBody = await completion.json();
    const content = completionBody?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      console.error("enhance-text: unexpected OpenAI response shape", completionBody);
      return jsonResponse({ error: "AI enhancement is temporarily unavailable" }, 502);
    }

    // Strip surrounding quotes in case the model wraps its output in them anyway.
    const enhancedText = content.trim().replace(/^["'“]+|["'”]+$/g, "");

    return jsonResponse({ enhanced_text: enhancedText });
  } catch (error) {
    console.error("enhance-text: unexpected error", error);
    return jsonResponse({ error: "AI enhancement is temporarily unavailable" }, 502);
  }
});
