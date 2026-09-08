create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  current_mode text not null default 'buy' check (current_mode in ('buy','rent','sell')),
  push_token text,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  listing_type text not null check (listing_type in ('buy','rent')),
  status text not null default 'available' check (status in ('available','under_offer','sold','rented')),
  price numeric not null,
  bedrooms int,
  bathrooms int,
  property_type text,
  location_text text,
  latitude double precision,
  longitude double precision,
  style_tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
