-- Statut d'ouverture manuelle aux membres, après les migrations 19 et 20.
-- Avant exécution : vérifier les statuts, contraintes, triggers et l'ordre 5
-- sur la base cible ; confirmer la stratégie de déploiement avec l'application.
-- Après exécution : vérifier le couple MISOKATRA/5 et les nombres par statut ;
-- aucun projet existant ne doit avoir changé de statut.
begin;

lock table statut_tetikasa in share row exclusive mode;

do $$
begin
    if exists (select 1 from statut_tetikasa where code = 'MISOKATRA' and ordre <> 5) then
        raise exception 'Le statut MISOKATRA existe avec un ordre différent de 5';
    end if;

    if exists (select 1 from statut_tetikasa where ordre = 5 and code <> 'MISOKATRA') then
        raise exception 'L''ordre 5 est déjà attribué à un autre statut que MISOKATRA';
    end if;

    if not exists (select 1 from statut_tetikasa where code = 'MISOKATRA' and ordre = 5) then
        insert into statut_tetikasa (code, ordre) values ('MISOKATRA', 5);
    end if;
end;
$$;

commit;
