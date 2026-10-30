-- =========================================================
-- FANDRAISAN'ANJARA — IDEMPOTENCE V1
-- À exécuter manuellement uniquement après la migration 22.
-- =========================================================

begin;

do $$
begin
    if to_regclass('public.fandraisan_anjara_idempotence') is not null then
        raise exception
            'La table fandraisan_anjara_idempotence existe déjà : migration 23 interrompue';
    end if;
end;
$$;

create table fandraisan_anjara_idempotence (
    id_compte_createur uuid not null
        references compte_membre(id)
        on delete restrict,

    cle_idempotence uuid not null,
    empreinte_contenu varchar(64) not null,

    -- La contribution est générée côté serveur dans la même transaction.
    -- La FK différée autorise la réservation de clé avant l'insertion métier,
    -- puis impose l'existence de la contribution au COMMIT.
    id_fandraisan_anjara uuid not null
        references fandraisan_anjara(id)
        on delete restrict
        deferrable initially deferred,

    date_creation timestamptz not null default now(),

    constraint fandraisan_anjara_idempotence_pk
        primary key (id_compte_createur, cle_idempotence),

    constraint fandraisan_anjara_idempotence_empreinte_check
        check (empreinte_contenu ~ '^[0-9a-f]{64}$'),

    constraint fandraisan_anjara_idempotence_contribution_unique
        unique (id_fandraisan_anjara)
);

commit;
