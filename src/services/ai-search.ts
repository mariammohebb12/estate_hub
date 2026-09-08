import type { Listing } from '@/services/listings';
import { supabase } from '@/services/supabase';

export type ParsedSearchFilters = {
  bedrooms: number | null;
  property_type: 'villa' | 'apartment' | 'house' | null;
  style_keywords: string[];
  max_price: number | null;
};

export async function parseSearchQuery(query: string) {
  const { data, error } = await supabase.functions.invoke<ParsedSearchFilters>('parse-search', {
    body: { query },
  });

  if (error || !data) {
    return { data: null, error: error?.message ?? 'AI search is temporarily unavailable' };
  }

  return { data, error: null };
}

export function applyAiSearchFilters(listings: Listing[], filters: ParsedSearchFilters): Listing[] {
  const keywords = filters.style_keywords.map((keyword) => keyword.toLowerCase());

  const filtered = listings.filter((listing) => {
    if (filters.bedrooms != null && (listing.bedrooms == null || listing.bedrooms < filters.bedrooms)) {
      return false;
    }
    if (filters.property_type && listing.property_type !== filters.property_type) {
      return false;
    }
    if (filters.max_price != null && listing.price > filters.max_price) {
      return false;
    }
    return true;
  });

  if (keywords.length === 0) {
    return filtered;
  }

  const tagsOf = (listing: Listing) => (listing.style_tags ?? []).map((tag) => tag.toLowerCase());

  return [...filtered].sort((a, b) => {
    const scoreA = keywords.filter((keyword) => tagsOf(a).includes(keyword)).length;
    const scoreB = keywords.filter((keyword) => tagsOf(b).includes(keyword)).length;
    return scoreB - scoreA;
  });
}
