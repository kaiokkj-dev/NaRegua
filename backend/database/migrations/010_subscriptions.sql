begin;

create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  professional_limit integer,
  monthly_appointment_limit integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, price_cents, professional_limit, monthly_appointment_limit, features)
values
  ('essential', 'Essencial', 0, 1, 100, '{"coupons":false,"prepayment":false,"priority_support":false}'::jsonb),
  ('pro', 'Pro', 2990, 5, null, '{"coupons":true,"prepayment":true,"priority_support":false}'::jsonb),
  ('black', 'Black', 5990, null, null, '{"coupons":true,"prepayment":true,"priority_support":true}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  professional_limit = excluded.professional_limit,
  monthly_appointment_limit = excluded.monthly_appointment_limit,
  features = excluded.features,
  active = true;

create table if not exists public.subscriptions (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code) default 'essential',
  status text not null default 'active' check (status in ('trialing','active','past_due','cancelled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_provider_subscription_idx
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create or replace function public.ensure_barbershop_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (barbershop_id, plan_code, status)
  values (new.id, 'essential', 'active')
  on conflict (barbershop_id) do nothing;
  return new;
end;
$$;

drop trigger if exists barbershops_create_subscription on public.barbershops;
create trigger barbershops_create_subscription
after insert on public.barbershops
for each row execute function public.ensure_barbershop_subscription();

insert into public.subscriptions (barbershop_id, plan_code, status, trial_ends_at)
select id, 'pro', 'trialing', now() + interval '14 days'
from public.barbershops
on conflict (barbershop_id) do nothing;

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;

commit;
