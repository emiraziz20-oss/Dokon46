-- OptoBoard uchun Supabase jadvallari
-- Buni Supabase loyihangizda: SQL Editor -> New query -> shu kodni joylashtiring -> Run

create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  unit text default 'dona',
  qty numeric default 0,
  buy_price numeric default 0,
  sell_price numeric default 0,
  min_qty numeric default 10,
  created_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  phone text,
  debt numeric default 0,
  created_at timestamptz default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  phone text,
  balance numeric default 0,
  created_at timestamptz default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  customer_id uuid references customers,
  items jsonb not null default '[]',
  paid numeric default 0,
  total numeric default 0,
  date timestamptz default now(),
  created_at timestamptz default now()
);

-- Row Level Security: har bir foydalanuvchi faqat o'z ma'lumotlarini ko'radi
alter table products enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table sales enable row level security;

create policy "Users manage own products" on products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own customers" on customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own suppliers" on suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own sales" on sales for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
