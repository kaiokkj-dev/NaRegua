begin;

create extension if not exists btree_gist;

alter table public.appointments
  add column if not exists ends_at timestamptz;

update public.appointments
set ends_at = starts_at + duration_minutes * interval '1 minute'
where ends_at is null;

alter table public.appointments
  alter column ends_at set not null;

create or replace function public.set_appointment_ends_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.ends_at := new.starts_at + new.duration_minutes * interval '1 minute';
  return new;
end;
$$;

drop trigger if exists appointments_set_ends_at on public.appointments;
create trigger appointments_set_ends_at
before insert or update of starts_at, duration_minutes
on public.appointments
for each row execute function public.set_appointment_ends_at();

alter table public.appointments
  drop constraint if exists appointments_professional_no_overlap;

alter table public.appointments
  add constraint appointments_professional_no_overlap
  exclude using gist (
    barbershop_id with =,
    professional_id with =,
    (tstzrange(starts_at, ends_at, '[)')) with &&
  )
  where (professional_id is not null and status <> 'cancelled');

commit;
