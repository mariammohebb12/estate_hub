import { supabase } from '@/services/supabase';

export type Listing = {
  id: string;
  title: string;
  location_text: string;
  price: number;
  status: string;
  created_at: string;
};

export async function getAvailableListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, location_text, price, status, created_at')
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  return { data: (data as Listing[] | null) ?? [], error };
}
