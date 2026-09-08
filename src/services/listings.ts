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
};

export async function getAvailableListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, location_text, price, status, created_at')
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  return { data: (data as Listing[] | null) ?? [], error };
}

export async function getListingById(id: string) {
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, seller_id, title, description, listing_type, status, price, bedrooms, bathrooms, property_type, location_text',
    )
    .eq('id', id)
    .single();

  return { data: data as ListingDetail | null, error };
}
