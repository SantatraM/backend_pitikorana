# Recette PostgreSQL Fandraisan'anjara

Le test `fandraisan-anjara.postgres.test.js` est désactivé par défaut et ne
doit viser qu'une instance PostgreSQL locale, isolée et sans donnée réelle.

## Prérequis

1. Créer une base locale dédiée dont le nom se termine par `_test`, par exemple
   `pitikorana_fandraisan_anjara_test`.
2. Initialiser cette base avec les migrations applicatives nécessaires, dont 22
   et 23, sans utiliser la base Supabase de l'application.
3. Créer deux comptes **fictifs** dans cette base : un `ADMIN` et un `MEMBRE`.
   Les UUID de leurs lignes `compte_membre` seront fournis au test.
4. Ne jamais définir `FANDRAISAN_ANJARA_TEST_DATABASE_URL` avec une URL
   Supabase ou de production : le test refuse toute machine non locale.

## Activation explicite PowerShell

```powershell
$env:FANDRAISAN_ANJARA_INTEGRATION = '1'
$env:FANDRAISAN_ANJARA_TEST_CONFIRM = 'ISOLATED_TEST_DATABASE'
$env:FANDRAISAN_ANJARA_TEST_DATABASE_URL = 'postgresql://utilisateur:mot-de-passe@127.0.0.1:5432/pitikorana_fandraisan_anjara_test'
$env:FANDRAISAN_ANJARA_TEST_DATABASE_NAME = 'pitikorana_fandraisan_anjara_test'
$env:FANDRAISAN_ANJARA_TEST_ADMIN_ACCOUNT_ID = 'uuid-du-compte-admin-fictif'
$env:FANDRAISAN_ANJARA_TEST_MEMBER_ACCOUNT_ID = 'uuid-du-compte-membre-fictif'
node --test tests/integration/fandraisan-anjara.postgres.test.js
```

Le test vérifie le nom réel de la base après connexion, exige le suffixe
`_test`, interdit `DATABASE_URL` et rejette les hôtes non locaux. Les fixtures
familiales et les contributions portent un identifiant de session aléatoire et
sont supprimées à la fin du test, dans l'ordre des clés étrangères.
