# Demande d’information — validation LOCALE Windows

## Situation actuelle : migration manuelle en attente

Vous avez confirmé que la migration 24 n’est PAS encore appliquée. L’existence réelle des tables n’a pas été interrogée. Aucun test utilisant ces nouvelles tables ne doit être lancé avant votre confirmation de migration et votre autorisation des essais réels.

Le backend tourne avec Node/Express et le frontend avec React/Vite. Les travaux d’hébergement sont hors de cette phase ; aucun binding ou réglage DirectAdmin/Cloudflare/Hyperdrive n’est nécessaire à ce démarrage local ni modifié ici.

Toutes les migrations sont exclusivement effectuées MANUELLEMENT par vous sur Supabase. L’assistant ne les exécute jamais. Aucun démarrage, test, build ou script local ne doit appliquer le SQL ni créer des tables réelles.

## Configuration locale préparée

Backend : `E:\FJKM FALIMANJAKA\backend_pitikorana\.env`

```dotenv
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
AUTH_COOKIE_SECURE=false
# DEMANDE_INFORMATION_SECRET : valeur privée générée localement, non reproduite ici.
# DATABASE_URL et clés Supabase : valeurs existantes conservées, non reproduites ici.
```

Le secret du module était absent : une valeur aléatoire privée de 64 caractères hexadécimaux a été ajoutée dans le fichier local ignoré par Git. Il ne doit jamais être copié dans le frontend, un rapport, un message ou un commit. Ne pas le changer entre deux reprises d’un même envoi.

Le fichier `.env.example` contient maintenant des valeurs adaptées au développement HTTP local et un champ secret vide à renseigner pour une nouvelle installation. Il ne contient aucune clé réelle.

Frontend : `E:\FJKM FALIMANJAKA\frontend_pitikorana\.env` contient déjà `VITE_API_URL=http://localhost:3000` ; cette valeur n’a pas été modifiée. Utiliser `http://localhost:5173` pour le frontend et `http://localhost:3000` pour le backend, sans mélanger localhost et 127.0.0.1 dans le navigateur. Les ports différents restent compatibles avec les cookies locaux du même hôte.

Redémarrer les processus après une modification de `.env`. Ne pas conserver un ancien backend démarré avant l’ajout du secret.

## Vérifications possibles SANS migration

Les tests backend et navigateur fournis utilisent des bases et identités fictives. Ils ne doivent pas être présentés comme une validation de PostgreSQL réel ou des comptes existants.

- `tests/demande-information.test.js` : validation, quotas, rôles, HTTP local, schéma simulé.
- `tests/demande-information-concurrency.test.js` : idempotence, conflits et rollbacks entrelacés sur deux instances simulées.
- `tests/demande-information-local-http.test.js` : serveur Express réellement écoutant sur localhost, appels HTTP réels, CORS, cookies et middlewares d’authentification/rôle existants ; fournisseur d’identité et PostgreSQL entièrement simulés. Le test bloque explicitement les connexions pg et les requêtes HTTP distantes imprévues.
- `tests/run-information-browser.mjs` dans le frontend : vraies pages et routes aux cinq largeurs, réponses API simulées. Aucun compte réel ni table réelle utilisé.

Ces tests n’importent pas `src/server.js` et ne chargent pas le `.env` réel du backend. Le test HTTP vérifie aussi le chargement du module natif sharp présent sur Windows, sans traiter de photo réelle.

Commandes locales, sans installation :

```powershell
# Dans le dossier backend
node --test tests/demande-information.test.js tests/demande-information-concurrency.test.js tests/demande-information-local-http.test.js
# Dans le dossier frontend
node tests/run-information-browser.mjs
```

## Procédure SQL manuelle — uniquement par vous

1. Ouvrir et relire `E:\FJKM FALIMANJAKA\backend_pitikorana\database\24_demande_information.sql`.
2. Dans votre environnement Supabase choisi, vérifier vous-même que la migration n’a pas déjà été appliquée, que `public.compte_membre.id` existe en UUID et que vous avez une sauvegarde adaptée. Ne pas utiliser des données métier pour les essais.
3. Appliquer vous-même le fichier complet, du BEGIN au COMMIT. Il prépare les deux tables, contraintes, index et protections RLS ; il n’altère aucune table Personnes/Contributions. En cas d’erreur, arrêter et confirmer le rollback. Ne pas ajouter de DROP ou de suppression pour forcer le passage.
4. Vérifier vous-même les tables `public.demande_information` et `public.demande_information_quota`, les cinq index explicites, les clés/unicités et le refus des accès directs publics.
5. Confirmer dans le chat que la migration a été appliquée à la base utilisée par le backend local. Préciser si cette base est dédiée aux tests ou contient des données habituelles.
6. Autoriser séparément les essais réels : lecture du schéma et création de demandes entièrement fictives identifiées `[TEST LOCAL]`, sans modification ni suppression de demandes métier existantes. Ne communiquer aucun mot de passe ; les connexions aux comptes se font normalement dans votre navigateur.

L’assistant ne peut pas lancer ces essais avant ces confirmations. Il ne supprime pas automatiquement les demandes de test créées ; leur éventuel nettoyage restera une action manuelle par vous ou une opération distincte explicitement autorisée.

## Démarrage après confirmation et autorisation des essais

Dans deux terminaux, utiliser les dépendances déjà présentes :

```powershell
# Terminal backend
Set-Location 'E:\FJKM FALIMANJAKA\backend_pitikorana'
npm start
# Terminal frontend
Set-Location 'E:\FJKM FALIMANJAKA\frontend_pitikorana'
npm run dev
```

Si Vite indique un autre port que 5173, libérer le port prévu ou utiliser explicitement l’origine indiquée ; ne pas supposer que le frontend est sur 5173. Les origines loopback de développement sont autorisées par le code, mais l’hôte utilisé pour l’API et les cookies doit rester cohérent.

Attention : le formulaire demande automatiquement un jeton à son ouverture, et cette API consomme un compteur anti-abus dans la base. L’ouvrir sur le vrai backend fait donc déjà partie des essais nécessitant les tables. Les pages connectées peuvent aussi charger le profil du compte. Avant migration, utiliser seulement les tests simulés.

## Parcours réels restant à valider

1. Visiteur sans session : formulaire FR/MG, champs obligatoires, contact, message et confirmation ; demande fictive identifiée.
2. Membre : connexion normale, préremplissage modifiable sans écrasement, envoi fictif associé au compte serveur.
3. ADMIN puis PASTEUR : réception, recherche par nom/prénom/contact, filtres, pagination, lecture complète et changement des trois statuts.
4. VISITEUR, MEMBRE et BUREAU : refus réels des API de liste, détail, compteur et modification de statut ; pas seulement masquage du menu.
5. Double clic et reprise d’un envoi : une seule demande ; même clé et même contenu après une confirmation perdue. Si la reprise reçoit un refus temporaire 429, conserver les valeurs verrouillées et la même clé. Si la session expire après une réponse perdue, rétablir la session dans un autre onglet avant de reprendre : ne pas basculer cet envoi incertain vers une autre identité.
6. Contrôler cookies locaux HttpOnly/SameSite=Lax/non-Secure et réponses CORS depuis le vrai frontend. Aucune règle d’authentification n’a été modifiée.
7. Vérifier réellement la connexion PostgreSQL et les droits SQL, sur la base déclarée par vous, après autorisation. La présence de DATABASE_URL ne prouve pas que la connexion fonctionne.

## Erreurs avant activation et limites

Une erreur PostgreSQL 42P01 interceptée dans ce module produit désormais `INFORMATION_SCHEMA_REQUIRED` avec un message FR/MG d’indisponibilité avant activation, sans nom de table ni détail SQL exposé au public. Cela ne crée pas les tables et ne constitue pas un test du schéma réel.

La configuration PostgreSQL et les clés d’authentification locales sont présentes, mais aucune connexion distante n’a été effectuée pendant cette préparation. Les sessions Supabase réelles, les droits des comptes réels et l’enregistrement dans les tables réelles restent NON VALIDÉS.

## Résultats de la préparation locale

- Suite backend et régressions : 86 tests réussis, aucune connexion réelle à PostgreSQL/Supabase.
- Build Vite : réussi.
- TypeScript : réussi.
- ESLint backend ciblé et git diff --check : réussis.
- Navigateur Edge : parcours réussis aux largeurs 320, 390, 768, 1024 et 1440 px, sans débordement horizontal détecté. Formulaire FR/MG, préremplissage, permissions, recherche, filtres, pagination, détail, statuts et reprises après réseau/429/401 vérifiés avec réponses API simulées. Une interruption du processus Edge à 320 px a nécessité la relance prévue par le lanceur.
- ESLint frontend ciblé : réussi.
- Aucune migration exécutée, aucun compte réel connecté, aucune donnée réelle créée ou modifiée.
