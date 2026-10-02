-- =========================================================
-- REFERENTIEL DES RELATIONS FAMILIALES GENERIQUES
-- Migration à exécuter après 01 à 05.
-- La base de départ attendue ne contient aucun type ni relation de test.
-- =========================================================

BEGIN;

ALTER TABLE type_relation
  ADD COLUMN IF NOT EXISTS code varchar(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'type_relation'::regclass
      AND conname = 'type_relation_code_unique'
  ) THEN
    ALTER TABLE type_relation
      ADD CONSTRAINT type_relation_code_unique UNIQUE (code);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM langue WHERE lower(btrim(code)) = 'fr') THEN
    RAISE EXCEPTION 'La langue FR est requise pour les traductions des relations';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM langue WHERE lower(btrim(code)) = 'mg') THEN
    RAISE EXCEPTION 'La langue MG est requise pour les traductions des relations';
  END IF;
END $$;

INSERT INTO type_relation (code)
VALUES
  ('PARENT'),
  ('ENFANT'),
  ('FRATRIE'),
  ('CONJOINT')
ON CONFLICT (code) DO NOTHING;

-- Les inverses genrés ne sont plus utilisés et restent volontairement NULL.
UPDATE type_relation relation
SET
  id_inverse_defaut = inverse_relation.id,
  id_inverse_masculin = NULL,
  id_inverse_feminin = NULL
FROM type_relation inverse_relation
WHERE (relation.code = 'PARENT'   AND inverse_relation.code = 'ENFANT')
   OR (relation.code = 'ENFANT'   AND inverse_relation.code = 'PARENT')
   OR (relation.code = 'FRATRIE'  AND inverse_relation.code = 'FRATRIE')
   OR (relation.code = 'CONJOINT' AND inverse_relation.code = 'CONJOINT');

-- Traductions validées.
INSERT INTO type_relation_traduction (id_type_relation, id_langue, libelle)
SELECT relation.id, langue.id, traduction.libelle
FROM (
  VALUES
    ('PARENT',   'fr', 'Parent'),
    ('ENFANT',   'fr', 'Enfant'),
    ('FRATRIE',  'fr', 'Frère / Sœur'),
    ('CONJOINT', 'fr', 'Conjoint(e)'),
    ('PARENT',   'mg', 'Ray aman-dreny'),
    ('ENFANT',   'mg', 'Zanaka'),
    ('FRATRIE',  'mg', 'Mpirahalahy / Mpirahavavy'),
    ('CONJOINT', 'mg', 'Vady')
) AS traduction(code_relation, code_langue, libelle)
JOIN type_relation relation ON relation.code = traduction.code_relation
JOIN langue ON lower(btrim(langue.code)) = traduction.code_langue
ON CONFLICT (id_type_relation, id_langue) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM type_relation WHERE code IS NULL) THEN
    RAISE EXCEPTION 'Chaque type_relation doit recevoir un code avant NOT NULL';
  END IF;

  ALTER TABLE type_relation
    ALTER COLUMN code SET NOT NULL;
END $$;

COMMIT;

-- Vérification : types, traductions et inverses configurés.
SELECT
  relation.id,
  relation.code,
  inverse_relation.code AS code_inverse_defaut,
  relation.id_inverse_masculin,
  relation.id_inverse_feminin,
  langue.code AS code_langue,
  traduction.libelle
FROM type_relation relation
LEFT JOIN type_relation inverse_relation
  ON inverse_relation.id = relation.id_inverse_defaut
LEFT JOIN type_relation_traduction traduction
  ON traduction.id_type_relation = relation.id
LEFT JOIN langue ON langue.id = traduction.id_langue
ORDER BY relation.code ASC, langue.code ASC;
