-- Extend auth.users with a public profile
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  language text default 'he' check (language in ('he', 'en')),
  tier text default 'free' check (tier in ('free', 'premium')),
  onboarding_done boolean default false,
  created_at timestamptz default now()
);

-- Categories (system-seeded)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_he text not null,
  name_en text not null,
  icon text,
  type text check (type in ('expense', 'income')),
  is_system boolean default true,
  sort_order integer default 0
);

-- Uploads (each file import)
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  bank_name text not null,
  filename text,
  transaction_count integer default 0,
  period_start date,
  period_end date,
  uploaded_at timestamptz default now()
);

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  raw_id text not null,
  amount numeric not null,
  currency text default 'ILS',
  date date not null,
  description text,
  merchant_name text,
  category_id uuid references public.categories(id),
  is_manual_override boolean default false,
  created_at timestamptz default now(),
  unique(user_id, raw_id)
);

-- Insights
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  content_he text,
  content_en text,
  action_he text,
  action_en text,
  generated_at timestamptz default now(),
  is_read boolean default false,
  period_start date,
  period_end date
);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'active',
  tier text default 'free',
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

-- Merchant preferences
create table public.merchant_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  merchant_name text not null,
  category_id uuid references public.categories(id) not null,
  created_at timestamptz default now(),
  unique(user_id, merchant_name)
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.uploads enable row level security;
alter table public.transactions enable row level security;
alter table public.insights enable row level security;
alter table public.subscriptions enable row level security;
alter table public.merchant_preferences enable row level security;
alter table public.categories enable row level security;

-- RLS policies
create policy "users: own data" on public.users for all using (auth.uid() = id);
create policy "uploads: own data" on public.uploads for all using (auth.uid() = user_id);
create policy "transactions: own data" on public.transactions for all using (auth.uid() = user_id);
create policy "insights: own data" on public.insights for all using (auth.uid() = user_id);
create policy "subscriptions: own data" on public.subscriptions for all using (auth.uid() = user_id);
create policy "merchant_preferences: own data" on public.merchant_preferences for all using (auth.uid() = user_id);
create policy "categories: readable by all authenticated" on public.categories for select using (auth.role() = 'authenticated');
