-- Tabla de inscripciones desde la landing (nombre + whatsapp + red social).
-- Es el mismo bloque que vive en schema.sql, aislado para poder aplicarlo
-- sobre una base que ya existe sin volver a correr el esquema completo.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  social text,
  edition_label text,
  source text,
  status text not null default 'NUEVO',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signups_created_idx on public.signups (created_at desc);
create index if not exists signups_status_idx on public.signups (status, created_at desc);

drop trigger if exists signups_set_updated_at on public.signups;
create trigger signups_set_updated_at
before update on public.signups
for each row execute function public.set_updated_at();
