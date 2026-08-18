begin;

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique,
  email text not null,
  name text not null,
  avatar_url text,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_normalized check (email = lower(trim(email)))
);

alter table public.users add column if not exists google_sub text;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists last_login_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();
create unique index if not exists users_google_sub_unique on public.users(google_sub) where google_sub is not null;

create unique index if not exists users_email_unique_lower on public.users (lower(email));

create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  phone text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barbershop_members (
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'professional')),
  created_at timestamptz not null default now(),
  primary key (barbershop_id, user_id)
);

create index if not exists barbershop_members_user_idx on public.barbershop_members(user_id);

alter table public.users enable row level security;
alter table public.barbershops enable row level security;
alter table public.barbershop_members enable row level security;

create or replace function public.create_barbershop_for_user(
  p_user_id uuid,
  p_user_name text,
  p_shop_name text,
  p_slug text,
  p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_barbershop_id uuid;
begin
  if exists (select 1 from public.barbershop_members where user_id = p_user_id) then
    raise exception 'Usuário já pertence a uma barbearia';
  end if;

  update public.users set name = p_user_name, updated_at = now() where id = p_user_id;
  insert into public.barbershops (name, slug, phone, created_by)
  values (p_shop_name, p_slug, p_phone, p_user_id)
  returning id into new_barbershop_id;

  insert into public.barbershop_members (barbershop_id, user_id, role)
  values (new_barbershop_id, p_user_id, 'owner');
  return new_barbershop_id;
end;
$$;

revoke all on function public.create_barbershop_for_user(uuid, text, text, text, text) from public;
grant execute on function public.create_barbershop_for_user(uuid, text, text, text, text) to service_role;

commit;
