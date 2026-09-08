create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  current_mode text not null default 'buy' check (current_mode in ('buy','rent','sell')),
  push_token text,
  created_at timestamptz not null default now()
);
