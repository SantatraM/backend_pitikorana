-- =========================================================
-- MODULE SOSO-KEVITRA — V1
-- Migration à exécuter après les schémas 01 à 04.
-- =========================================================

-- =========================================================
-- STATUT SOSO-KEVITRA
-- =========================================================

create table if not exists statut_soso_kevitra (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique,
    ordre integer not null unique,
    constraint statut_soso_kevitra_ordre_check check (ordre > 0)
);

insert into statut_soso_kevitra (code, ordre)
values
    ('BROUILLON', 1),
    ('EN_ATTENTE_VERIFICATION', 2),
    ('A_CORRIGER', 3),
    ('NON_PUBLIE', 4),
    ('EN_CONSULTATION', 5),
    ('A_L_ETUDE', 6),
    ('ACCEPTE', 7),
    ('REFUSE', 8)
on conflict (code) do nothing;

create table if not exists statut_soso_kevitra_traduction (
    id uuid primary key default gen_random_uuid(),
    id_statut_soso_kevitra uuid not null
        references statut_soso_kevitra(id)
        on delete cascade,
    id_langue uuid not null
        references langue(id)
        on delete cascade,
    libelle varchar(100) not null,
    unique (id_statut_soso_kevitra, id_langue)
);

insert into statut_soso_kevitra_traduction (
    id_statut_soso_kevitra,
    id_langue,
    libelle
)
select
    statut.id,
    langue.id,
    traduction.libelle
from (
    values
        ('BROUILLON', 'FR', 'Brouillon'),
        ('BROUILLON', 'MG', 'Drafitra'),
        ('EN_ATTENTE_VERIFICATION', 'FR', 'En attente de vérification'),
        ('EN_ATTENTE_VERIFICATION', 'MG', 'Miandry fanamarinana'),
        ('A_CORRIGER', 'FR', 'À corriger'),
        ('A_CORRIGER', 'MG', 'Mila ahitsy'),
        ('NON_PUBLIE', 'FR', 'Non publié'),
        ('NON_PUBLIE', 'MG', 'Tsy navoaka'),
        ('EN_CONSULTATION', 'FR', 'Consultation en cours'),
        ('EN_CONSULTATION', 'MG', 'Angatahana fanohanana sy hevitra'),
        ('A_L_ETUDE', 'FR', 'À l''étude'),
        ('A_L_ETUDE', 'MG', 'Dinihina'),
        ('ACCEPTE', 'FR', 'Accepté'),
        ('ACCEPTE', 'MG', 'Ekena'),
        ('REFUSE', 'FR', 'Refusé'),
        ('REFUSE', 'MG', 'Tsy ekena')
) as traduction(code_statut, code_langue, libelle)
join statut_soso_kevitra statut
    on statut.code = traduction.code_statut
join langue
    on upper(langue.code) = traduction.code_langue
on conflict (id_statut_soso_kevitra, id_langue) do nothing;

-- =========================================================
-- CATEGORIES DE CONTRIBUTION
-- =========================================================

create table if not exists soso_kevitra_categorie_contribution (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique,
    ordre integer not null unique,
    actif boolean not null default true,
    constraint soso_kevitra_categorie_contribution_ordre_check check (ordre > 0)
);

insert into soso_kevitra_categorie_contribution (code, ordre)
values
    ('COMPLEMENT_IDEE', 1),
    ('BUDGET_PRIX', 2),
    ('RESSOURCE', 3),
    ('MODE_REALISATION', 4),
    ('LIEU_PERIODE', 5),
    ('PARTENAIRE_CONTACT', 6),
    ('RISQUE_PROBLEME', 7),
    ('AUTRE', 8)
on conflict (code) do nothing;

create table if not exists soso_kevitra_categorie_contribution_traduction (
    id uuid primary key default gen_random_uuid(),
    id_categorie uuid not null
        references soso_kevitra_categorie_contribution(id)
        on delete cascade,
    id_langue uuid not null
        references langue(id)
        on delete cascade,
    libelle varchar(150) not null,
    unique (id_categorie, id_langue)
);

insert into soso_kevitra_categorie_contribution_traduction (
    id_categorie,
    id_langue,
    libelle
)
select
    categorie.id,
    langue.id,
    traduction.libelle
from (
    values
        ('COMPLEMENT_IDEE', 'FR', 'Complément de l''idée'),
        ('BUDGET_PRIX', 'FR', 'Budget / Prix'),
        ('RESSOURCE', 'FR', 'Ressource'),
        ('MODE_REALISATION', 'FR', 'Amélioration de la réalisation'),
        ('LIEU_PERIODE', 'FR', 'Lieu / Période'),
        ('PARTENAIRE_CONTACT', 'FR', 'Partenaire / Contact'),
        ('RISQUE_PROBLEME', 'FR', 'Risque / Problème'),
        ('AUTRE', 'FR', 'Autre'),
        ('COMPLEMENT_IDEE', 'MG', 'Fanatevenana ny hevitra'),
        ('BUDGET_PRIX', 'MG', 'Soso-kevitra amin''ny teti-bola / Vidiny'),
        ('RESSOURCE', 'MG', 'Fanolorana loharano'),
        ('MODE_REALISATION', 'MG', 'Fanatsarana fomba fanatanterahana'),
        ('LIEU_PERIODE', 'MG', 'Fanolorana Toerana / Fotoana'),
        ('PARTENAIRE_CONTACT', 'MG', 'Fanolorana Mpiara-miombon''antoka / Fifandraisana'),
        ('RISQUE_PROBLEME', 'MG', 'Olana mety hitranga'),
        ('AUTRE', 'MG', 'Hafa')
) as traduction(code_categorie, code_langue, libelle)
join soso_kevitra_categorie_contribution categorie
    on categorie.code = traduction.code_categorie
join langue
    on upper(langue.code) = traduction.code_langue
on conflict (id_categorie, id_langue) do nothing;

-- =========================================================
-- SOSO-KEVITRA ET CONTENU DU BROUILLON
-- =========================================================

create table if not exists soso_kevitra (
    id uuid primary key default gen_random_uuid(),
    id_auteur uuid not null
        references personne(id)
        on delete restrict,
    titre varchar(200),
    description text,
    raison text,
    objectif text,
    beneficiaires text,
    lieu text,
    lieu_non_defini boolean not null default false,
    details_realisation text,
    ressources_necessaires text,
    budget_non_defini boolean not null default false,
    devise varchar(3) not null default 'MGA',
    periode_souhaitee text,
    id_statut_soso_kevitra uuid not null
        references statut_soso_kevitra(id)
        on delete restrict,
    date_publication timestamptz,
    date_fin_consultation timestamptz,
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now()
);

create table if not exists soso_kevitra_action (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    description text not null,
    ordre integer not null,
    constraint soso_kevitra_action_ordre_check check (ordre > 0),
    unique (id_soso_kevitra, ordre)
);

create table if not exists soso_kevitra_ligne_budget (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    designation text not null,
    quantite numeric(12,3) not null,
    prix_unitaire_estime numeric(18,2) not null,
    ordre integer not null,
    constraint soso_kevitra_ligne_budget_quantite_check check (quantite > 0),
    constraint soso_kevitra_ligne_budget_prix_check check (prix_unitaire_estime >= 0),
    constraint soso_kevitra_ligne_budget_ordre_check check (ordre > 0),
    unique (id_soso_kevitra, ordre)
);

create table if not exists soso_kevitra_photo (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    chemin_photo text not null unique,
    ordre integer not null,
    date_creation timestamptz not null default now(),
    constraint soso_kevitra_photo_ordre_check check (ordre > 0),
    unique (id_soso_kevitra, ordre)
);

create table if not exists soso_kevitra_soutien (
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    id_personne uuid not null
        references personne(id)
        on delete restrict,
    date_soutien timestamptz not null default now(),
    primary key (id_soso_kevitra, id_personne)
);

-- =========================================================
-- CONTRIBUTIONS ET MODERATION
-- =========================================================

create table if not exists soso_kevitra_contribution (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    id_auteur uuid not null
        references personne(id)
        on delete restrict,
    id_categorie uuid not null
        references soso_kevitra_categorie_contribution(id)
        on delete restrict,
    titre varchar(200) not null,
    description text not null,
    etat varchar(20) not null default 'VISIBLE',
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    date_retrait timestamptz,
    constraint soso_kevitra_contribution_etat_check
        check (etat in ('VISIBLE', 'RETIRE', 'MASQUE'))
);

create table if not exists soso_kevitra_contribution_photo (
    id uuid primary key default gen_random_uuid(),
    id_contribution uuid not null
        references soso_kevitra_contribution(id)
        on delete cascade,
    chemin_photo text not null unique,
    ordre integer not null,
    date_creation timestamptz not null default now(),
    constraint soso_kevitra_contribution_photo_ordre_check check (ordre > 0),
    unique (id_contribution, ordre)
);

create table if not exists soso_kevitra_moderation_contribution (
    id uuid primary key default gen_random_uuid(),
    id_contribution uuid not null
        references soso_kevitra_contribution(id)
        on delete cascade,
    action varchar(20) not null,
    raison text not null,
    id_admin uuid not null
        references personne(id)
        on delete restrict,
    date_action timestamptz not null default now(),
    constraint soso_kevitra_moderation_contribution_action_check
        check (action in ('MASQUER', 'RESTAURER'))
);

-- =========================================================
-- VERIFICATION, PROLONGATION ET DECISION
-- =========================================================

create table if not exists soso_kevitra_verification (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    action varchar(40) not null,
    commentaire text,
    id_personne_action uuid not null
        references personne(id)
        on delete restrict,
    date_action timestamptz not null default now(),
    constraint soso_kevitra_verification_action_check
        check (action in (
            'SOUMIS',
            'DEMANDE_CORRECTION',
            'RESOUMIS',
            'PUBLIE',
            'NON_PUBLIE'
        )),
    constraint soso_kevitra_verification_commentaire_check
        check (
            action not in ('DEMANDE_CORRECTION', 'NON_PUBLIE')
            or nullif(btrim(commentaire), '') is not null
        )
);

create table if not exists soso_kevitra_prolongation (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null
        references soso_kevitra(id)
        on delete cascade,
    ancienne_date_fin timestamptz not null,
    nouvelle_date_fin timestamptz not null,
    raison text not null,
    id_admin uuid not null
        references personne(id)
        on delete restrict,
    date_prolongation timestamptz not null default now(),
    constraint soso_kevitra_prolongation_date_check
        check (nouvelle_date_fin > ancienne_date_fin)
);

create table if not exists soso_kevitra_decision (
    id uuid primary key default gen_random_uuid(),
    id_soso_kevitra uuid not null unique
        references soso_kevitra(id)
        on delete cascade,
    decision varchar(20) not null,
    observation text,
    id_admin uuid not null
        references personne(id)
        on delete restrict,
    date_decision timestamptz not null default now(),
    constraint soso_kevitra_decision_check
        check (decision in ('ACCEPTE', 'REFUSE'))
);

-- =========================================================
-- INDEX DE CONSULTATION
-- Les index couverts par une PK ou un UNIQUE de préfixe identique sont omis.
-- =========================================================

create index if not exists idx_soso_kevitra_id_auteur
    on soso_kevitra(id_auteur);

create index if not exists idx_soso_kevitra_id_statut
    on soso_kevitra(id_statut_soso_kevitra);

create index if not exists idx_soso_kevitra_date_creation
    on soso_kevitra(date_creation);

create index if not exists idx_soso_kevitra_date_fin_consultation
    on soso_kevitra(date_fin_consultation);

create index if not exists idx_soso_kevitra_contribution_id_soso_kevitra
    on soso_kevitra_contribution(id_soso_kevitra);

create index if not exists idx_soso_kevitra_contribution_id_auteur
    on soso_kevitra_contribution(id_auteur);

create index if not exists idx_soso_kevitra_contribution_id_categorie
    on soso_kevitra_contribution(id_categorie);

create index if not exists idx_soso_kevitra_verification_id_soso_kevitra
    on soso_kevitra_verification(id_soso_kevitra);

create index if not exists idx_soso_kevitra_prolongation_id_soso_kevitra
    on soso_kevitra_prolongation(id_soso_kevitra);
