-- =========================================================
-- FANDRAISAN'ANJARA V1
-- Contributions indépendantes d'Alahadin'ny Taranaka.
-- Cette migration ne déplace ni ne modifie aucun don historique.
-- La validation de la date future et la résolution métier des rattachements
-- sont assurées par le futur service, dans sa transaction de création.
-- =========================================================

begin;

do $$
begin
    if to_regclass('public.fandraisan_anjara') is not null
        or to_regclass('public.fandraisan_anjara_ligne') is not null
        or to_regclass('public.fandraisan_anjara_historique') is not null then
        raise exception
            'Une table Fandraisan''anjara existe déjà : migration 22 interrompue pour éviter un schéma incohérent';
    end if;
end;
$$;

create table fandraisan_anjara (
    id uuid primary key default gen_random_uuid(),
    date_contribution date not null,

    type_contributeur varchar(20) not null,
    id_element_contributeur uuid null references element(id) on delete restrict,
    id_foyer_contributeur uuid null references foyer(id) on delete restrict,
    id_personne_contributeur uuid null references personne(id) on delete restrict,
    contributeur_libelle_snapshot varchar(300) not null,

    id_razambe_snapshot uuid null references element(id) on delete restrict,
    id_taranaka_snapshot uuid null references element(id) on delete restrict,
    id_sampana_snapshot uuid null references element(id) on delete restrict,
    resolution_razambe varchar(30) not null,

    observation text null,
    statut varchar(20) not null default 'ACTIF',
    revision integer not null default 1,

    id_compte_createur uuid not null references compte_membre(id) on delete restrict,
    id_compte_modificateur uuid null references compte_membre(id) on delete set null,
    id_compte_annulateur uuid null references compte_membre(id) on delete set null,
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    date_annulation timestamptz null,
    motif_annulation text null,

    constraint fandraisan_anjara_type_contributeur_check check (
        type_contributeur in ('RAZAMBE', 'TARANAKA', 'SAMPANA', 'FOYER', 'PERSONNE')
    ),
    constraint fandraisan_anjara_contributeur_libelle_snapshot_check check (
        btrim(contributeur_libelle_snapshot) <> ''
    ),
    constraint fandraisan_anjara_contributeur_check check (
        (
            type_contributeur in ('RAZAMBE', 'TARANAKA', 'SAMPANA')
            and id_element_contributeur is not null
            and id_foyer_contributeur is null
            and id_personne_contributeur is null
        ) or (
            type_contributeur = 'FOYER'
            and id_element_contributeur is null
            and id_foyer_contributeur is not null
            and id_personne_contributeur is null
        ) or (
            type_contributeur = 'PERSONNE'
            and id_element_contributeur is null
            and id_foyer_contributeur is null
            and id_personne_contributeur is not null
        )
    ),
    constraint fandraisan_anjara_resolution_razambe_check check (
        (
            resolution_razambe = 'RESOLU'
            and id_razambe_snapshot is not null
        ) or (
            resolution_razambe = 'NON_DETERMINE'
            and id_razambe_snapshot is null
            and id_taranaka_snapshot is null
            and id_sampana_snapshot is null
        )
    ),
    constraint fandraisan_anjara_snapshots_hierarchie_check check (
        (id_taranaka_snapshot is null or id_razambe_snapshot is not null)
        and (id_sampana_snapshot is null or id_taranaka_snapshot is not null)
    ),
    constraint fandraisan_anjara_statut_check check (statut in ('ACTIF', 'ANNULE')),
    constraint fandraisan_anjara_revision_check check (revision > 0),
    constraint fandraisan_anjara_annulation_check check (
        (
            statut = 'ACTIF'
            and date_annulation is null
            and id_compte_annulateur is null
            and motif_annulation is null
        ) or (
            statut = 'ANNULE'
            and date_annulation is not null
            and id_compte_annulateur is not null
            and motif_annulation is not null
            and btrim(motif_annulation) <> ''
        )
    )
);

create table fandraisan_anjara_ligne (
    id uuid primary key default gen_random_uuid(),
    id_fandraisan_anjara uuid not null
        references fandraisan_anjara(id) on delete restrict,
    nature varchar(20) not null,
    montant numeric(14, 0) null,
    devise varchar(10) null,
    designation varchar(200) null,
    quantite numeric(14, 3) null,
    unite varchar(50) null,
    observation text null,
    ordre integer not null,

    constraint fandraisan_anjara_ligne_nature_check check (nature in ('ARGENT', 'MATERIEL')),
    constraint fandraisan_anjara_ligne_montant_entier_check check (
        montant is null or montant = trunc(montant)
    ),
    constraint fandraisan_anjara_ligne_ordre_check check (ordre > 0),
    constraint fandraisan_anjara_ligne_ordre_unique unique (id_fandraisan_anjara, ordre),
    constraint fandraisan_anjara_ligne_contenu_check check (
        (
            nature = 'ARGENT'
            and montant is not null
            and montant > 0
            and devise = 'MGA'
            and designation is null
            and quantite is null
            and unite is null
        ) or (
            nature = 'MATERIEL'
            and montant is null
            and devise is null
            and designation is not null
            and btrim(designation) <> ''
            and quantite is not null
            and quantite > 0
            and unite is not null
            and btrim(unite) <> ''
        )
    )
);

create table fandraisan_anjara_historique (
    id uuid primary key default gen_random_uuid(),
    id_fandraisan_anjara uuid not null
        references fandraisan_anjara(id) on delete restrict,
    action varchar(20) not null,
    donnees_avant jsonb null,
    donnees_apres jsonb null,
    commentaire text null,
    id_compte_acteur uuid not null references compte_membre(id) on delete restrict,
    date_action timestamptz not null default now(),
    revision integer not null,

    constraint fandraisan_anjara_historique_action_check
        check (action in ('CREATION', 'CORRECTION', 'ANNULATION')),
    constraint fandraisan_anjara_historique_revision_check check (revision > 0),
    constraint fandraisan_anjara_historique_motif_check check (
        action = 'CREATION'
        or (commentaire is not null and btrim(commentaire) <> '')
    )
);

create index fandraisan_anjara_date_idx
    on fandraisan_anjara (date_contribution desc, id desc);
create index fandraisan_anjara_razambe_actif_date_idx
    on fandraisan_anjara (id_razambe_snapshot, date_contribution desc, id desc)
    where statut = 'ACTIF';
create index fandraisan_anjara_non_determine_actif_date_idx
    on fandraisan_anjara (date_contribution desc, id desc)
    where statut = 'ACTIF' and resolution_razambe = 'NON_DETERMINE';
create index fandraisan_anjara_element_contributeur_idx
    on fandraisan_anjara (id_element_contributeur)
    where id_element_contributeur is not null;
create index fandraisan_anjara_foyer_contributeur_idx
    on fandraisan_anjara (id_foyer_contributeur)
    where id_foyer_contributeur is not null;
create index fandraisan_anjara_personne_contributeur_idx
    on fandraisan_anjara (id_personne_contributeur)
    where id_personne_contributeur is not null;
create index fandraisan_anjara_ligne_contribution_idx
    on fandraisan_anjara_ligne (id_fandraisan_anjara, ordre);
create index fandraisan_anjara_historique_contribution_date_idx
    on fandraisan_anjara_historique (id_fandraisan_anjara, date_action desc, id desc);

commit;

-- Le futur service doit garantir, dans une transaction unique :
--   * au moins une ligne par contribution ;
--   * date_contribution <= current_date ;
--   * tout montant ARGENT reçu doit être un entier MGA avant insertion :
--     PostgreSQL peut arrondir une valeur décimale lors de sa conversion
--     vers numeric(14, 0), le futur service doit donc la rejeter avant SQL ;
--   * le code réel de l'élément contributeur et des instantanés ;
--   * la cohérence RAZAMBE -> TARANAKA -> SAMPANA via v_element_hierarchie ;
--   * le classement NON_DETERMINE des foyers ou personnes ambigus ;
--   * une révision incrémentée à chaque correction ou annulation.
