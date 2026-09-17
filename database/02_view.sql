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

    p.id_ville,
    vv.nom_ville,
    vv.id_region,
    vv.nom_region,
    vv.id_pays,
    vv.nom_pays,

    p.id_lien,

    p.id_element,
    e.nom as nom_element,
    e.id_type_element,
    te.libelle as type_element_libelle,

    veh.id_razambe,
    veh.nom_razambe,
    veh.id_taranaka,
    veh.nom_taranaka,
    veh.id_sampana,
    veh.nom_sampana,

    cp.id as id_contact,
    cp.telephone,
    cp.whatsapp,
    cp.email,
    cp.facebook,
    cp.lien_facebook,

    pp.id as id_photo,
    pp.chemin_photo

from personne p

left join v_ville vv
    on vv.id_ville = p.id_ville

left join element e
    on e.id = p.id_element

left join type_element te
    on te.id = e.id_type_element

left join v_element_hierarchie veh
    on veh.id_element = p.id_element

left join contacts_personne cp
    on cp.id_personne = p.id

left join photos_personne pp
    on pp.id_personne = p.id;

create or replace view v_personne_langue as
select
    vp.id,
    vp.nom,
    vp.prenom,
    vp.nom_usage,
    vp.autres_appellations,

    vp.id_sexe,
    vp.id_statut,

    vp.date_naissance,
    vp.annee_naissance,
    vp.lieu_naissance,

    vp.date_deces,
    vp.annee_deces,

    vp.adresse,

    vp.id_ville,
    vp.nom_ville,
    vp.id_region,
    vp.nom_region,
    vp.id_pays,
    vp.nom_pays,

    vp.id_lien,

    vp.id_element,
    vp.nom_element,
    vp.id_type_element,
    vp.type_element_libelle,

    vp.id_razambe,
    vp.nom_razambe,
    vp.id_taranaka,
    vp.nom_taranaka,
    vp.id_sampana,
    vp.nom_sampana,

    vp.id_contact,
    vp.telephone,
    vp.whatsapp,
    vp.email,
    vp.facebook,
    vp.lien_facebook,

    l.id as id_langue,
    l.code as code_langue,
    l.nom as nom_langue,

    st.libelle as sexe_libelle,
    statut_t.libelle as statut_libelle,
    lt.libelle as lien_libelle,

    vp.id_photo,
    vp.chemin_photo

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

-- =========================================================
-- VUE : ACTIVITÉS D'UNE PERSONNE PAR LANGUE
-- =========================================================

create or replace view v_personne_activite as
select
    pa.id,
    pa.id_personne,
    pa.id_activite,
    a.id_domaine_activite,

    at.id_langue,
    l.code as code_langue,
    at.libelle as activite,

    dat.libelle as domaine_activite,

    pa.lieu_travail,
    pa.etude_en_cours,
    pa.formations,
    pa.experience_anterieur,
    pa.diplome_ou_apprentissage

from personne_activite pa

join activite a
    on a.id = pa.id_activite

join activite_traduction at
    on at.id_activite = a.id

join langue l
    on l.id = at.id_langue

left join domaine_activite da
    on da.id = a.id_domaine_activite

left join domaine_activite_traduction dat
    on dat.id_domaine_activite = da.id
    and dat.id_langue = at.id_langue;

-- =========================================================
-- VUE : COMPÉTENCES D'UNE PERSONNE PAR LANGUE
-- =========================================================

create or replace view v_competence_personne as
select
    pc.id,
    pc.id_personne,
    pc.id_competence,

    ct.id_langue,
    l.code as code_langue,
    ct.libelle as competence,

    pc.partageable

from personne_competence pc

join competence c
    on c.id = pc.id_competence

join competence_traduction ct
    on ct.id_competence = c.id

join langue l
    on l.id = ct.id_langue;

-- =========================================================
-- VUE : CENTRES D'INTÉRÊT D'UNE PERSONNE PAR LANGUE
-- =========================================================

create or replace view v_centre_interet_personne as
select
    pci.id,
    pci.id_personne,
    pci.id_centre_interet,
    cit.id_langue,
    l.code as code_langue,
    cit.libelle as centre_interet
from personne_centre_interet pci
join centre_interet ci on ci.id = pci.id_centre_interet
join centre_interet_traduction cit
    on cit.id_centre_interet = ci.id
join langue l on l.id = cit.id_langue;
