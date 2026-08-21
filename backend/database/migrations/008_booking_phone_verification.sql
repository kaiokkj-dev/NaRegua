begin;

create table if not exists public.booking_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  token_hash text,
  attempts integer not null default 0 check (attempts between 0 and 10),
  expires_at timestamptz not null,
  verified_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_phone_verifications_lookup_idx
  on public.booking_phone_verifications(barbershop_id, phone, created_at desc);

alter table public.booking_phone_verifications enable row level security;

commit;
