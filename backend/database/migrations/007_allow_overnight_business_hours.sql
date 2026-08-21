begin;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.business_hours'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%opens_at%<%closes_at%'
        or pg_get_constraintdef(oid) ilike '%break_starts_at%<%break_ends_at%'
      )
  loop
    execute format('alter table public.business_hours drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table public.business_hours
  drop constraint if exists business_hours_open_close_not_equal,
  drop constraint if exists business_hours_break_not_equal;

alter table public.business_hours
  add constraint business_hours_open_close_not_equal
  check (opens_at <> closes_at);

alter table public.business_hours
  add constraint business_hours_break_not_equal
  check (break_starts_at <> break_ends_at);

commit;
