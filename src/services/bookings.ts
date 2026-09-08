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
    // The update matched 0 rows. That's genuinely "someone else booked it
    // first" only if a fresh read shows is_booked = true. If it still reads
    // false, something else (most likely a missing RLS UPDATE policy/grant
    // on availability_slots) is silently blocking the update from affecting
    // any rows, rather than a real booking race.
    const { data: currentSlot, error: readError } = await supabase
      .from('availability_slots')
      .select('is_booked')
      .eq('id', slotId)
      .maybeSingle();

    if (!readError && currentSlot && currentSlot.is_booked === false) {
      console.error(
        'bookSlot: update matched 0 rows even though is_booked is still false for slot',
        slotId,
        '— check for a missing UPDATE policy/grant on availability_slots.',
      );
      return { error: 'not_permitted' as const };
    }

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

export type BookingRow = {
  id: string;
  status: string;
  availability_slots: { start_time: string; end_time: string } | null;
  listings: { id: string; title: string; location_text: string | null; listing_type: 'buy' | 'rent' } | null;
};

export async function getMyBookings(buyerId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, availability_slots ( start_time, end_time ), listings ( id, title, location_text, listing_type )',
    )
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });

  return { data: (data as unknown as BookingRow[] | null) ?? [], error };
}

export async function getBookingsOnMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, availability_slots ( start_time, end_time ), listings!inner ( id, title, location_text, listing_type, seller_id )',
    )
    .eq('listings.seller_id', sellerId)
    .order('created_at', { ascending: false });

  return { data: (data as unknown as BookingRow[] | null) ?? [], error };
}
