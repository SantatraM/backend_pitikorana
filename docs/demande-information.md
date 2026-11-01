# Demande d’information — activation et exploitation

## Règle permanente du projet

Toutes les migrations sont exécutées MANUELLEMENT par le propriétaire du projet sur Supabase. L’assistant peut préparer et corriger les fichiers SQL, mais ne doit jamais appliquer une migration, se connecter à la base réelle ou modifier ses données. Aucun démarrage, test, build ou déploiement de l’application n’exécute la migration 24.

## État : PAS PRÊT POUR LA PRODUCTION

La migration 24 n’a pas été exécutée et reste à valider manuellement. Le verrou advisory incompatible avec Hyperdrive a été supprimé du module. La création utilise une réservation par contrainte unique et une transaction pour les quotas. Les tests sont locaux, avec base et services distants simulés ; ils ne prouvent ni l’exécution SQL réelle ni le comportement du service Hyperdrive distant.

Le routage logiciel du Worker est préparé : toutes les URL `/api/demandes-information` (avec frontière de chemin) utilisent exclusivement `HYPERDRIVE_INFORMATION`. Le client PostgreSQL sélectionné est transmis à toute la requête Express, y compris les contrôles de session, de rôle et de statut du compte. Cela empêche de corriger les lectures de demandes tout en laissant la lecture des autorisations sur le cache partagé.

Ce binding supplémentaire n’est ni déclaré dans `wrangler.jsonc`, ni créé à distance. En son absence, le Worker renvoie 503 sans ouvrir de connexion et sans repli vers `HYPERDRIVE`. Les autres modules continuent d’utiliser leur binding actuel. Le code ne peut pas inspecter le réglage distant du cache à partir d’une simple chaîne de connexion : la vérification de sa désactivation est un prérequis d’exploitation.

Restent bloquants : votre validation manuelle de la migration, la préparation/validation de la connexion sans cache, les droits SQL réels et les contrôles de transport/configuration décrits ci-dessous. Aucun réglage TLS partagé n’a été modifié.

## Infrastructure Hyperdrive proposée — accord spécifique requis

Cloudflare indique que les écritures ne purgent pas automatiquement les résultats SQL mis en cache et recommande une configuration sans cache pour les lectures d’autorisations et les lectures immédiatement après écriture : [documentation Cloudflare](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/). Les commentaires SQL et les en-têtes HTTP ne sont pas une stratégie de désactivation du cache SQL.

Après votre accord spécifique uniquement :

1. Créer une configuration Hyperdrive supplémentaire pour la même base, avec les identifiants backend approuvés. Désactiver explicitement le cache (`caching.disabled = true` / option de création `--caching-disabled`). Ne pas modifier la configuration existante `HYPERDRIVE`.
2. Vérifier les certificats et le mode TLS de cette connexion, ainsi que le budget cumulé de connexions des deux pools. Ne pas exposer la chaîne de connexion dans les journaux, le navigateur ou le dépôt.
3. Ajouter un deuxième objet dans la liste `hyperdrive` de `wrangler.jsonc` pour chaque environnement concerné. Fragment proposé, NON APPLIQUÉ :

```json
{
  "binding": "HYPERDRIVE_INFORMATION",
  "id": "ID_CONFIGURATION_DEDIEE_AVEC_CACHE_DESACTIVE"
}
```

4. Confirmer dans la configuration Cloudflare que ce nouvel identifiant désigne effectivement une connexion sans cache. Le nom du binding ne garantit pas ce réglage.
5. Après une autorisation de livraison distincte, tester sur l’environnement choisi une modification de statut suivie immédiatement de sa lecture, puis une révocation de rôle/suspension de compte suivie d’un accès : aucune ancienne autorisation ne doit persister via un cache SQL.

Ces opérations d’infrastructure et de livraison ne sont pas autorisées ni effectuées dans la correction locale. Ne pas copier le même identifiant Hyperdrive avec cache actif sous un nouveau nom. Ne pas désactiver globalement le cache des autres modules pour contourner ce blocage.

## Exigences TLS, SQL et proxies

### Node.js

- `DATABASE_URL` reste fourni par l’environnement sécurisé ; ne pas lire ou imprimer sa valeur dans les rapports.
- Le code partagé existant `src/config/db.js` contient `ssl.rejectUnauthorized: false`. Ce réglage n’a pas été modifié et n’est pas validé comme configuration de production pour des données personnelles. Il faut établir la validation effective du certificat serveur et du nom d’hôte, avec l’autorité de confiance appropriée. Attention : certaines options SSL dans l’URL peuvent remplacer l’objet SSL fourni au pilote.
- Toute correction de ce réglage partagé nécessite votre autorisation spécifique, puis des vérifications de non-régression des connexions des autres modules. Ne pas activer Node en production tant que ce point n’est pas levé.

### Droits SQL et schéma

- La migration cible explicitement `public` et référence `public.compte_membre(id)`. Le rôle SQL d’exécution applicative doit résoudre ce schéma pour les requêtes du module.
- Le backend doit utiliser un principal SQL de confiance, propriétaire des nouvelles tables ou doté du privilège BYPASSRLS et des droits nécessaires. BYPASSRLS ne donne pas à lui seul les privilèges SQL. Ne pas créer de nouveaux privilèges/roles à titre automatique.
- Besoins fonctionnels : lecture/insertion/mise à jour des demandes ; lecture/insertion/mise à jour/suppression des compteurs ; accès existant au contexte d’authentification. Les droits effectifs et hérités doivent être vérifiés manuellement.
- `anon`, `authenticated` et PUBLIC n’obtiennent aucun droit direct sur ces tables, et aucune politique RLS permissive n’est ajoutée. Les propriétaires et principaux privilégiés demeurent dans le périmètre de confiance ; ne jamais exposer leurs identifiants au frontend.
- Utiliser le niveau d’isolation READ COMMITTED prévu par l’algorithme de reprise après conflit. Ne pas modifier un réglage global sans revue. La lecture après conflit est une instruction distincte pour voir la ligne validée par un autre concurrent ; ce ne doit pas devenir un SELECT combiné dans le même CTE.

### Proxies, quotas et horloges

- Node utilise l’adresse de la socket et ignore les en-têtes de transfert déclarés par un client. Derrière un reverse proxy, plusieurs utilisateurs peuvent partager artificiellement cette adresse. Définir une topologie de confiance et une protection au proxy ; ne pas activer globalement `trust proxy` sans autorisation ni vérification des en-têtes.
- Worker utilise l’adresse Cloudflare fournie dans son contexte. Vérifier sa transmission sur le chemin de déploiement retenu. La protection applicative n’empêche pas à elle seule un volume de connexions PostgreSQL excessif : une protection périphérique avant accès à la base est à prévoir.
- Toutes les instances doivent utiliser la même base, le même secret actif et des horloges synchronisées. Les fenêtres sont fixes, pas glissantes. La synchronisation horaire est nécessaire puisque leur début est calculé dans l’application et le nettoyage utilise l’heure PostgreSQL.

## Configuration obligatoire

| Élément | Utilisation |
|---|---|
| `DEMANDE_INFORMATION_SECRET` | Secret HMAC partagé, aléatoire, au moins 32 octets ; 64 caractères hexadécimaux recommandés. Le code exige au moins 32 caractères mais ne peut mesurer leur entropie. |
| `FRONTEND_URL` | Origine exacte autorisée pour POST/PATCH, sans origine alternative implicite en production. |
| `NODE_ENV=production` | En production ; seuls les environnements explicites development/test autorisent les origines localhost supplémentaires. |
| `DATABASE_URL` | Node uniquement ; rôle, schéma et TLS validés. |
| `HYPERDRIVE_INFORMATION` | Worker : connexion dédiée dont le cache est désactivé, à créer/déclarer uniquement après accord. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Authentification existante des utilisateurs connectés ; aucun secret privilégié à ajouter au frontend. |

Le secret doit être installé par le gestionnaire de secrets approprié, avec la même valeur sur les instances. Sa valeur ne doit apparaître ni dans `wrangler.jsonc`, ni dans le frontend, ni dans ce guide. Une absence/valeur trop courte provoque un refus 503 pour les protections qui l’utilisent.

## Application MANUELLE de la migration, par le propriétaire du projet

1. Lever les blocages ci-dessus et relire la version finale de `database/24_demande_information.sql`. Vérifier que le numéro 24 est toujours disponible et que cette migration n’a jamais été appliquée.
2. Avant toute ouverture publique, définir une durée de conservation, les droits d’accès aux sauvegardes et une procédure de suppression des demandes. Préparer une sauvegarde selon votre procédure habituelle.
3. Vérifier manuellement dans l’environnement cible : schéma `public`, `compte_membre.id` UUID et clé primaire, disponibilité de `gen_random_uuid()`, absence des deux nouvelles tables et présence des rôles SQL visés par REVOKE. Les contrôles distants sont effectués par vous ; les tests locaux ne les remplacent pas.
4. Prévoir une fenêtre d’intervention courte : les nouvelles clés étrangères peuvent prendre un verrou de métadonnées sur la table parente. Exécuter vous-même le fichier complet, du BEGIN au COMMIT, dans votre outil SQL Supabase habituel, avec arrêt sur erreur. Aucun script de l’application ne fait cette opération.
5. En cas d’échec, confirmer le rollback et arrêter. Ne pas ajouter de DROP CASCADE, supprimer une table existante ou rejouer aveuglément le script : le fichier refuse volontairement une table déjà présente.
6. Après exécution : vérifier les deux tables, contraintes, cinq index explicites (dont les deux index partiels de clés étrangères), les index implicites des clés primaires/unicité, RLS activé et droits effectifs/hérités. Vérifier le refus des accès directs clients ; ne pas rendre une politique publique pour masquer un problème de droits backend.
7. Valider un envoi visiteur, un envoi membre et les refus des lectures pour VISITEUR/MEMBRE/BUREAU. Vérifier la gestion ADMIN puis PASTEUR, les conflits de révision et le comportement des jetons expirés. Utiliser des données fictives et une procédure de nettoyage explicitement autorisée.
8. Vérifier les requêtes concurrentes via deux instances, la reprise du même envoi après réponse perdue, le rollback de la réservation si un quota échoue et l’absence de double consommation d’un quota de création.
9. Après votre validation manuelle et une autorisation de livraison distincte, ouvrir le module et surveiller erreurs, refus de quotas, volume et connexions. En cas d’incident, fermer d’abord le module, sans effacer ses tables ni altérer les autres modules.

## Accès

- Formulaire : `/demande-information`, public ou connecté, sans mot de passe obligatoire.
- Gestion : `/admin/demandes-information` et `/admin/demandes-information/:id`, ADMIN et PASTEUR seulement.
- API : `/api/demandes-information` (POST public, GET privé), `/preparation` (GET public), `/statistiques` (GET privé), `/:id` (GET privé), `/:id/statut` (PATCH privé).
- Aucun endpoint de suivi public ou de consultation par un membre n’est fourni. La réponse de création est seulement une confirmation générique.

## Protections

- JSON limité à 16 Ko avant le parseur général ; champs autorisés explicitement, nom/prénom 1–100 caractères, contact 3–255, message 10–5000.
- Jeton HMAC temporaire de 30 minutes, lié à une clé UUID de formulaire ; champ piège ; validation d’Origin pour POST/PATCH ; SQL paramétré ; affichage en texte React ; réponses non mises en cache.
- Quotas PostgreSQL atomiques partagés : préparation 30 / 15 min / adresse, envoi 10 / 15 min / adresse, création 3 / heure / contact et 5 / 15 min / compte. Leurs clés sont des HMAC, jamais des IP/contact en clair. Nettoyage opportuniste de 100 compteurs expirés maximum par consommation réussie.
- Node utilise l’adresse de la connexion, sans faire confiance à X-Forwarded-For. Derrière un reverse proxy, les quotas Node peuvent regrouper des utilisateurs : régler également un contrôle au proxy de confiance sans activer aveuglément `trust proxy`. Worker utilise l’adresse Cloudflare transmise dans son contexte d’exécution.
- Idempotence : INSERT avec ON CONFLICT DO NOTHING RETURNING sous contrainte unique, puis comparaison de l’empreinte liée au compte. Seul le gagnant consomme les quotas contact/compte, dans la même transaction que son insertion. Aucun advisory lock n’est utilisé. Un jeton expiré permet seulement la reprise exacte d’une demande déjà enregistrée ; il ne permet plus une nouvelle insertion. Les reprises identiques ne consomment pas une nouvelle création dans le quota de contact.
- La clé d’idempotence et les valeurs restent en mémoire pendant un envoi incertain, sans stockage des messages dans localStorage. La fermeture/recharge de l’onglet ne conserve pas le brouillon. La rotation du secret affecte les anciens jetons, les empreintes de reprise et les identifiants des quotas : suivre la procédure de rotation ci-dessous.
- Les changements de statut vérifient une révision pour éviter d’écraser la décision d’un autre responsable. Les coordonnées soumises sont des instantanés et ne modifient pas le profil.

Les quotas et le champ piège réduisent les abus ; ils ne remplacent pas une protection périphérique contre des robots distribués. Aucun CAPTCHA, fournisseur externe ou dépendance supplémentaire n’est installé.

## Conservation et maintenance

Définir une durée de conservation des demandes avant la mise en production. Aucune purge de demandes n’est activée automatiquement. Les références aux comptes deviennent NULL en cas de suppression du compte ; l’origine historique et les coordonnées de la demande restent conservées jusqu’à leur suppression autorisée.

Le nettoyage opportuniste ne supprime des compteurs que lorsqu’il existe du trafic autorisé. En cas de très grand volume, prévoir une maintenance autorisée des compteurs expirés et une surveillance du volume de demandes. Ne pas journaliser les messages, contacts, cookies ou jetons.

## Conservation et rotation du secret — validation opérationnelle requise

Les messages, noms et contacts sont stockés en clair dans les colonnes PostgreSQL ; HMAC ne chiffre pas ces données. Protéger le transport, les principaux SQL, les sauvegardes et leurs accès. Ne pas recopier ces données dans des logs de proxy, d’APM ou de diagnostic. Les clés pseudonymisées de quota restent des données à traiter avec précaution.

La durée de conservation des demandes n’est pas fixée par le code. Elle doit être décidée avant l’ouverture et appliquée par une procédure manuelle approuvée ou une future tâche de maintenance autorisée. Aucune purge de demandes ni modification de sauvegardes n’est lancée automatiquement.

Le secret unique sert actuellement à trois fonctions : signature des formulaires, empreinte du contenu pour l’idempotence et pseudonymisation des quotas. Une rotation immédiate rend les anciens jetons et empreintes inutilisables et remet logiquement les quotas à zéro (les anciennes lignes restent jusqu’au nettoyage). Il n’y a pas de trousseau multi-clés dans cette version.

Procédure à approuver avant toute rotation :
1. Fermer temporairement les nouvelles demandes sur toutes les instances et informer les utilisateurs de conserver leurs confirmations. Ne pas laisser simultanément deux secrets actifs différents.
2. Définir comment terminer les reprises en cours et traiter les envois incertains. Attendre simplement 30 minutes ne suffit pas : un ancien jeton peut encore rejouer une demande déjà enregistrée après son expiration. Il n’existe donc pas de délai maximal automatique garantissant que toutes les reprises sont closes.
3. Réconcilier les situations incertaines avec un responsable habilité, avant d’autoriser un nouvel envoi portant une nouvelle clé ; ne jamais effacer les demandes ou empreintes pour contourner un conflit.
4. Générer puis installer le nouveau secret simultanément sur toutes les instances via le gestionnaire sécurisé. Ne pas réécrire les empreintes déjà stockées, ni afficher les secrets. Documenter l’invalidation assumée des anciennes reprises.
5. Vérifier un nouveau formulaire, la cohérence des quotas et les réponses de refus des anciens jetons, puis rouvrir. Ne pas compter sur les anciens compteurs après rotation.

Une rotation transparente avec maintien des reprises et des quotas demanderait une évolution séparée (clés versionnées, conservation contrôlée des anciennes clés, stratégie de quotas stable), à concevoir et autoriser avant implémentation. La présente correction ne prétend pas fournir cette capacité.

## Tests sans base réelle

Backend : `node --test tests/demande-information.test.js tests/demande-information-concurrency.test.js` (inclut un serveur HTTP local et une base simulée).

Frontend : `node tests/run-information-browser.mjs` depuis le frontend. Vite et Edge existants sont utilisés ; aucun paquet n’est installé. Le navigateur appelle exclusivement des API simulées. Le script vérifie 320, 390, 768, 1024 et 1440 px. `EDGE_PATH` permet de choisir le navigateur Edge local. Les profils de navigateur de test sont créés dans le dossier temporaire.

Les tests simulés valident les parcours, requêtes, paramètres, refus et transactions attendues. Ils n’attestent pas l’exécution SQL réelle, les droits SQL du déploiement, la configuration des proxies ou le fonctionnement du runtime Cloudflare en production. Ces contrôles restent à effectuer dans un environnement autorisé après migration.

## Fichiers du module

### Backend — créés
- `database/24_demande_information.sql`
- `src/routes/demandesInformation.routes.js`
- `src/controllers/demandeInformation.controller.js`
- `src/services/demandeInformation.service.js`
- `src/services/demandeInformationProtection.service.js`
- `src/middlewares/demandeInformationProtection.middleware.js`
- `tests/demande-information.test.js`
- `tests/demande-information-concurrency.test.js`
- `src/config/demandeInformationDatabase.js`
- `docs/demande-information.md`

### Backend — modifiés
- `src/worker.js` : sélection de connexion limitée au nouveau module, avec refus 503 sans binding dédié ; aucune déclaration de binding ni modification TLS.
- `src/app.js` : montage du routeur et exclusion ciblée du parseur JSON global pour ce module, avec le même classement des chemins (dont les variantes de casse) que le routage Worker.

### Frontend — créés
- `src/api/demandesInformation.ts`
- `src/types/demandeInformation.ts`
- `src/pages/public/DemandeInformationPage.tsx`
- `src/pages/public/DemandeInformation.css`
- `src/pages/admin/DemandesInformationPage.tsx`
- `src/pages/admin/DemandeInformationDetailPage.tsx`
- `src/pages/admin/DemandesInformation.css`
- `src/components/layout/PublicNavigation.tsx`
- `tests/information.browser.html`
- `tests/information.browser.tsx`
- `tests/run-information-browser.mjs`

### Frontend — modifiés
- `src/routes/AppRouter.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/admin/AdminTopbar.tsx`
- `src/components/membre/MembreSidebar.tsx`
- `src/components/membre/MembreTopbar.tsx`
- `src/i18n/fr.ts`
- `src/i18n/mg.ts`

Les modifications précédemment présentes dans les dépôts sont conservées. Aucun fichier du module Contributions ou de la gestion des personnes n’est modifié dans cette livraison.

## Portée des vérifications

Les vérifications historiques du formulaire ont couvert les cinq largeurs demandées et les parcours FR/MG. La correction de sécurité ajoute des tests à transactions entrelacées modélisant les attentes d’un index unique, les reprises, les conflits de contenu, les rollbacks et les quotas partagés. Leurs résultats sont communiqués dans le rapport de livraison.

Ces simulations ne constituent pas un test PostgreSQL réel ni une preuve du réglage distant du cache. Un contrôle des droits, de TLS, du routage et du cache dans l’environnement choisi reste indispensable après les opérations manuelles autorisées. Le module ne devient pas prêt pour la production sur la seule base des tests locaux.
