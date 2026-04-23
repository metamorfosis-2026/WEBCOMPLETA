create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_auth_id uuid unique,
  name text,
  email text unique,
  image text,
  email_verified timestamptz,
  role text not null default 'USER',
  status text not null default 'INTERESADO',
  referral_code text unique,
  referred_by_id uuid references public.users(id) on delete set null,
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  points integer not null,
  reason text not null,
  metadata text,
  created_at timestamptz not null default now()
);

create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sequence integer not null unique,
  is_current boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edition_phases (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  slug text not null unique,
  title text not null,
  sequence integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, sequence)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  edition_id uuid not null references public.editions(id) on delete cascade,
  phase_id uuid references public.edition_phases(id) on delete cascade,
  status text not null default 'PENDIENTE',
  amount_due_cents integer not null default 0,
  currency text not null default 'ARS',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enrollments
add column if not exists phase_id uuid references public.edition_phases(id) on delete cascade;

alter table public.enrollments
drop constraint if exists enrollments_user_id_edition_id_key;

create unique index if not exists enrollments_user_edition_phase_idx
on public.enrollments (user_id, edition_id, phase_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'ARS',
  status text not null default 'CONFIRMADO',
  method text not null default 'TRANSFERENCIA',
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  recorded_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists editions_set_updated_at on public.editions;
create trigger editions_set_updated_at
before update on public.editions
for each row execute function public.set_updated_at();

drop trigger if exists edition_phases_set_updated_at on public.edition_phases;
create trigger edition_phases_set_updated_at
before update on public.edition_phases
for each row execute function public.set_updated_at();

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();
