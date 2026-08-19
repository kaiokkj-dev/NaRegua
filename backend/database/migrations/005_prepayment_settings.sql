begin;

alter table public.barbershops
  add column if not exists prepayment_enabled boolean not null default false,
  add column if not exists prepayment_percent integer not null default 50 check (prepayment_percent between 1 and 100),
  add column if not exists pix_key text check (pix_key is null or char_length(pix_key) <= 180),
  add column if not exists pix_holder_name text check (pix_holder_name is null or char_length(pix_holder_name) <= 100);

alter table public.appointments
  add column if not exists prepayment_required boolean not null default false,
  add column if not exists prepayment_cents integer not null default 0 check (prepayment_cents >= 0),
  add column if not exists payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'awaiting_manual_confirmation', 'confirmed', 'refunded'));

commit;
