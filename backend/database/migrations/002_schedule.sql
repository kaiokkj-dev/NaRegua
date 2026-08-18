begin;

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  phone text not null,
  created_at timestamptz not null default now(),
  unique (barbershop_id, phone)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (barbershop_id, name)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  professional_id uuid references public.professionals(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer not null default 0 check (price_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text check (char_length(notes) <= 1000),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professionals_shop_idx on public.professionals(barbershop_id);
create index if not exists clients_shop_idx on public.clients(barbershop_id);
create index if not exists services_shop_idx on public.services(barbershop_id);
create index if not exists appointments_shop_starts_idx on public.appointments(barbershop_id, starts_at);

alter table public.professionals enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

commit;
