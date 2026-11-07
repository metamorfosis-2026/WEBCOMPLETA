-- Entradas de la 7ma edicion: compra por Mercado Pago, QR y WhatsApp.
-- Es el mismo bloque que vive al final de schema.sql, aislado para poder
-- aplicarlo sobre una base que ya existe (Supabase > SQL Editor > Run).
-- Se puede correr mas de una vez: no borra nada.

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

-- Una fila por entrada (por persona). `code` es lo que va en el QR.
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  edition_label text not null,
  full_name text not null,
  phone text not null,                         -- WhatsApp en formato 549...
  email text,
  plan text not null,                          -- FULL | SPLIT
  total_cents integer not null,
  paid_cents integer not null default 0,
  status text not null default 'PENDIENTE',    -- PENDIENTE | SENADO | PAGADO | CANCELADO
  source text,
  notes text,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_phone_idx on public.tickets (phone);
create index if not exists tickets_status_idx on public.tickets (status, created_at desc);

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- Cada pago de una entrada: los de Mercado Pago (uno por payment id) y los
-- que se cargan a mano desde el admin (transferencia / efectivo).
create table if not exists public.ticket_payments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  installment integer not null default 1,
  amount_cents integer not null,
  method text not null default 'MERCADO_PAGO', -- MERCADO_PAGO | TRANSFERENCIA | EFECTIVO
  status text not null,                        -- approved | pending | rejected | refunded | ...
  status_detail text,
  mp_payment_id text unique,
  payer_email text,
  recorded_by text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_payments_ticket_idx on public.ticket_payments (ticket_id, created_at);

drop trigger if exists ticket_payments_set_updated_at on public.ticket_payments;
create trigger ticket_payments_set_updated_at
before update on public.ticket_payments
for each row execute function public.set_updated_at();

-- Ingresos en la puerta (uno por dia: el taller dura sabado y domingo).
create table if not exists public.ticket_checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  checked_in_by text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_checkins_ticket_idx on public.ticket_checkins (ticket_id, created_at);

-- Registro de mensajes de WhatsApp (enviados y recibidos): es la memoria del bot.
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  direction text not null,                     -- OUT | IN
  phone text not null,
  kind text,                                   -- CONFIRMACION | SENA | SALDO | VISPERA | BOT | ...
  body text,
  provider text,
  ok boolean not null default true,
  error text,
  external_id text,                            -- id del mensaje en WhatsApp (evita contestar dos veces)
  created_at timestamptz not null default now()
);

alter table public.whatsapp_messages add column if not exists external_id text;
create unique index if not exists whatsapp_messages_external_idx
  on public.whatsapp_messages (external_id) where external_id is not null;

create index if not exists whatsapp_messages_ticket_idx on public.whatsapp_messages (ticket_id, created_at desc);
create index if not exists whatsapp_messages_phone_idx on public.whatsapp_messages (phone, created_at desc);

-- Solo el servidor (service role) lee y escribe estas tablas. Con RLS activo
-- y sin politicas, la clave publica del navegador no puede ver nombres,
-- telefonos ni pagos.
alter table public.tickets enable row level security;
alter table public.ticket_payments enable row level security;
alter table public.ticket_checkins enable row level security;
alter table public.whatsapp_messages enable row level security;
