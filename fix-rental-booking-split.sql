-- Fixes rent-mode booking so it saves and blocks ONLY a buyer's selected
-- sub-range of a listing's overall availability window, instead of the
-- whole window. Also enforces: two different renters CAN book two
-- different non-overlapping sub-ranges of the same listing, but nobody can
-- book dates that overlap an existing CONFIRMED booking.
--
-- Run this whole file once in the Supabase SQL Editor for this project
-- (Dashboard -> SQL Editor -> New query -> paste -> Run). Idempotent -
-- safe to re-run. After running, use the verification query at the bottom
-- to confirm the function actually exists before testing in the app.

drop function if exists public.book_rental_range(uuid, timestamptz, timestamptz, uuid);

create function public.book_rental_range(
  p_slot_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_buyer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_overlap_exists boolean;
begin
  select listing_id, start_time, end_time
    into v_listing_id, v_slot_start, v_slot_end
  from public.availability_slots
  where id = p_slot_id and is_booked = false
  for update;

  if not found then
    raise exception 'slot_taken';
  end if;

  if p_range_start < v_slot_start or p_range_end > v_slot_end or p_range_start >= p_range_end then
    raise exception 'slot_taken';
  end if;

  -- Serialize concurrent bookings on this listing so two buyers can't both
  -- pass the overlap check below for two different (possibly overlapping)
  -- unbooked slot rows at the same time.
  perform 1 from public.listings where id = v_listing_id for update;

  -- Defense in depth: confirm no CONFIRMED booking on this listing already
  -- covers any part of the requested range. This is independent of the
  -- is_booked flag above, so it still holds even if a seller creates two
  -- overlapping availability rows for the same listing.
  select exists (
    select 1
    from public.bookings b
    join public.availability_slots s on s.id = b.slot_id
    where b.listing_id = v_listing_id
      and b.status = 'confirmed'
      and s.start_time < p_range_end
      and s.end_time > p_range_start
  ) into v_overlap_exists;

  if v_overlap_exists then
    raise exception 'slot_taken';
  end if;

  if p_range_start > v_slot_start then
    insert into public.availability_slots (listing_id, start_time, end_time, is_booked)
    values (v_listing_id, v_slot_start, p_range_start, false);
  end if;

  if p_range_end < v_slot_end then
    insert into public.availability_slots (listing_id, start_time, end_time, is_booked)
    values (v_listing_id, p_range_end, v_slot_end, false);
  end if;

  update public.availability_slots
  set start_time = p_range_start, end_time = p_range_end, is_booked = true
  where id = p_slot_id;

  insert into public.bookings (slot_id, listing_id, buyer_id, status)
  values (p_slot_id, v_listing_id, p_buyer_id, 'confirmed');

  return p_slot_id;
end;
$$;

grant execute on function public.book_rental_range(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- Verification: run this after the block above. It should return exactly
-- one row. If it returns zero rows, the CREATE FUNCTION above did not
-- succeed and rent-mode bookings will keep failing with "Could not find
-- the function ... in the schema cache".
select proname, pronargs
from pg_proc
where proname = 'book_rental_range';
