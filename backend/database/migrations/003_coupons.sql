begin;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  code text not null check (code = upper(trim(code)) and char_length(code) between 3 and 24),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (barbershop_id, code)
);

alter table public.appointments add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.appointments add column if not exists original_price_cents integer check (original_price_cents >= 0);
alter table public.appointments add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);
create index if not exists coupons_shop_code_idx on public.coupons(barbershop_id, code);
alter table public.coupons enable row level security;

commit;
