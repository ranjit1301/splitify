-- =============================================
-- SPLITIFY — Supabase Database Setup
-- Run this entire script in Supabase SQL Editor
-- =============================================

-- 1. TRIPS table
create table if not exists trips (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  cover text default '✈️',
  date text,
  created_at timestamptz default now()
);

-- 2. MEMBERS table
create table if not exists members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  name text not null,
  whatsapp text default '',
  color text default '#4D96FF',
  created_at timestamptz default now()
);

-- 3. EXPENSES table
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  description text not null,
  amount numeric not null,
  paid_by uuid references members(id) on delete cascade,
  category text default '📦 Other',
  split_among uuid[] default '{}',
  date text,
  created_at timestamptz default now()
);

-- 4. PAYMENTS table
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  txn_key text,
  from_id uuid references members(id) on delete cascade,
  to_id uuid references members(id) on delete cascade,
  amount numeric not null,
  date text,
  created_at timestamptz default now()
);

-- 5. Enable Row Level Security (keep data safe)
alter table trips enable row level security;
alter table members enable row level security;
alter table expenses enable row level security;
alter table payments enable row level security;

-- 6. Allow public read/write (anyone with the link can use the app)
-- For a trip-sharing app this is what we want
create policy "Public access trips" on trips for all using (true) with check (true);
create policy "Public access members" on members for all using (true) with check (true);
create policy "Public access expenses" on expenses for all using (true) with check (true);
create policy "Public access payments" on payments for all using (true) with check (true);

-- 7. Enable Realtime for live updates across all phones
alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table payments;

-- Done! Your database is ready ✅
