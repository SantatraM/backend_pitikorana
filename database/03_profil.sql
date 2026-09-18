-- =========================================================
-- 1. REFERENTIEL : ROLE
-- =========================================================

create table if not exists role (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique
);

insert into role (code)
values
    ('ADMIN'),
    ('MEMBRE')
on conflict (code) do nothing;



-- =========================================================
-- 2. REFERENTIEL : STATUT DEMANDE INSCRIPTION
-- =========================================================

create table if not exists statut_demande_inscription (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique
);

insert into statut_demande_inscription (code)
values
    ('EN_ATTENTE'),
    ('VALIDEE'),
    ('REFUSEE'),
    ('ANNULEE')
on conflict (code) do nothing;



-- =========================================================
-- 3. REFERENTIEL : STATUT COMPTE MEMBRE
-- =========================================================

create table if not exists statut_compte_membre (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique
);

insert into statut_compte_membre (code)
values
    ('EN_ATTENTE_MOT_DE_PASSE'),
    ('ACTIF'),
    ('SUSPENDU')
on conflict (code) do nothing;



-- =========================================================
-- 4. COMPTE MEMBRE
-- =========================================================

create table if not exists compte_membre (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null
        references personne(id)
        on delete restrict,
    constraint compte_membre_personne_unique
        unique (id_personne),
    id_auth_user uuid not null
        references auth.users(id)
        on delete restrict,
    constraint compte_membre_auth_user_unique
        unique (id_auth_user),
    id_role uuid not null
        references role(id)
        on delete restrict,
    id_statut_compte uuid not null
        references statut_compte_membre(id)
        on delete restrict,
    date_creation timestamptz not null default now(),
    date_activation timestamptz
);



-- =========================================================
-- 5. DEMANDE INSCRIPTION
-- =========================================================

create table if not exists demande_inscription (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid
        references personne(id)
        on delete restrict,
    email varchar(255),
    telephone varchar(30),
    constraint demande_inscription_contact_check
        check (
            nullif(trim(email), '') is not null
            or nullif(trim(telephone), '') is not null
        ),
    reference varchar(50) not null unique,
    token_suivi_hash text not null,
    donnees jsonb not null default '{}'::jsonb,
    id_statut_demande uuid not null
        references statut_demande_inscription(id)
        on delete restrict,
    id_role_attribue uuid
        constraint demande_inscription_role_attribue_fk
        references role(id)
        on delete restrict,
    date_demande timestamptz not null default now(),
    date_traitement timestamptz,
    id_compte_admin_traitement uuid
        references compte_membre(id)
        on delete set null,
    commentaire_admin text
);

-- personne est créée dans 01_personne.sql avant compte_membre : la FK du
-- créateur est donc ajoutée ici, après la table compte_membre.
alter table personne
    add column if not exists id_compte_createur uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'personne_compte_createur_fk'
          and conrelid = 'personne'::regclass
    ) then
        alter table personne
            add constraint personne_compte_createur_fk
            foreign key (id_compte_createur)
            references compte_membre(id)
            on delete set null;
    end if;
end $$;

-- relation_personne est créée dans 01_personne.sql avant compte_membre : la
-- FK de son créateur est ajoutée ici après la création de compte_membre.
alter table relation_personne
    add column if not exists id_compte_createur uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'relation_personne_compte_createur_fk'
          and conrelid = 'relation_personne'::regclass
    ) then
        alter table relation_personne
            add constraint relation_personne_compte_createur_fk
            foreign key (id_compte_createur)
            references compte_membre(id)
            on delete set null;
    end if;
end $$;

-- Compatibilité avec les bases déjà créées avant l'attribution de rôle.
alter table demande_inscription
    add column if not exists id_role_attribue uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'demande_inscription_role_attribue_fk'
          and conrelid = 'demande_inscription'::regclass
    ) then
        alter table demande_inscription
            add constraint demande_inscription_role_attribue_fk
            foreign key (id_role_attribue)
            references role(id)
            on delete restrict;
    end if;
end $$;



-- =========================================================
-- 6. INDEX : DEMANDE INSCRIPTION
-- =========================================================

-- Recherche par email normalisé.
-- Seulement pour les demandes possédant un email.
create index if not exists idx_demande_inscription_email
on demande_inscription (lower(email))
where email is not null;


-- Recherche par téléphone.
create index if not exists idx_demande_inscription_telephone
on demande_inscription (telephone)
where telephone is not null;


-- Recherche / suivi par statut.
create index if not exists idx_demande_inscription_statut
on demande_inscription (id_statut_demande);


-- Recherche des demandes liées à une fiche Personne.
create index if not exists idx_demande_inscription_personne
on demande_inscription (id_personne);



-- =========================================================
-- 7. INDEX : COMPTE MEMBRE
-- =========================================================

create index if not exists idx_compte_membre_role
on compte_membre (id_role);


create index if not exists idx_compte_membre_statut
on compte_membre (id_statut_compte);
