begin;

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  closed boolean not null default false,
  opens_at time not null default '08:00',
  closes_at time not null default '18:00',
  break_enabled boolean not null default true,
  break_starts_at time not null default '12:00',
  break_ends_at time not null default '13:00',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, weekday),
  check (opens_at < closes_at),
  check (break_starts_at < break_ends_at)
);

alter table public.business_hours enable row level security;

drop policy if exists business_hours_owner_select on public.business_hours;
create policy business_hours_owner_select on public.business_hours
for select using (
  exists (
    select 1 from public.barbershop_members
    where barbershop_members.barbershop_id = business_hours.barbershop_id
      and barbershop_members.user_id = auth.uid()
  )
);

drop policy if exists business_hours_owner_insert on public.business_hours;
create policy business_hours_owner_insert on public.business_hours
for insert with check (
  exists (
    select 1 from public.barbershop_members
    where barbershop_members.barbershop_id = business_hours.barbershop_id
      and barbershop_members.user_id = auth.uid()
  )
);

drop policy if exists business_hours_owner_update on public.business_hours;
create policy business_hours_owner_update on public.business_hours
for update using (
  exists (
    select 1 from public.barbershop_members
    where barbershop_members.barbershop_id = business_hours.barbershop_id
      and barbershop_members.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.barbershop_members
    where barbershop_members.barbershop_id = business_hours.barbershop_id
      and barbershop_members.user_id = auth.uid()
  )
);

commit;
