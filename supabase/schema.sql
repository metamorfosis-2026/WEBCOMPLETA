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
  price_cents integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, sequence)
);

alter table public.edition_phases
add column if not exists price_cents integer not null default 0;

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

create table if not exists public.gift_invitations (
  id uuid primary key default gen_random_uuid(),
  giver_user_id uuid not null references public.users(id) on delete cascade,
  edition_id uuid not null references public.editions(id) on delete cascade,
  recipient_first_name text not null,
  recipient_last_name text not null,
  recipient_phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gift_invitations_giver_edition_idx
on public.gift_invitations (giver_user_id, edition_id);

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

drop trigger if exists gift_invitations_set_updated_at on public.gift_invitations;
create trigger gift_invitations_set_updated_at
before update on public.gift_invitations
for each row execute function public.set_updated_at();

create table if not exists public.weekly_tasks (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  phase_id uuid references public.edition_phases(id) on delete cascade,
  week_number integer not null default 1,
  title text not null,
  summary text,
  body text,
  resource_url text,
  due_at timestamptz,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_tasks_phase_idx on public.weekly_tasks (phase_id, week_number, sort_order);

alter table public.weekly_tasks
  alter column edition_id drop not null;

alter table public.weekly_tasks
  add column if not exists phase_sequence integer;

alter table public.weekly_tasks
  add column if not exists assigned_user_id uuid references public.users(id) on delete cascade;

create index if not exists weekly_tasks_phase_seq_idx on public.weekly_tasks (phase_sequence, week_number);
create index if not exists weekly_tasks_assigned_user_idx on public.weekly_tasks (assigned_user_id, week_number);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  edition_id uuid references public.editions(id) on delete set null,
  phase_id uuid references public.edition_phases(id) on delete set null,
  title text not null,
  description text,
  icon text,
  awarded_by_id uuid references public.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id, awarded_at desc);

drop trigger if exists user_achievements_set_updated_at on public.user_achievements;
create trigger user_achievements_set_updated_at
before update on public.user_achievements
for each row execute function public.set_updated_at();

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  cta_label text,
  cta_url text,
  audience text not null default 'ALL',
  edition_id uuid references public.editions(id) on delete set null,
  phase_id uuid references public.edition_phases(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_pinned boolean not null default false,
  is_published boolean not null default true,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_published_idx on public.news_posts (is_published, is_pinned, created_at desc);

create table if not exists public.greek_gods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  epithet text,
  description text,
  pdf_url text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_god_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  god_id uuid not null references public.greek_gods(id) on delete cascade,
  custom_pdf_url text,
  notes text,
  assigned_by_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists weekly_tasks_set_updated_at on public.weekly_tasks;
create trigger weekly_tasks_set_updated_at
before update on public.weekly_tasks
for each row execute function public.set_updated_at();

drop trigger if exists news_posts_set_updated_at on public.news_posts;
create trigger news_posts_set_updated_at
before update on public.news_posts
for each row execute function public.set_updated_at();

drop trigger if exists greek_gods_set_updated_at on public.greek_gods;
create trigger greek_gods_set_updated_at
before update on public.greek_gods
for each row execute function public.set_updated_at();

drop trigger if exists user_god_assignments_set_updated_at on public.user_god_assignments;
create trigger user_god_assignments_set_updated_at
before update on public.user_god_assignments
for each row execute function public.set_updated_at();
