-- Vue publique/interne pour les lectures administratives futures.
-- Le hash du code de suivi reste volontairement absent.
create or replace view v_demande_inscription as
select
    di.id,
    di.id_personne,
    di.email,
    di.telephone,
    di.reference,
    di.donnees,
    di.id_statut_demande,
    sdi.code as code_statut_demande,
    di.date_demande,
    di.date_traitement,
    di.id_compte_admin_traitement,
    di.commentaire_admin,
    di.id_role_attribue,
    ra.code as code_role_attribue
from demande_inscription di
join statut_demande_inscription sdi
    on sdi.id = di.id_statut_demande
left join role ra
    on ra.id = di.id_role_attribue;
