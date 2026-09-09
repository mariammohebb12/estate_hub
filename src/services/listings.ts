import { clearFutureAvailability } from '@/services/bookings';
import { supabase } from '@/services/supabase';

export type Listing = {
  id: string;
  title: string;
  location_text: string;
  price: number;
  status: string;
  listing_type: 'buy' | 'rent';
  created_at: string;
  bedrooms: number | null;
  property_type: string | null;
  style_tags: string[] | null;
  cover_photo_url: string | null;
};

export type ListingDetail = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  listing_type: 'buy' | 'rent';
  status: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: string | null;
  location_text: string | null;
  area_sqm: number | null;
  amenities: string[] | null;
  style_tags: string[] | null;
  seller_full_name: string | null;
  seller_avatar_url: string | null;
  seller_phone: string | null;
};

type ListingDetailRow = Omit<ListingDetail, 'seller_full_name' | 'seller_avatar_url' | 'seller_phone'> & {
  profiles: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
};

export const PROPERTY_TYPES = ['villa', 'apartment', 'house'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const LISTING_STATUSES = ['available', 'under_offer', 'sold'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ListingFilters = {
  minBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: PropertyType;
  listingType?: 'buy' | 'rent';
};

export type ListingWithPhotos = Omit<Listing, 'cover_photo_url'> & {
  listing_photos: { photo_url: string; sort_order: number }[] | null;
};

export function withCoverPhoto(row: ListingWithPhotos): Listing {
  const { listing_photos, ...listing } = row;
  const cover = (listing_photos ?? []).reduce<{ photo_url: string; sort_order: number } | null>(
    (lowest, photo) => (lowest == null || photo.sort_order < lowest.sort_order ? photo : lowest),
    null,
  );
  return { ...listing, cover_photo_url: cover?.photo_url ?? null };
}

export async function getAvailableListings(filters: ListingFilters = {}) {
  let query = supabase
    .from('listings')
    .select(
      'id, title, location_text, price, status, listing_type, created_at, bedrooms, property_type, style_tags, listing_photos(photo_url, sort_order)',
    )
    .eq('status', 'available');

  if (filters.minBedrooms != null) {
    query = query.gte('bedrooms', filters.minBedrooms);
  }
  if (filters.minPrice != null) {
    query = query.gte('price', filters.minPrice);
  }
  if (filters.maxPrice != null) {
    query = query.lte('price', filters.maxPrice);
  }
  if (filters.propertyType) {
    query = query.eq('property_type', filters.propertyType);
  }
  if (filters.listingType) {
    query = query.eq('listing_type', filters.listingType);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  return { data: ((data as ListingWithPhotos[] | null) ?? []).map(withCoverPhoto), error };
}

export type MyListing = {
  id: string;
  title: string;
  price: number;
  status: string;
  listing_type: 'buy' | 'rent';
  created_at: string;
  cover_photo_url: string | null;
};

type RawMyListing = Omit<MyListing, 'cover_photo_url'> & {
  listing_photos: { photo_url: string; sort_order: number }[] | null;
};

export async function getMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, price, status, listing_type, created_at, listing_photos(photo_url, sort_order)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  const rows = (data as RawMyListing[] | null) ?? [];
  return {
    data: rows.map(({ listing_photos, ...listing }) => {
      const cover = (listing_photos ?? []).reduce<{ photo_url: string; sort_order: number } | null>(
        (lowest, photo) => (lowest == null || photo.sort_order < lowest.sort_order ? photo : lowest),
        null,
      );
      return { ...listing, cover_photo_url: cover?.photo_url ?? null };
    }),
    error,
  };
}

export async function getListingById(id: string) {
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, seller_id, title, description, listing_type, status, price, bedrooms, bathrooms, property_type, location_text, area_sqm, amenities, style_tags, profiles(full_name, avatar_url, phone)',
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  const { profiles, ...listing } = data as unknown as ListingDetailRow;

  return {
    data: {
      ...listing,
      seller_full_name: profiles?.full_name ?? null,
      seller_avatar_url: profiles?.avatar_url ?? null,
      seller_phone: profiles?.phone ?? null,
    } satisfies ListingDetail,
    error: null,
  };
}

export type ListingFormValues = {
  title: string;
  description: string;
  listing_type: 'buy' | 'rent';
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: PropertyType | null;
  location_text: string;
  area_sqm: number | null;
  amenities: string[];
  style_tags: string[];
};

export async function createListing(sellerId: string, values: ListingFormValues) {
  const { data, error } = await supabase
    .from('listings')
    .insert({ ...values, seller_id: sellerId })
    .select('id')
    .single();

  return { data: data as { id: string } | null, error };
}

export async function updateListing(id: string, values: ListingFormValues) {
  const { error } = await supabase.from('listings').update(values).eq('id', id);
  return { error };
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from('listings').delete().eq('id', id);
  return { error };
}

export async function updateListingStatus(listingId: string, status: ListingStatus) {
  const { error: updateError } = await supabase.from('listings').update({ status }).eq('id', listingId);
  if (updateError) {
    return { error: updateError, cancelledBookingsCount: 0 };
  }

  if (status === 'available') {
    return { error: null, cancelledBookingsCount: 0 };
  }

  return clearFutureAvailability(listingId);
}
