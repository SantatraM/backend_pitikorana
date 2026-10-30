-- Statuts du futur workflow de validation Tetikasa.
-- À exécuter manuellement après la migration 19.
begin;

-- Sérialise les écritures sur les statuts pendant les contrôles et insertions.
lock table statut_tetikasa in share row exclusive mode;

do $$
declare
    statut_code varchar(50);
    statut_ordre integer;
begin
    for statut_code, statut_ordre in
        select attendu.code, attendu.ordre
        from (values
            ('EN_ATTENTE_VALIDATION', 2),
            ('VALIDE', 3),
            ('REFUSE', 4)
        ) as attendu(code, ordre)
    loop
        if exists (
            select 1 from statut_tetikasa
            where code = statut_code and ordre <> statut_ordre
        ) then
            raise exception 'Le statut % existe avec un ordre différent de %', statut_code, statut_ordre;
        end if;

        if exists (
            select 1 from statut_tetikasa
            where ordre = statut_ordre and code <> statut_code
        ) then
            raise exception 'L''ordre % est déjà attribué à un autre statut que %', statut_ordre, statut_code;
        end if;

        if not exists (
            select 1 from statut_tetikasa
            where code = statut_code and ordre = statut_ordre
        ) then
            insert into statut_tetikasa (code, ordre)
            values (statut_code, statut_ordre);
        end if;
    end loop;
end;
$$;

commit;
