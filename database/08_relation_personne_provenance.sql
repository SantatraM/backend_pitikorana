-- =========================================================
-- TRAÇABILITÉ DES RELATIONS ENTRE PERSONNES
-- Migration à exécuter après 01 à 07.
-- =========================================================

BEGIN;

-- Les relations historiques et les relations créées par les parcours actuels
-- restent manuelles par défaut. AUTO est réservé à une future propagation.
ALTER TABLE relation_personne
  ADD COLUMN IF NOT EXISTS origine varchar(10) NOT NULL DEFAULT 'MANUELLE';

UPDATE relation_personne
SET origine = 'MANUELLE'
WHERE origine IS NULL;

ALTER TABLE relation_personne
  ALTER COLUMN origine SET DEFAULT 'MANUELLE',
  ALTER COLUMN origine SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'relation_personne'::regclass
      AND conname = 'relation_personne_origine_check'
  ) THEN
    ALTER TABLE relation_personne
      ADD CONSTRAINT relation_personne_origine_check
      CHECK (origine IN ('MANUELLE', 'AUTO'));
  END IF;
END $$;

-- Une relation AUTO peut avoir plusieurs relations justificatives.
-- La suppression d'une relation retire uniquement les liens de justification
-- qui la concernent ; elle ne déclenche aucune suppression automatique d'une
-- autre relation_personne.
CREATE TABLE IF NOT EXISTS relation_personne_justification (
  id_relation uuid NOT NULL
    REFERENCES relation_personne(id) ON DELETE CASCADE,
  id_relation_source uuid NOT NULL
    REFERENCES relation_personne(id) ON DELETE CASCADE,
  CONSTRAINT relation_personne_justification_pkey
    PRIMARY KEY (id_relation, id_relation_source),
  CONSTRAINT relation_personne_justification_relation_differente
    CHECK (id_relation <> id_relation_source)
);

COMMIT;

-- Vérification après exécution manuelle.
SELECT id, origine
FROM relation_personne
ORDER BY date_creation ASC, id ASC;

SELECT id_relation, id_relation_source
FROM relation_personne_justification
ORDER BY id_relation, id_relation_source;
