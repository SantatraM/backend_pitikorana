-- Rôle applicatif PASTEUR.
-- Migration manuelle : ne pas exécuter automatiquement.
insert into role (code)
values ('PASTEUR')
on conflict (code) do nothing;
