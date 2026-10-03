-- Référentiel définitif des liens avec Falimanjaka.
-- Ne crée aucune donnée Personne et ne modifie aucune demande d'inscription.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM langue WHERE code = 'fr') THEN
    RAISE EXCEPTION 'Langue requise absente : fr';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM langue WHERE code = 'mg') THEN
    RAISE EXCEPTION 'Langue requise absente : mg';
  END IF;
END
$$;

-- Source temporaire : les contrôles visent exactement les quatre liens de ce seed.
CREATE TEMP TABLE pitikorana_seed_liens_falimanjaka (
  id uuid PRIMARY KEY,
  libelle_fr text NOT NULL,
  libelle_mg text NOT NULL
) ON COMMIT DROP;

INSERT INTO pitikorana_seed_liens_falimanjaka (id, libelle_fr, libelle_mg) VALUES
  ('16000000-0000-4000-8000-000000000001'::uuid, 'Descendant(e) d''un taranaka de Falimanjaka', 'Taranaky ny taranaka iray avy ao Falimanjaka'),
  ('16000000-0000-4000-8000-000000000002'::uuid, 'Conjoint(e) d''un membre d''un taranaka', 'Vadin''ny mpikambana ao amin''ny taranaka iray'),
  ('16000000-0000-4000-8000-000000000003'::uuid, 'Né(e) ou ayant vécu à Falimanjaka', 'Teraka na efa nonina tao Falimanjaka'),
  ('16000000-0000-4000-8000-000000000004'::uuid, 'Autre', 'Hafa');

INSERT INTO lien_avec_falimanjaka (id)
SELECT id FROM pitikorana_seed_liens_falimanjaka
ON CONFLICT (id) DO NOTHING;

WITH langues AS (
  SELECT code, id FROM langue WHERE code IN ('fr', 'mg')
), traductions AS (
  SELECT source.id AS id_lien, langue.id AS id_langue,
    CASE langue.code WHEN 'fr' THEN source.libelle_fr ELSE source.libelle_mg END AS libelle
  FROM pitikorana_seed_liens_falimanjaka source
  CROSS JOIN langues langue
)
INSERT INTO lien_avec_falimanjaka_traduction (id_lien, id_langue, libelle)
SELECT id_lien, id_langue, libelle FROM traductions
ON CONFLICT (id_lien, id_langue) DO UPDATE SET libelle = EXCLUDED.libelle;

-- Contrôles limités aux données de ce seed, avant suppression de la table temporaire.
SELECT count(*) AS liens_seed FROM pitikorana_seed_liens_falimanjaka;
SELECT langue.code, count(*) AS traductions_seed
FROM lien_avec_falimanjaka_traduction traduction
JOIN pitikorana_seed_liens_falimanjaka source ON source.id = traduction.id_lien
JOIN langue ON langue.id = traduction.id_langue
WHERE langue.code IN ('fr', 'mg')
GROUP BY langue.code ORDER BY langue.code;
SELECT source.id AS lien_sans_fr_ou_mg
FROM pitikorana_seed_liens_falimanjaka source
CROSS JOIN (SELECT id FROM langue WHERE code IN ('fr', 'mg')) langue
LEFT JOIN lien_avec_falimanjaka_traduction traduction
  ON traduction.id_lien = source.id AND traduction.id_langue = langue.id
WHERE traduction.id_lien IS NULL;
SELECT traduction.libelle AS libelle_fr_duplique, count(*)
FROM lien_avec_falimanjaka_traduction traduction
JOIN pitikorana_seed_liens_falimanjaka source ON source.id = traduction.id_lien
JOIN langue ON langue.id = traduction.id_langue
WHERE langue.code = 'fr'
GROUP BY traduction.libelle HAVING count(*) > 1;
SELECT traduction.libelle AS libelle_mg_duplique, count(*)
FROM lien_avec_falimanjaka_traduction traduction
JOIN pitikorana_seed_liens_falimanjaka source ON source.id = traduction.id_lien
JOIN langue ON langue.id = traduction.id_langue
WHERE langue.code = 'mg'
GROUP BY traduction.libelle HAVING count(*) > 1;
SELECT id AS uuid_source_duplique, count(*)
FROM pitikorana_seed_liens_falimanjaka
GROUP BY id HAVING count(*) > 1;
SELECT traduction.id_lien AS traduction_orpheline
FROM lien_avec_falimanjaka_traduction traduction
JOIN pitikorana_seed_liens_falimanjaka source ON source.id = traduction.id_lien
LEFT JOIN lien_avec_falimanjaka lien ON lien.id = traduction.id_lien
WHERE lien.id IS NULL;

COMMIT;
