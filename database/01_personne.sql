create extension if not exists "pgcrypto";


-- =========================================================
-- LANGUE
-- =========================================================

create table if not exists langue ( --FAIT
    id uuid primary key default gen_random_uuid(),
    code varchar(10) not null unique,
    nom varchar(100) not null
);


-- =========================================================
-- SEXE
-- =========================================================

create table if not exists sexe (
    id uuid primary key default gen_random_uuid()
);

create table if not exists sexe_traduction (
    id uuid primary key default gen_random_uuid(),
    id_sexe uuid not null references sexe(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(50) not null,
    unique(id_sexe, id_langue)
);


-- =========================================================
-- STATUT
-- =========================================================

create table if not exists statut ( 
    id uuid primary key default gen_random_uuid()
);
create table if not exists statut_traduction (
    id uuid primary key default gen_random_uuid(),
    id_statut uuid not null references statut(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(100) not null,
    unique(id_statut, id_langue)
);


-- =========================================================
-- PAYS
-- =========================================================

create table if not exists pays ( --FAIT
    id uuid primary key default gen_random_uuid(),
    nom varchar(100) not null unique
);


-- =========================================================
-- REGION
-- =========================================================

create table if not exists region ( --FAIT
    id uuid primary key default gen_random_uuid(),
    nom varchar(100) not null,
    id_pays uuid not null references pays(id),
    unique(nom, id_pays)
);


-- =========================================================
-- VILLE / COMMUNE
-- =========================================================

create table if not exists ville ( --FAIT
    id uuid primary key default gen_random_uuid(),
    nom varchar(100) not null,
    id_region uuid not null references region(id),
    unique(nom, id_region)
);

-- =========================================================
-- LIEN AVEC FALIMANJAKA
-- =========================================================

create table if not exists lien_avec_falimanjaka (
    id uuid primary key default gen_random_uuid()
);

create table if not exists lien_avec_falimanjaka_traduction (
    id uuid primary key default gen_random_uuid(),
    id_lien uuid not null references lien_avec_falimanjaka(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(100) not null,
    unique(id_lien, id_langue)
);


-- =========================================================
-- TYPE ELEMENT
-- RAZAMBE / TARANAKA / SAMPANA
-- =========================================================

create table if not exists type_element (
    id uuid primary key default gen_random_uuid()
);

create table if not exists type_element_traduction (
    id uuid primary key default gen_random_uuid(),
    id_type_element uuid not null references type_element(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(100) not null,
    unique(id_type_element, id_langue)
);


-- =========================================================
-- ELEMENT
-- =========================================================

create table if not exists element (
    id uuid primary key default gen_random_uuid(),
    id_type_element uuid not null references type_element(id),
    nom varchar(100) not null,
    autres_appellations varchar(255),
    id_sexe uuid references sexe(id),
    nom_conjoint varchar(100),
    ville_origine_conjoint varchar(150),
    rattachement_sup uuid references element(id),
    etat smallint not null default 0
        check (etat in (0, 1, 2))
);


-- =========================================================
-- PERSONNE
-- =========================================================

create table if not exists personne (
    id uuid primary key default gen_random_uuid(),
    nom varchar(100) not null,
    prenom varchar(100),
    nom_usage varchar(100),
    autres_appellations varchar(255),
    id_sexe uuid references sexe(id),
    id_statut uuid references statut(id),
    annee_naissance smallint
        check (
            annee_naissance is null
            or annee_naissance between 1800 and 2100
        ),
    lieu_naissance varchar(150),
    adresse varchar(255),
    id_ville uuid references ville(id),
    id_lien uuid references lien_avec_falimanjaka(id),
    id_element uuid references element(id)
);


-- =========================================================
-- CONTACTS PERSONNE
-- =========================================================

create table if not exists contacts_personne (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null references personne(id) on delete cascade,
    telephone varchar(30),
    whatsapp varchar(30),
    email varchar(150),
    facebook varchar(150),
    lien_facebook text
);


-- =========================================================
-- TYPE RELATION
-- =========================================================

create table if not exists type_relation (
    id uuid primary key default gen_random_uuid(),
);

create table if not exists type_relation_traduction (
    id uuid primary key default gen_random_uuid(),
    id_type_relation uuid not null references type_relation(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(100) not null,
    unique(id_type_relation, id_langue)
);


-- =========================================================
-- RELATION ENTRE PERSONNES
-- =========================================================

create table if not exists relation_personne (
    id uuid primary key default gen_random_uuid(),
    id_personne_1 uuid not null references personne(id) on delete cascade,
    id_personne_2 uuid not null references personne(id) on delete cascade,
    id_type_relation uuid not null references type_relation(id),
    unique(
        id_personne_1,
        id_personne_2,
        id_type_relation
    ),
    check(id_personne_1 <> id_personne_2)
);


-- =========================================================
-- PHOTOS PERSONNE
-- =========================================================

create table if not exists photos_personne (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null references personne(id) on delete cascade,
    lien_photo text not null,
    est_principale boolean not null default false,
    created_at timestamptz not null default now()
);


-- =========================================================
-- BUCKET SUPABASE STORAGE
-- =========================================================

insert into storage.buckets (
    id,
    name,
    public
)
values (
    'photos_personne',
    'photos_personne',
    true
)
on conflict (id) do nothing;


-- =========================================================
-- DOMAINE D'ACTIVITE
-- =========================================================

create table if not exists domaine_activite (
    id uuid primary key default gen_random_uuid()
);

create table if not exists domaine_activite_traduction (
    id uuid primary key default gen_random_uuid(),
    id_domaine_activite uuid not null references domaine_activite(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(150) not null,
    unique(id_domaine_activite, id_langue)
);


-- =========================================================
-- ACTIVITE
-- =========================================================

create table if not exists activite (
    id uuid primary key default gen_random_uuid(),
    id_domaine_activite uuid references domaine_activite(id)
);

create table if not exists activite_traduction (
    id uuid primary key default gen_random_uuid(),
    id_activite uuid not null references activite(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(150) not null,
    unique(id_activite, id_langue)
);


-- =========================================================
-- ACTIVITE D'UNE PERSONNE
-- =========================================================

create table if not exists personne_activite (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null references personne(id) on delete cascade,
    id_activite uuid not null references activite(id),
    est_actuelle boolean not null default true,
    unique(id_personne, id_activite)
);


-- =========================================================
-- COMPETENCE
-- =========================================================

create table if not exists competence (
    id uuid primary key default gen_random_uuid()
);

create table if not exists competence_traduction (
    id uuid primary key default gen_random_uuid(),
    id_competence uuid not null references competence(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(150) not null,
    unique(id_competence, id_langue)
);


-- =========================================================
-- COMPETENCE D'UNE PERSONNE
-- =========================================================

create table if not exists personne_competence (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null references personne(id) on delete cascade,
    id_competence uuid not null references competence(id) on delete cascade,
    partageable boolean not null default false,
    unique(id_personne,id_competence)
);


-- =========================================================
-- CENTRE D'INTERET
-- =========================================================

create table if not exists centre_interet (
    id uuid primary key default gen_random_uuid()
);

create table if not exists centre_interet_traduction (
    id uuid primary key default gen_random_uuid(),
    id_centre_interet uuid not null references centre_interet(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(150) not null,
    unique(id_centre_interet, id_langue)
);


-- =========================================================
-- CENTRE D'INTERET D'UNE PERSONNE
-- =========================================================

create table if not exists personne_centre_interet (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null references personne(id) on delete cascade,
    id_centre_interet uuid not null references centre_interet(id) on delete cascade,
    unique(id_personne,id_centre_interet)
);