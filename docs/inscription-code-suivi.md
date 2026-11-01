# Codes courts de suivi des inscriptions — préparation locale

## État et périmètre

Code des nouvelles demandes : 3 lettres A–Z hors I/O, tiret, 5 chiffres 2–9 (exemple KRM-58329). Node crypto.randomInt fournit un tirage uniforme cryptographique, sans Math.random ni réduction modulo biaisée. La référence PIT-AAAA-XXXXXXXX et sa génération restent inchangées. Les anciens hashes scrypt et les anciens codes longs ne sont ni remplacés ni recalculés.

Le suivi exige toujours **référence ET code**. Le code seul ne donne pas accès à une demande. Le résultat expose le statut, les dates et éventuellement le commentaire administratif : il reste confidentiel. Le même couple permet la création du compte après validation, selon les règles existantes. Le code court dispose d’environ 28,8 bits d’entropie (452 984 832 possibilités) : il ne doit jamais devenir un identifiant public ou un mot de passe utilisé seul. Conserver la référence et le code privés.

La confirmation affiche déjà ces deux valeurs séparées et propose deux boutons Copier ; ce composant est conservé. Ni le code brut, ni son empreinte, ni le hash scrypt ne sont ajoutés aux vues/listes ou aux journaux.

## Unicité et transaction

Une table privée inscription_code_suivi associe l’empreinte HMAC-SHA256 du nouveau code à l’identifiant de demande. Sa clé primaire garantit l’unicité entre créations concurrentes ; une FK unique associe chaque réservation à une seule demande. Le scrypt salé reste le vérificateur utilisé pour les anciens et nouveaux codes.

Insertion de demande et réservation sont dans la même transaction. Une collision de référence ou d’empreinte revient au SAVEPOINT puis génère un nouveau couple, au maximum cinq fois. Une erreur étrangère à ces deux contraintes n’est jamais assimilée à une collision. Un échec final annule la transaction. Aucun changement des données Personnes ou des règles de validation/attribution de compte.

## Configuration préalable obligatoire

Configurer INSCRIPTION_TRACKING_SECRET dans le .env backend : secret aléatoire privé d’au moins 32 caractères, par exemple 32 octets cryptographiques encodés en hexadécimal. Il ne doit jamais être copié dans Vite, le navigateur ou Git. La variable est documentée vide dans .env.example ; aucun secret réel n’a été créé ou affiché par cette intervention.

**Le secret doit être identique et stable sur toutes les instances et à chaque redémarrage. Ne pas le faire tourner tant que des codes courts existent.** Changer cette clé casserait la comparaison des réservations d’unicité et les quotas. Une rotation future exige une stratégie versionnée maintenant une empreinte d’unicité commune, à concevoir avant toute rotation ; les codes en clair ne sont pas conservés pour réindexer les anciennes réservations. Une clé absente/trop courte bloque les nouvelles créations et le suivi au lieu de désactiver les contrôles. Les anciennes vérifications scrypt n’utilisent pas cette clé, mais le quota public la requiert.

## Protection des essais

Les routes publiques POST /api/demandes-inscription/suivi ET /creer-compte utilisent le même quota : 30 essais par adresse réseau et 10 par référence par fenêtre fixe de 15 minutes, réussites et échecs compris. Les compteurs PostgreSQL atomiques sont partagés entre processus, indépendants de la mémoire Node. Réponse 429 et Retry-After à l’épuisement ; 503 générique si schéma/secret indisponible. Aucune information nominative dans ces réponses. Une référence inconnue passe aussi par scrypt pour réduire la différence temporelle avec un mauvais code sur une référence existante.

L’adresse retenue est celle de la connexion réseau réelle ; les en-têtes X-Forwarded-For libres sont ignorés. Derrière un proxy, tous les visiteurs peuvent partager le quota du proxy : prévoir une limitation fiable en amont avant hébergement, sans modifier automatiquement trust proxy ni l’authentification. Fenêtres fixes : un pic à la frontière de deux fenêtres reste possible. Un attaquant distribué connaissant une référence peut temporairement la bloquer par essais répétés ; ne pas désactiver le quota pour contourner ce risque.

Les IP et références sont pseudonymisées avec HMAC dans les quotas, non stockées en clair. Nettoyage borné des fenêtres expirées lors des requêtes ; si aucune requête ne survient, les lignes expirées restent jusqu’à une prochaine requête ou une maintenance manuelle. Cache-Control: no-store sur confirmation API, suivi et création du compte. Ne pas journaliser les corps de ces requêtes ou réponses dans un proxy.

## Migration 25 — exclusivement manuelle

Le numéro 25 était libre dans les fichiers locaux au moment de la préparation. Fichier : database/25_inscription_code_suivi.sql. Aucune connexion à Supabase ni exécution SQL n’a été effectuée.

1. Vérifier vous-même l’environnement cible, les sauvegardes, l’absence de migration 25 déjà appliquée et public.demande_inscription(id UUID).
2. Appliquer vous-même le fichier complet, BEGIN à COMMIT. Il crée seulement le registre privé, le quota et leurs index/FK. Aucune mise à jour des anciennes demandes. En cas d’erreur, arrêter et vérifier le rollback ; ne pas ajouter de suppression pour forcer le passage.
3. Vérifier vous-même les PK/unicités, la FK, l’index expiration, RLS activé et les droits révoqués à PUBLIC/anon/authenticated sur les deux nouvelles tables. Aucun accès client direct n’est créé. La connexion SQL de confiance du backend doit être propriétaire/BYPASSRLS avec les droits nécessaires sur ces tables et la lecture de demande_inscription pour la FK ; ne pas utiliser anon/authenticated comme rôle SQL backend.
4. Configurer le secret stable, redémarrer le backend et confirmer dans le chat l’application manuelle avant tout essai nécessitant les tables réelles. Déployer le SQL avant ce code : sans ces prérequis, nouvelles créations et endpoints de suivi échouent de façon fermée.
5. Autoriser ensuite des demandes entièrement fictives pour vérifier la création, le suivi court/ancien, la concurrence, les quotas et la création d’un compte après validation. Ne pas modifier les demandes métier pour les tests. Les données réelles et le parcours Supabase ne sont PAS validés par les tests simulés.

Toutes les migrations sont exécutées manuellement par le propriétaire du projet. Aucun script de démarrage ou de test n’exécute ce fichier.

## Tests locaux sans base réelle

Backend : node --test tests/inscription-tracking.test.js (SQL et stockage simulés, connexions réelles interdites). Frontend : node tests/run-inscription-tracking-browser.mjs (pages réelles, API et presse-papiers simulés, cinq largeurs). La confirmation avec copie est exercée via une demande fictive pour une personne préexistante ; le service backend teste aussi une nouvelle fiche dans les données de demande, sans créer de Personne réelle.

## Fichiers de cette intervention

Backend (modifiés) : .env.example ; src/utils/suiviInscription.js ; src/services/demandeInscription.service.js ; src/controllers/demandeInscription.controller.js ; src/routes/demandesInscription.routes.js.

Backend (créés) : src/services/inscriptionTracking.service.js ; src/middlewares/inscriptionTracking.middleware.js ; database/25_inscription_code_suivi.sql ; tests/inscription-tracking.test.js ; docs/inscription-code-suivi.md.

Frontend (modifiés) : src/pages/public/SuiviInscriptionPage.tsx ; src/i18n/fr.ts ; src/i18n/mg.ts ; src/index.css (règles limitées aux pages de suivi/confirmation).

Frontend (créés) : src/utils/inscriptionTracking.ts ; tests/inscription-tracking.browser.html ; tests/inscription-tracking.browser.tsx ; tests/run-inscription-tracking-browser.mjs.

La confirmation existante dans InscriptionPage.tsx n’a pas besoin de modification : elle affiche déjà le code renvoyé et son bouton de copie. Les modules Personnes, Contributions et Demande d’information ne sont pas modifiés par cette intervention ; leurs changements préexistants sont conservés.

## Résultats des vérifications locales

- 11 nouveaux tests backend réussis ; 97 tests réussis avec la sélection de non-régression existante.
- Edge avec API et presse-papiers simulés : réussites à 320, 390, 768, 1024 et 1440 px. Confirmation FR/MG, valeurs séparées, copie, suivi court avec/sans tiret, code long, validation, erreur générique et limitation, aucun débordement horizontal détecté.
- TypeScript, build Vite et ESLint ciblé backend/frontend : réussis. Avertissement existant du build sur les chunks supérieurs à 500 kB.
- git diff --check : réussi.
- Aucun test contre PostgreSQL, stockage Supabase ou compte réel. L’application effective de la migration, les droits SQL réels et le fonctionnement de bout en bout avec la base réelle restent à valider après intervention manuelle.
