-- PREPARED ONLY: apply MANUALLY. No execution by the assistant.
-- Existing references and scrypt hashes remain unchanged. No backfill is needed.
begin;
set local search_path = pg_catalog, public;
-- Dedicated private registry: no new column or grant on existing request data.
create table public.inscription_code_suivi (
  empreinte text primary key check (empreinte ~ '^[0-9a-f]{64}$'),
  id_demande uuid not null unique references public.demande_inscription(id) on delete cascade
);
create table public.inscription_suivi_quota (
  cle char(64) not null check (cle ~ '^[0-9a-f]{64}$'),
  fenetre timestamptz not null,
  nombre integer not null check (nombre > 0),
  expiration timestamptz not null check (expiration > fenetre),
  primary key (cle, fenetre)
);
create index inscription_suivi_quota_expiration_idx on public.inscription_suivi_quota (expiration);
alter table public.inscription_code_suivi enable row level security;
alter table public.inscription_suivi_quota enable row level security;
revoke all on public.inscription_code_suivi, public.inscription_suivi_quota from public, anon, authenticated;
-- Trusted backend uses a table-owning/BYPASSRLS SQL role. No client policy.
-- The existing demande_inscription table's grants/RLS are NOT altered here.
commit;
