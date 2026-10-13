-- =========================================================
-- MODULE TETIK'ASA — V1 : DRAFITA
-- Migration à exécuter après les schémas 01 à 18.
-- Cette migration crée uniquement le schéma de préparation.
-- =========================================================

-- Les futurs statuts peuvent être ajoutés comme données de référence.
create table if not exists statut_tetikasa (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique,
    ordre integer not null unique,
    constraint statut_tetikasa_ordre_check check (ordre > 0)
);

insert into statut_tetikasa (code, ordre)
values ('DRAFITRA', 1)
on conflict (code) do nothing;

-- Les champs de contenu forment un snapshot indépendant du Soso-kevitra.
create table if not exists tetikasa (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra_source uuid
        references soso_kevitra(id)
        on delete restrict,
    created_by uuid not null
        references personne(id)
        on delete restrict,
    id_statut_tetikasa uuid not null
        references statut_tetikasa(id)
        on delete restrict,
    titre varchar(200),
    description text,
    raison text,
    objectif text,
    beneficiaires text,
    lieu text,
    lieu_non_defini boolean not null default false,
    periode_source_soso text,
    ressources_source_soso text,
    date_debut_prevue date,
    date_fin_prevue date,
    devise varchar(3) not null default 'MGA',
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    -- Un Soso-kevitra renseigné ne peut produire qu'un seul Tetikasa.
    constraint tetikasa_soso_kevitra_source_unique unique (id_soso_kevitra_source),
    constraint tetikasa_dates_previsionnelles_check check (
        date_debut_prevue is null
        or date_fin_prevue is null
        or date_fin_prevue >= date_debut_prevue
    )
);

-- Le responsable principal est optionnel pendant DRAFITRA.
create table if not exists tetikasa_responsable (
    id uuid primary key default gen_random_uuid(),
    id_tetikasa uuid not null
        references tetikasa(id)
        on delete cascade,
    id_personne uuid not null
        references personne(id)
        on delete restrict,
    type_responsabilite varchar(20) not null,
    date_creation timestamptz not null default now(),
    constraint tetikasa_responsable_type_check
        check (type_responsabilite in ('PRINCIPAL', 'ASSOCIE')),
    constraint tetikasa_responsable_personne_unique
        unique (id_tetikasa, id_personne)
);

-- Index partiel : plusieurs ASSOCIE sont autorisés, un seul PRINCIPAL maximum.
create unique index if not exists tetikasa_responsable_principal_unique
    on tetikasa_responsable (id_tetikasa)
    where type_responsabilite = 'PRINCIPAL';

create table if not exists tetikasa_action (
    id uuid primary key default gen_random_uuid(),
    id_tetikasa uuid not null
        references tetikasa(id)
        on delete cascade,
    titre text not null,
    description text,
    id_responsable uuid
        references personne(id)
        on delete restrict,
    date_debut_prevue date,
    date_fin_prevue date,
    ordre integer not null,
    constraint tetikasa_action_ordre_check check (ordre > 0),
    constraint tetikasa_action_dates_previsionnelles_check check (
        date_debut_prevue is null
        or date_fin_prevue is null
        or date_fin_prevue >= date_debut_prevue
    ),
    constraint tetikasa_action_ordre_unique unique (id_tetikasa, ordre)
);

-- Les ressources structurées ne transforment pas le texte source automatiquement.
create table if not exists tetikasa_ressource (
    id uuid primary key default gen_random_uuid(),
    id_tetikasa uuid not null
        references tetikasa(id)
        on delete cascade,
    type_ressource varchar(30) not null,
    description text not null,
    quantite numeric(12,3),
    unite varchar(100),
    observation text,
    ordre integer not null,
    constraint tetikasa_ressource_type_check check (
        type_ressource in (
            'OLONA',
            'FAHAIZA_MANAO',
            'FITAOVANA_ZAVATRA',
            'FITATERANA',
            'TOERANA',
            'HAFA'
        )
    ),
    constraint tetikasa_ressource_quantite_check
        check (quantite is null or quantite > 0),
    constraint tetikasa_ressource_ordre_check check (ordre > 0),
    constraint tetikasa_ressource_ordre_unique unique (id_tetikasa, ordre)
);

-- Le budget total est calculé par SUM(quantite * prix_unitaire_estime).
create table if not exists tetikasa_ligne_budget (
    id uuid primary key default gen_random_uuid(),
    id_tetikasa uuid not null
        references tetikasa(id)
        on delete cascade,
    designation text not null,
    quantite numeric(12,3) not null,
    prix_unitaire_estime numeric(18,2) not null,
    ordre integer not null,
    constraint tetikasa_ligne_budget_quantite_check check (quantite > 0),
    constraint tetikasa_ligne_budget_prix_check check (prix_unitaire_estime >= 0),
    constraint tetikasa_ligne_budget_ordre_check check (ordre > 0),
    constraint tetikasa_ligne_budget_ordre_unique unique (id_tetikasa, ordre)
);

-- Les documents du projet sont indépendants des photos du Soso-kevitra.
create table if not exists tetikasa_document (
    id uuid primary key default gen_random_uuid(),
    id_tetikasa uuid not null
        references tetikasa(id)
        on delete cascade,
    chemin_fichier text not null unique,
    nom_original varchar(255) not null,
    type_mime varchar(150) not null,
    taille_octets bigint not null,
    description text,
    ordre integer not null,
    uploaded_by uuid not null
        references personne(id)
        on delete restrict,
    date_creation timestamptz not null default now(),
    constraint tetikasa_document_taille_check check (taille_octets > 0),
    constraint tetikasa_document_ordre_check check (ordre > 0),
    constraint tetikasa_document_ordre_unique unique (id_tetikasa, ordre)
);

-- V1 utilise CREATION_DRAFT; les futurs codes restent ajoutables sans migration.
create table if not exists tetikasa_historique (
    id uuid primary key default gen_random_uuid(),
    id_tetikasa uuid not null
        references tetikasa(id)
        on delete cascade,
    action varchar(50) not null,
    id_acteur uuid not null
        references personne(id)
        on delete restrict,
    commentaire text,
    date_creation timestamptz not null default now()
);

-- Les UNIQUE(id_tetikasa, ordre) couvrent déjà les accès enfants par projet.
create index if not exists idx_tetikasa_id_statut_tetikasa
    on tetikasa(id_statut_tetikasa);

create index if not exists idx_tetikasa_created_by
    on tetikasa(created_by);

create index if not exists idx_tetikasa_historique_id_tetikasa
    on tetikasa_historique(id_tetikasa);
