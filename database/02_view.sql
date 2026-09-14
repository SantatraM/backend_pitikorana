-- récuperer les villes avec ses regions et pays
create or replace view v_ville as
select 
    v.id as id_ville,
    v.nom as nom_ville,
    r.id as id_region,
    r.nom as nom_region,
    p.id as id_pays,
    p.nom as nom_pays
from ville v
join region r on r.id = v.id_region
join pays p on p.id = r.id_pays;

-- =========================================================
-- VUE : HIÉRARCHIE DES ÉLÉMENTS
-- =========================================================

create or replace view v_element_hierarchie as
with recursive hierarchy as (

    select
        e.id as source_element_id,
        e.id,
        e.nom,
        e.rattachement_sup,
        te.libelle as type_element_libelle,
        array[e.id] as chemin

    from element e

    join type_element te
        on te.id = e.id_type_element

    union all

    select
        h.source_element_id,
        parent.id,
        parent.nom,
        parent.rattachement_sup,
        te.libelle,
        h.chemin || parent.id

    from hierarchy h

    join element parent
        on parent.id = h.rattachement_sup

    join type_element te
        on te.id = parent.id_type_element

    where not parent.id = any(h.chemin)
)

select
    source_element_id as id_element,

    max(id::text) filter (
        where upper(type_element_libelle) = 'RAZAMBE'
    )::uuid as id_razambe,

    max(nom) filter (
        where upper(type_element_libelle) = 'RAZAMBE'
    ) as nom_razambe,

    max(id::text) filter (
        where upper(type_element_libelle) = 'TARANAKA'
    )::uuid as id_taranaka,

    max(nom) filter (
        where upper(type_element_libelle) = 'TARANAKA'
    ) as nom_taranaka,

    max(id::text) filter (
        where upper(type_element_libelle) = 'SAMPANA'
    )::uuid as id_sampana,

    max(nom) filter (
        where upper(type_element_libelle) = 'SAMPANA'
    ) as nom_sampana

from hierarchy

group by source_element_id;

-- =========================================================
-- VUE : PERSONNE
-- Sans traductions pour l'instant
-- =========================================================

create or replace view v_personne as
select
    p.id,
    p.nom,
    p.prenom,
    p.nom_usage,
    p.autres_appellations,

    p.id_sexe,
    p.id_statut,

    p.date_naissance,
    p.annee_naissance,
    p.lieu_naissance,

    p.date_deces,
    p.annee_deces,

    p.adresse,

    -- Géographie
    p.id_ville,
    vv.nom_ville,
    vv.id_region,
    vv.nom_region,
    vv.id_pays,
    vv.nom_pays,

    -- Lien Falimanjaka
    p.id_lien,

    -- Élément directement rattaché à la personne
    p.id_element,
    e.nom as nom_element,
    e.id_type_element,
    te.libelle as type_element_libelle,

    -- Hiérarchie généalogique
    veh.id_razambe,
    veh.nom_razambe,

    veh.id_taranaka,
    veh.nom_taranaka,

    veh.id_sampana,
    veh.nom_sampana

from personne p

left join v_ville vv
    on vv.id_ville = p.id_ville

left join element e
    on e.id = p.id_element

left join type_element te
    on te.id = e.id_type_element

left join v_element_hierarchie veh
    on veh.id_element = p.id_element;

create or replace view v_personne_langue as
select
    vp.*,

    l.id as id_langue,
    l.code as code_langue,
    l.nom as nom_langue,

    st.libelle as sexe_libelle,
    statut_t.libelle as statut_libelle,
    lt.libelle as lien_libelle

from v_personne vp

cross join langue l

left join sexe_traduction st
    on st.id_sexe = vp.id_sexe
    and st.id_langue = l.id

left join statut_traduction statut_t
    on statut_t.id_statut = vp.id_statut
    and statut_t.id_langue = l.id

left join lien_avec_falimanjaka_traduction lt
    on lt.id_lien = vp.id_lien
    and lt.id_langue = l.id;