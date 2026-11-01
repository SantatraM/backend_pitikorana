# Rapport de correction — Demande d’information

## Statut : correction locale préparée, production BLOQUÉE

Toutes les migrations sont exclusivement exécutées manuellement par le propriétaire du projet sur Supabase. L’assistant n’exécute jamais une migration et ne se connecte pas à la base réelle. Aucun binding, réglage TLS partagé, rôle métier ou module Personnes/Contributions n’a été modifié dans cette correction.

## Corrections

1. Suppression de `pg_advisory_xact_lock`. La transaction tente un `INSERT ... ON CONFLICT (cle_idempotence) DO NOTHING RETURNING id`. La contrainte unique arbitre les tentatives concurrentes entre instances. Seul le gagnant consomme les quotas contact/compte. Un refus de quota ou un jeton expiré sans demande existante annule l’insertion et les compteurs de la transaction. Une reprise exacte d’une demande existante ne consomme pas à nouveau ces quotas.
2. La lecture du contenu existant est une instruction distincte après le conflit, sous READ COMMITTED. Un contenu différent est refusé avec 409 ; une ligne inattendue absente entraîne un refus 503. Aucun verrou advisory ou verrou de session n’est utilisé.
3. Migration 24 : ajout des index partiels sur les deux références compte, qualification `public` et résolution des fonctions intégrées avec `pg_catalog` en premier. RLS et retraits de droits publics conservés. Aucun fichier SQL n’est exécuté.
4. Cache : routage logiciel exclusif des requêtes du module vers un futur binding `HYPERDRIVE_INFORMATION`, appliqué avant connexion. Ce client est utilisé pour toute la requête, dont la session et les rôles. Aucun repli sur le binding partagé. En l’absence du binding, réponse 503 sans connexion. Les variantes de casse sont classées comme Express pour éviter un contournement ; le parseur JSON du module utilise le même classement.
5. Guide : TLS, droits SQL, proxies, horloges, conservation des données, rotation du secret et procédure d’application manuelle détaillés.

## Fichiers de cette correction

| Fichier backend | Action |
|---|---|
| `database/24_demande_information.sql` | Corrigé, non exécuté |
| `src/services/demandeInformation.service.js` | Idempotence sans advisory lock |
| `src/config/demandeInformationDatabase.js` | Créé : classement des chemins et choix isolé de connexion |
| `src/worker.js` | Routage logiciel du module, refus sans connexion dédiée |
| `src/app.js` | Détection de chemin partagée pour le parseur JSON limité |
| `tests/demande-information.test.js` | Adapté aux nouvelles requêtes et aux variantes de casse |
| `tests/demande-information-concurrency.test.js` | Créé : concurrence entrelacée et routage |
| `docs/demande-information.md` | Guide complété |
| `docs/rapport-correction-demande-information.md` | Présent rapport et copie du SQL |

Aucune source frontend n’a été modifiée. Les changements antérieurs présents dans les dépôts sont conservés.

## Infrastructure requise, NON EFFECTUÉE

Une nouvelle configuration Hyperdrive pour la même base, avec cache désactivé, est nécessaire. Elle doit être vérifiée par l’opérateur puis déclarée sous `HYPERDRIVE_INFORMATION` pour chaque environnement concerné. Le binding `HYPERDRIVE` existant ne doit pas être modifié. Les instructions et le fragment de déclaration proposé figurent dans le guide ; ils n’ont pas été appliqués.

Le code seul ne vérifie pas le réglage distant du cache. Un binding présent mais pointant vers une configuration mise en cache ne serait pas sûr. La création distante et la déclaration locale exigent un accord spécifique avant intervention. Le budget supplémentaire de connexions doit aussi être validé.

TLS Node reste un blocage de validation : le réglage partagé `rejectUnauthorized: false` n’a pas été modifié. Les droits SQL effectifs/hérités, la validation du certificat, le schéma, l’isolation et les protections du proxy restent à établir dans l’environnement retenu.

## Résultats des tests locaux

| Vérification | Résultat |
|---|---|
| Suite backend ciblée et non-régression | 75 réussis, 0 échec |
| Tests propres au module inclus dans cette suite | 27 réussis, dont 9 scénarios de concurrence/routage ajoutés |
| Navigateur sur vraies pages avec réponses API simulées | Réussi à 320, 390, 768, 1024 et 1440 px |
| TypeScript | Réussi |
| Build Vite | Réussi ; avertissement existant sur la taille des fichiers générés |
| ESLint ciblé frontend et backend | Réussi ; dépendances de vérification déjà présentes, aucune installation |
| Syntaxe Node des fichiers modifiés | Réussie |
| git diff --check et nouveaux fichiers | Aucune erreur d’espacement détectée |

Le moteur Edge s’est arrêté lors d’une première série après les deux petites largeurs ; les trois largeurs restantes ont été rejouées avec succès. Ce n’était pas un échec de scénario applicatif. Aucune source frontend n’a été changée pendant ces vérifications.

Le diff de `src/config/db.js` et `wrangler.jsonc` est vide : la configuration TLS partagée et les déclarations de bindings n’ont pas été modifiées. Les sources des modules Personnes et Contributions n’ont pas été modifiées par cette correction.

## Limites des vérifications locales

Les tests de concurrence sont des simulations déterministes à transactions entrelacées : elles modélisent les attentes de l’index unique et des lignes de quota, les validations et les rollbacks sans exécuter de SQL. Le parcours HTTP utilise Express local et une base simulée. Les navigateurs utilisent des réponses API simulées. Ces tests ne valident pas une base PostgreSQL réelle, le paramétrage Hyperdrive distant, RLS effectif ou TLS en production.

Le module reste non prêt pour la production tant que les blocages ne sont pas levés et que le propriétaire n’a pas appliqué puis validé manuellement la migration. Aucun test local ne vaut autorisation d’activer le module.

## Script SQL complet à appliquer MANUELLEMENT uniquement

Le fichier `database/24_demande_information.sql` reste la référence. Empreinte SHA-256 de la version reproduite :

`29cf694f63f67b73add80faad892d22fdc7049156000f6c3f056f15f25547783`

Ne pas réexécuter le fichier si l’une des tables existe déjà. Vérifier le schéma, les prérequis, les rôles SQL et la sauvegarde avant exécution manuelle du fichier complet. En cas d’erreur, confirmer le rollback et arrêter ; ne pas ajouter de DROP CASCADE. Les instructions avant/après sont dans le guide.

```sql
-- PREPARED ONLY. Apply manually after explicit authorization, after migration 23.
-- No existing role, Personne or Contribution table is altered.
begin;
-- Pin name resolution for the manual migration and its foreign keys.
set local search_path = pg_catalog, public;

create table public.demande_information (
    id uuid primary key default gen_random_uuid(),
    nom varchar(100) not null check (char_length(btrim(nom)) between 1 and 100),
    prenom varchar(100) not null check (char_length(btrim(prenom)) between 1 and 100),
    contact varchar(255) not null check (char_length(btrim(contact)) between 3 and 255),
    message text not null check (char_length(btrim(message)) between 10 and 5000),
    origine varchar(8) not null check (origine in ('VISITEUR', 'MEMBRE')),
    id_compte_membre uuid references public.compte_membre(id) on delete set null,
    statut varchar(10) not null default 'NOUVELLE' check (statut in ('NOUVELLE', 'EN_COURS', 'TRAITEE')),
    date_creation timestamptz not null default now(),
    date_modification timestamptz not null default now(),
    revision integer not null default 1 check (revision > 0),
    id_compte_modificateur uuid references public.compte_membre(id) on delete set null,
    cle_idempotence uuid not null unique,
    empreinte_contenu char(64) not null check (empreinte_contenu ~ '^[0-9a-f]{64}$'),
    check (origine <> 'VISITEUR' or id_compte_membre is null)
);
create index demande_information_date_idx on public.demande_information (date_creation desc, id desc);
create index demande_information_statut_date_idx on public.demande_information (statut, date_creation desc, id desc);

-- Indexes on nullable referencing columns avoid full scans when a member
-- account is deleted and the references are set to NULL.
create index demande_information_compte_membre_idx on public.demande_information (id_compte_membre)
    where id_compte_membre is not null;
create index demande_information_compte_modificateur_idx on public.demande_information (id_compte_modificateur)
    where id_compte_modificateur is not null;

-- One row per pseudonymized subject, action and fixed time window.
create table public.demande_information_quota (
    cle char(64) not null,
    fenetre timestamptz not null,
    nombre integer not null check (nombre > 0),
    expiration timestamptz not null,
    primary key (cle, fenetre)
);
create index demande_information_quota_expiration_idx on public.demande_information_quota (expiration);

-- No direct public/PostgREST access, including for a logged-in client.
alter table public.demande_information enable row level security;
alter table public.demande_information_quota enable row level security;
revoke all on public.demande_information, public.demande_information_quota from public, anon, authenticated;
-- The trusted backend SQL connection must use a table-owning/BYPASSRLS role.
-- No permissive policies or client-side grants are created here.
commit;
```
