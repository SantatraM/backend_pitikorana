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

create table if not exists sexe ( --homme ou femme
    id uuid primary key default gen_random_uuid()
);

create table if not exists sexe_traduction (
    id uuid primary key default gen_random_uuid(),
    id_sexe uuid not null references sexe(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(50) not null,
    unique(id_sexe, id_langue)
);

ALTER TABLE sexe
ADD COLUMN code varchar(50);

ALTER TABLE sexe
ALTER COLUMN code SET NOT NULL;

ALTER TABLE sexe
ADD CONSTRAINT sexe_code_unique UNIQUE (code);


-- =========================================================
-- STATUT
-- =========================================================

create table if not exists statut ( --vivant ou mort 
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique
);

insert into statut (code)
values
    ('VIVANT'),
    ('DECEDE')
on conflict (code) do nothing;

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
    id uuid primary key default gen_random_uuid(),
    libelle varchar(100) not null
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

create index if not exists idx_element_type
on element(id_type_element);

create index if not exists idx_element_rattachement
on element(rattachement_sup);

alter table element
add constraint chk_element_no_self_parent
check (
  rattachement_sup is null
  or rattachement_sup <> id
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
    -- Naissance
    date_naissance date,
    annee_naissance smallint
        check (
            annee_naissance is null
            or annee_naissance between 1800 and 2100
        ),
    lieu_naissance varchar(150),
    -- Décès
    date_deces date,

    annee_deces smallint
        check (
            annee_deces is null
            or annee_deces between 1800 and 2100
        ),
    adresse varchar(255),
    id_ville uuid references ville(id),
    id_lien uuid references lien_avec_falimanjaka(id),
    id_element uuid references element(id),
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    -- L'année de décès ne peut pas précéder
    -- l'année de naissance
    check (
        annee_naissance is null
        or annee_deces is null
        or annee_deces >= annee_naissance
    ),
    -- Si date et année de naissance sont renseignées,
    -- elles doivent correspondre
    check (
        date_naissance is null
        or annee_naissance is null
        or extract(year from date_naissance)::smallint = annee_naissance
    ),
    -- Même principe pour le décès
    check (
        date_deces is null
        or annee_deces is null
        or extract(year from date_deces)::smallint = annee_deces
    ),
    -- Une date de décès ne peut pas précéder
    -- une date de naissance
    check (
        date_naissance is null
        or date_deces is null
        or date_deces >= date_naissance
    )
);

alter table personne
    add column if not exists date_creation timestamptz not null default now();

alter table personne
    add column if not exists date_modification timestamptz not null default now();

create index if not exists idx_personne_sexe on personne(id_sexe);
create index if not exists idx_personne_statut on personne(id_statut);
create index if not exists idx_personne_ville on personne(id_ville);
create index if not exists idx_personne_lien on personne(id_lien);
create index if not exists idx_personne_element on personne(id_element);
create index if not exists idx_personne_nom on personne(nom);

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

alter table contacts_personne
add constraint contacts_personne_id_personne_unique
unique (id_personne);

-- =========================================================
-- TYPE RELATION
-- =========================================================

create table if not exists type_relation ( --mère,père,enfant,frère et soeur
    id uuid primary key default gen_random_uuid()
);

create table if not exists type_relation_traduction (
    id uuid primary key default gen_random_uuid(),
    id_type_relation uuid not null references type_relation(id) on delete cascade,
    id_langue uuid not null references langue(id) on delete cascade,
    libelle varchar(100) not null,
    unique(id_type_relation, id_langue)
);

ALTER TABLE type_relation
ADD COLUMN id_inverse_defaut uuid,
ADD COLUMN id_inverse_masculin uuid,
ADD COLUMN id_inverse_feminin uuid;

ALTER TABLE type_relation
ADD CONSTRAINT fk_type_relation_inverse_defaut
    FOREIGN KEY (id_inverse_defaut)
    REFERENCES type_relation(id),

ADD CONSTRAINT fk_type_relation_inverse_masculin
    FOREIGN KEY (id_inverse_masculin)
    REFERENCES type_relation(id),

ADD CONSTRAINT fk_type_relation_inverse_feminin
    FOREIGN KEY (id_inverse_feminin)
    REFERENCES type_relation(id);


-- =========================================================
-- RELATION ENTRE PERSONNES
-- =========================================================

create table if not exists relation_personne (
    id uuid primary key default gen_random_uuid(),
    id_personne_source uuid not null
        references personne(id)
        on delete cascade,
    id_personne_cible uuid not null
        references personne(id)
        on delete cascade,
    id_type_relation uuid not null
        references type_relation(id),
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    constraint relation_personne_source_cible_unique
        unique (
            id_personne_source,
            id_personne_cible
        ),
    constraint relation_personne_source_cible_different
        check (
            id_personne_source <> id_personne_cible
        )

);

alter table relation_personne
    add column if not exists date_creation timestamptz not null default now();

alter table relation_personne
    add column if not exists date_modification timestamptz not null default now();
-- =========================================================
-- PHOTOS PERSONNE
-- =========================================================

create table if not exists photos_personne (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null
        references personne(id)
        on delete cascade,
    chemin_photo text not null,
    unique (id_personne),
    unique (chemin_photo)
);


-- =========================================================
-- CONFIDENTIALITÉ D'UNE PERSONNE
-- L'absence de ligne est interprétée côté application comme PRIVE.
-- =========================================================

create table if not exists confidentialite_personne (
    id uuid primary key default gen_random_uuid(),
    id_personne uuid not null references personne(id) on delete cascade,
    champ varchar(30) not null,
    visibilite varchar(20) not null,
    date_modification timestamptz not null default now(),

    constraint confidentialite_personne_personne_champ_unique
        unique (id_personne, champ),

    constraint confidentialite_personne_champ_check
        check (champ in (
            'EMAIL',
            'FACEBOOK',
            'TELEPHONE',
            'WHATSAPP',
            'ADRESSE',
            'PHOTO'
        )),

    constraint confidentialite_personne_visibilite_check
        check (visibilite in ('PRIVE', 'MEMBRES'))
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
    lieu_travail varchar,
    etude_en_cours varchar,
    formations varchar,
    experience_anterieur varchar,
    diplome_ou_apprentissage varchar,
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
