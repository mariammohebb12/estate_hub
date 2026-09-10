create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  current_mode text not null default 'buy' check (current_mode in ('buy','rent','sell')),
  push_token text,
  created_at timestamptz not null default now()
);

-- Creates the profiles row as part of auth.users' own insert transaction, so a
-- session can never exist without a matching profile (signup previously
-- inserted this client-side, which raced the app's session-based navigation).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  listing_type text not null check (listing_type in ('buy','rent')),
  status text not null default 'available' check (status in ('available','under_offer','sold')),
  price numeric not null,
  bedrooms int,
  bathrooms int,
  property_type text,
  location_text text,
  latitude double precision,
  longitude double precision,
  style_tags text[],
  area_sqm numeric,
  amenities text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  photo_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.availability_slots(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now()
);

-- A rent-mode availability_slots row spans a seller's whole open rental
-- window (e.g. Sep 10-30). A buyer can book any sub-range within it
-- (e.g. Sep 10-13). This splits that row atomically: the booked sub-range
-- becomes its own is_booked slot (which the new booking references), and
-- any leftover time before/after the sub-range is re-inserted as new,
-- still-unbooked slots so it stays bookable by others.
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
