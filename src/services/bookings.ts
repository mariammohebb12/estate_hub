import { supabase } from '@/services/supabase';

export type AvailabilitySlot = {
  id: string;
  listing_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

export async function getAvailableSlots(listingId: string) {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, listing_id, start_time, end_time, is_booked')
    .eq('listing_id', listingId)
    .eq('is_booked', false)
    .order('start_time', { ascending: true });

  return { data: (data as AvailabilitySlot[] | null) ?? [], error };
}

export type BookSlotParams = {
  slotId: string;
  listingId: string;
  buyerId: string;
};

export async function bookSlot({ slotId, listingId, buyerId }: BookSlotParams) {
  const { data: claimedSlot, error: claimError } = await supabase
    .from('availability_slots')
    .update({ is_booked: true })
    .eq('id', slotId)
    .eq('is_booked', false)
    .select('id')
    .maybeSingle();

  if (claimError) {
    return { error: claimError.message };
  }
  if (!claimedSlot) {
    return { error: 'slot_taken' as const };
  }

  const { error: bookingError } = await supabase.from('bookings').insert({
    slot_id: slotId,
    listing_id: listingId,
    buyer_id: buyerId,
    status: 'confirmed',
  });

  if (bookingError) {
    await supabase.from('availability_slots').update({ is_booked: false }).eq('id', slotId);
    return { error: bookingError.message };
  }

  return { error: null };
}
