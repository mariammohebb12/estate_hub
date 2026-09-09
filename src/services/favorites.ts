import { withCoverPhoto, type ListingWithPhotos } from '@/services/listings';
import { supabase } from '@/services/supabase';

export async function getFavoritedListingIds(userId: string) {
  const { data, error } = await supabase.from('favorites').select('listing_id').eq('user_id', userId);

  return { data: (data ?? []).map((row) => row.listing_id as string), error };
}

export async function getFavoritedListings(userId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select(
      'created_at, listings ( id, title, location_text, price, status, listing_type, created_at, bedrooms, property_type, style_tags, listing_photos(photo_url, sort_order) )',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }

  const listings = (data ?? [])
    .map((row) => row.listings as unknown as ListingWithPhotos | null)
    .filter((listing): listing is ListingWithPhotos => Boolean(listing))
    .map(withCoverPhoto);

  return { data: listings, error: null };
}

export async function addFavorite(userId: string, listingId: string) {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
  return { error };
}

export async function removeFavorite(userId: string, listingId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
  return { error };
}
