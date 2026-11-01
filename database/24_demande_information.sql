-- PREPARED ONLY. Apply manually after explicit authorization, after migration 23.
-- No existing role, Personne or Contribution table is altered.
begin;
-- Pin name resolution for the manual migration and its foreign keys.
set local search_path = pg_catalog, public;

create table public.demande_information (
    id uuid primary key default gen_random_uuid(),
    nom varchar(100) not null check (char_length(btrim(nom)) between 1 and 100),
    prenom varchar(100) not null check (char_length(btrim(prenom)) between 1 and 100),
    contact varchar(255) not null check (char_length(btrim(contact)) between 3 and 255),
    message text not null check (char_length(btrim(message)) between 10 and 5000),
    origine varchar(8) not null check (origine in ('VISITEUR', 'MEMBRE')),
    id_compte_membre uuid references public.compte_membre(id) on delete set null,
    statut varchar(10) not null default 'NOUVELLE' check (statut in ('NOUVELLE', 'EN_COURS', 'TRAITEE')),
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    revision integer not null default 1 check (revision > 0),
    id_compte_modificateur uuid references public.compte_membre(id) on delete set null,
    cle_idempotence uuid not null unique,
    empreinte_contenu char(64) not null check (empreinte_contenu ~ '^[0-9a-f]{64}$'),
    check (origine <> 'VISITEUR' or id_compte_membre is null)
);
create index demande_information_date_idx on public.demande_information (date_creation desc, id desc);
create index demande_information_statut_date_idx on public.demande_information (statut, date_creation desc, id desc);

-- Indexes on nullable referencing columns avoid full scans when a member
-- account is deleted and the references are set to NULL.
create index demande_information_compte_membre_idx on public.demande_information (id_compte_membre)
    where id_compte_membre is not null;
create index demande_information_compte_modificateur_idx on public.demande_information (id_compte_modificateur)
    where id_compte_modificateur is not null;

-- One row per pseudonymized subject, action and fixed time window.
create table public.demande_information_quota (
    cle char(64) not null,
    fenetre timestamptz not null,
    nombre integer not null check (nombre > 0),
    expiration timestamptz not null,
    primary key (cle, fenetre)
);
create index demande_information_quota_expiration_idx on public.demande_information_quota (expiration);

-- No direct public/PostgREST access, including for a logged-in client.
alter table public.demande_information enable row level security;
alter table public.demande_information_quota enable row level security;
revoke all on public.demande_information, public.demande_information_quota from public, anon, authenticated;
-- The trusted backend SQL connection must use a table-owning/BYPASSRLS role.
-- No permissive policies or client-side grants are created here.
commit;
