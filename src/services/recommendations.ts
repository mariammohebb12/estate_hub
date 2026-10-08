import type { Listing } from '@/services/listings';

const DEFAULT_LIMIT = 6;

// Signal comes only from the user's own favorites (property type + style tag
// overlap) — there's no browsing-history table to draw on. With no favorites
// yet, candidates are already sorted newest-first by the listings query, and
// Array.prototype.sort is stable, so an all-zero-score sort below is a no-op
// and naturally falls back to "newest first".
export function getRecommendedListings(listings: Listing[], favoritedListings: Listing[], limit = DEFAULT_LIMIT): Listing[] {
  const favoritedIds = new Set(favoritedListings.map((listing) => listing.id));
  const candidates = listings.filter((listing) => !favoritedIds.has(listing.id));

  const favoritedPropertyTypes = new Set(
    favoritedListings.map((listing) => listing.property_type).filter((type): type is string => Boolean(type)),
  );
  const favoritedStyleTags = new Set(
    favoritedListings.flatMap((listing) => listing.style_tags ?? []).map((tag) => tag.toLowerCase()),
  );

  const scoreOf = (listing: Listing) => {
    let score = 0;
    if (listing.property_type && favoritedPropertyTypes.has(listing.property_type)) {
      score += 2;
    }
    score += (listing.style_tags ?? []).filter((tag) => favoritedStyleTags.has(tag.toLowerCase())).length;
    return score;
  };

  return [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, limit);
}
