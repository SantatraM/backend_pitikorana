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