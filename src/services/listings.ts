import { supabase } from '@/services/supabase';

export type Listing = {
  id: string;
  title: string;
  location_text: string;
  price: number;
  status: string;
  created_at: string;
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
};

export const PROPERTY_TYPES = ['villa', 'apartment', 'house'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type ListingFilters = {
  minBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: PropertyType;
};

export async function getAvailableListings(filters: ListingFilters = {}) {
  let query = supabase.from('listings').select('id, title, location_text, price, status, created_at').eq('status', 'available');

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

  const { data, error } = await query.order('created_at', { ascending: false });

  return { data: (data as Listing[] | null) ?? [], error };
}

export async function getListingById(id: string) {
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, seller_id, title, description, listing_type, status, price, bedrooms, bathrooms, property_type, location_text, area_sqm, amenities',
    )
    .eq('id', id)
    .single();

  return { data: data as ListingDetail | null, error };
}
