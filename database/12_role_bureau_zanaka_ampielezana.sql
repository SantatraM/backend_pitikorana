-- Rôle applicatif BUREAU_ZANAKA_AMPIELEZANA.
-- Migration manuelle : ne pas exécuter automatiquement.
insert into role (code)
values ('BUREAU_ZANAKA_AMPIELEZANA')
on conflict (code) do nothing;