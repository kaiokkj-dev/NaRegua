begin;

alter table public.clients add column if not exists email text;

alter table public.clients
  drop constraint if exists clients_email_format;

alter table public.clients
  add constraint clients_email_format
  check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

commit;
