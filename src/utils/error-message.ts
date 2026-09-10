const NETWORK_KEYWORDS = ['network', 'fetch', 'internet', 'offline', 'timed out', 'timeout', 'connection'];

const TECHNICAL_MESSAGE_PATTERN =
  /typeerror|referenceerror|syntaxerror|rangeerror|networkerror|unexpectedexception|unhandled|exception|^\s*error\s*:|undefined is not an object|null is not an object/i;

function extractRawMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return null;
}

// Turns a raw error (a caught exception, or a Supabase/Postgrest `{error}`
// result) into user-facing copy. Network-looking failures get a specific,
// actionable message; anything that reads as a raw technical/JS exception
// falls back to a generic one. An already-curated, human-readable message
// (e.g. a Supabase Auth error like "Invalid login credentials", or our own
// validation copy) is left as-is rather than being flattened into the
// generic fallback.
export function getFriendlyErrorMessage(error: unknown): string {
  const raw = extractRawMessage(error);
  if (!raw) return 'Something went wrong. Please try again.';

  const lower = raw.toLowerCase();
  if (NETWORK_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return 'No internet connection. Please check your connection and try again.';
  }

  if (TECHNICAL_MESSAGE_PATTERN.test(raw)) {
    return 'Something went wrong. Please try again.';
  }

  return raw;
}
