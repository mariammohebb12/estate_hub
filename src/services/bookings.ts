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

export async function getSlotsForListing(listingId: string) {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, listing_id, start_time, end_time, is_booked')
    .eq('listing_id', listingId)
    .order('start_time', { ascending: true });

  return { data: (data as AvailabilitySlot[] | null) ?? [], error };
}

export async function hasAvailabilitySlots(listingId: string) {
  const { count, error } = await supabase
    .from('availability_slots')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  return { hasSlots: (count ?? 0) > 0, error };
}

// Cancels bookings on future slots and deletes future unbooked slots for a listing.
// A booked slot is kept (not deleted) so its booking row survives via the FK —
// its booking is cancelled instead. Shared by the listing-status-change flow and
// the listing-type-change flow, since both need to invalidate upcoming availability.
export async function clearFutureAvailability(listingId: string) {
  const nowIso = new Date().toISOString();

  const { data: futureBookedSlots, error: bookedSlotsError } = await supabase
    .from('availability_slots')
    .select('id')
    .eq('listing_id', listingId)
    .eq('is_booked', true)
    .gt('start_time', nowIso);

  if (bookedSlotsError) {
    return { error: bookedSlotsError, cancelledBookingsCount: 0 };
  }

  const bookedSlotIds = (futureBookedSlots ?? []).map((slot) => slot.id);
  let cancelledBookingsCount = 0;

  if (bookedSlotIds.length > 0) {
    const { data: cancelledBookings, error: cancelBookingsError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('slot_id', bookedSlotIds)
      .eq('status', 'confirmed')
      .select('id');

    if (cancelBookingsError) {
      return { error: cancelBookingsError, cancelledBookingsCount: 0 };
    }
    cancelledBookingsCount = cancelledBookings?.length ?? 0;
  }

  const { error: deleteSlotsError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('listing_id', listingId)
    .eq('is_booked', false)
    .gt('start_time', nowIso);

  if (deleteSlotsError) {
    return { error: deleteSlotsError, cancelledBookingsCount };
  }

  return { error: null, cancelledBookingsCount };
}

export type NewSlot = {
  start_time: string;
  end_time: string;
};

export async function createSlots(listingId: string, slots: NewSlot[]) {
  const { error } = await supabase
    .from('availability_slots')
    .insert(slots.map((slot) => ({ listing_id: listingId, ...slot })));

  return { error };
}

export async function deleteSlot(slotId: string) {
  const { data, error } = await supabase
    .from('availability_slots')
    .delete()
    .eq('id', slotId)
    .eq('is_booked', false)
    .select('id');

  if (error) {
    return { error };
  }

  if (!data || data.length === 0) {
    // The delete matched 0 rows. That's genuinely "this slot got booked
    // first" only if a fresh read shows is_booked = true. If the row is
    // still there with is_booked = false, something else (most likely a
    // missing RLS DELETE policy/grant on availability_slots) is silently
    // blocking the delete from affecting any rows.
    const { data: currentSlot, error: readError } = await supabase
      .from('availability_slots')
      .select('is_booked')
      .eq('id', slotId)
      .maybeSingle();

    if (!readError && currentSlot) {
      if (currentSlot.is_booked) {
        return { error: { message: 'This slot was just booked and can no longer be deleted.' } };
      }
      console.error(
        'deleteSlot: delete matched 0 rows even though is_booked is still false for slot',
        slotId,
        '— check for a missing DELETE policy/grant on availability_slots.',
      );
      return { error: { message: 'Unable to delete this slot. Check delete permissions on availability_slots.' } };
    }

    // Row no longer exists at all — already deleted, treat as success.
  }

  return { error: null };
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
  listings: {
    id: string;
    title: string;
    location_text: string | null;
    listing_type: 'buy' | 'rent';
    cover_photo_url: string | null;
  } | null;
  buyer_full_name?: string | null;
  buyer_phone?: string | null;
};

type RawBookingListingPhoto = { photo_url: string; sort_order: number };

type RawBookingListing = {
  id: string;
  title: string;
  location_text: string | null;
  listing_type: 'buy' | 'rent';
  listing_photos: RawBookingListingPhoto[] | null;
};

function mapBookingListing(listing: RawBookingListing | null): BookingRow['listings'] {
  if (!listing) return null;
  const cover = (listing.listing_photos ?? []).reduce<RawBookingListingPhoto | null>(
    (lowest, photo) => (lowest == null || photo.sort_order < lowest.sort_order ? photo : lowest),
    null,
  );
  return {
    id: listing.id,
    title: listing.title,
    location_text: listing.location_text,
    listing_type: listing.listing_type,
    cover_photo_url: cover?.photo_url ?? null,
  };
}

export async function getMyBookings(buyerId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, availability_slots ( start_time, end_time ), listings ( id, title, location_text, listing_type, listing_photos ( photo_url, sort_order ) )',
    )
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });

  const rows = (data as unknown as (Omit<BookingRow, 'listings'> & { listings: RawBookingListing | null })[] | null) ?? [];
  return { data: rows.map((row) => ({ ...row, listings: mapBookingListing(row.listings) })), error };
}

export async function getBookingsOnMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, buyer_id, availability_slots ( start_time, end_time ), listings!inner ( id, title, location_text, listing_type, seller_id, listing_photos ( photo_url, sort_order ) )',
    )
    .eq('listings.seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: [] as BookingRow[], error };
  }

  const rawRows = data as unknown as (Omit<BookingRow, 'listings'> & {
    buyer_id: string;
    listings: RawBookingListing | null;
  })[];
  const rows = rawRows.map((row) => ({ ...row, listings: mapBookingListing(row.listings) }));
  const buyerIds = [...new Set(rows.map((row) => row.buyer_id))];

  if (buyerIds.length === 0) {
    return { data: rows, error: null };
  }

  // bookings.buyer_id references auth.users, not profiles, so PostgREST can't
  // embed profiles directly here — fetch buyer profiles separately and merge.
  const { data: buyerProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', buyerIds);

  if (profilesError) {
    console.error('getBookingsOnMyListings: failed to load buyer profiles', profilesError);
    return { data: rows, error: null };
  }

  const profileById = new Map((buyerProfiles ?? []).map((profile) => [profile.id, profile]));

  return {
    data: rows.map((row) => ({
      ...row,
      buyer_full_name: profileById.get(row.buyer_id)?.full_name ?? null,
      buyer_phone: profileById.get(row.buyer_id)?.phone ?? null,
    })),
    error: null,
  };
}
