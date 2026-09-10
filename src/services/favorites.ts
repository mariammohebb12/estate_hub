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

const DUPLICATE_KEY_ERROR_CODE = '23505';

export async function addFavorite(userId: string, listingId: string) {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });

  if (error && error.code === DUPLICATE_KEY_ERROR_CODE) {
    // Already favorited — most likely the optimistic UI state drifted out of
    // sync with the database (e.g. a previous toggle actually succeeded
    // despite reporting an error). Treat as a no-op success rather than
    // failing a toggle that, from the user's perspective, already happened.
    return { error: null };
  }

  return { error };
}

export async function removeFavorite(userId: string, listingId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .select('id');

  if (error) {
    return { error };
  }

  if (!data || data.length === 0) {
    // The delete matched 0 rows. That's genuinely "already removed" only if a
    // fresh read confirms the row is gone. If it's still there, something
    // else (most likely a missing RLS DELETE policy/grant on favorites) is
    // silently blocking the delete from affecting any rows — same class of
    // bug already seen on availability_slots.
    const { data: stillExists, error: readError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (!readError && stillExists) {
      console.error(
        'removeFavorite: delete matched 0 rows but the favorite still exists for',
        { userId, listingId },
        '— check for a missing DELETE policy/grant on favorites.',
      );
      return { error: { message: 'Unable to remove this favorite right now.' } };
    }
    // Row no longer exists — already removed, treat as success.
  }

  return { error: null };
}
