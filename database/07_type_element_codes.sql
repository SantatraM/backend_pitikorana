-- =========================================================
-- REFERENTIEL TYPE_ELEMENT : CODES METIER STABLES
-- Migration à exécuter après 01 à 06.
-- =========================================================

BEGIN;

ALTER TABLE type_element
  ADD COLUMN IF NOT EXISTS code varchar(50);

-- Chaque type historique attendu doit être présent une seule fois.
DO $$
DECLARE
  expected_code text;
  matches integer;
BEGIN
  FOREACH expected_code IN ARRAY ARRAY['RAZAMBE', 'TARANAKA', 'SAMPANA']
  LOOP
    SELECT count(*)
    INTO matches
    FROM type_element
    WHERE upper(btrim(libelle)) = expected_code;

    IF matches <> 1 THEN
      RAISE EXCEPTION
        'Le type_element % doit être présent exactement une fois (trouvé : %)',
        expected_code,
        matches;
    END IF;
  END LOOP;
END $$;

-- Les UUID existants sont conservés : seules les lignes reconnues sont enrichies.
UPDATE type_element
SET code = upper(btrim(libelle))
WHERE upper(btrim(libelle)) IN ('RAZAMBE', 'TARANAKA', 'SAMPANA');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'type_element'::regclass
      AND conname = 'type_element_code_unique'
  ) THEN
    ALTER TABLE type_element
      ADD CONSTRAINT type_element_code_unique UNIQUE (code);
  END IF;

  IF EXISTS (SELECT 1 FROM type_element WHERE code IS NULL) THEN
    RAISE NOTICE
      'Au moins un type_element ne possède pas de code : la colonne reste nullable.';
  ELSE
    ALTER TABLE type_element
      ALTER COLUMN code SET NOT NULL;
  END IF;
END $$;

-- Même contrat public pour la vue : seule la détermination des niveaux utilise code.
CREATE OR REPLACE VIEW v_element_hierarchie AS
WITH RECURSIVE hierarchy AS (
  SELECT
    e.id AS source_element_id,
    e.id,
    e.nom,
    e.rattachement_sup,
    te.code AS type_element_code,
    ARRAY[e.id] AS chemin
  FROM element e
  JOIN type_element te ON te.id = e.id_type_element

  UNION ALL

  SELECT
    h.source_element_id,
    parent.id,
    parent.nom,
    parent.rattachement_sup,
    te.code,
    h.chemin || parent.id
  FROM hierarchy h
  JOIN element parent ON parent.id = h.rattachement_sup
  JOIN type_element te ON te.id = parent.id_type_element
  WHERE NOT parent.id = ANY(h.chemin)
)
SELECT
  source_element_id AS id_element,
  max(id::text) FILTER (WHERE type_element_code = 'RAZAMBE')::uuid AS id_razambe,
  max(nom) FILTER (WHERE type_element_code = 'RAZAMBE') AS nom_razambe,
  max(id::text) FILTER (WHERE type_element_code = 'TARANAKA')::uuid AS id_taranaka,
  max(nom) FILTER (WHERE type_element_code = 'TARANAKA') AS nom_taranaka,
  max(id::text) FILTER (WHERE type_element_code = 'SAMPANA')::uuid AS id_sampana,
  max(nom) FILTER (WHERE type_element_code = 'SAMPANA') AS nom_sampana
FROM hierarchy
GROUP BY source_element_id;

COMMIT;

-- Vérification après exécution manuelle.
SELECT id, code, libelle
FROM type_element
ORDER BY code NULLS LAST, libelle;