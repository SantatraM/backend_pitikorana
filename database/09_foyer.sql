-- =========================================================
-- FOYER PERSISTANT V1
-- Structure uniquement : aucun foyer n'est créé par cette migration.
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS foyer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_personne_1 uuid NOT NULL
    REFERENCES personne(id) ON DELETE RESTRICT,
  id_personne_2 uuid NULL
    REFERENCES personne(id) ON DELETE RESTRICT,
  type_foyer varchar(20) NOT NULL,
  statut varchar(20) NOT NULL DEFAULT 'ACTIF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT foyer_type_foyer_check
    CHECK (type_foyer IN ('COUPLE', 'MONOPARENTAL')),

  CONSTRAINT foyer_statut_check
    CHECK (statut IN ('ACTIF', 'CLOTURE')),

  CONSTRAINT foyer_noyau_check
    CHECK (
      (
        type_foyer = 'COUPLE'
        AND id_personne_2 IS NOT NULL
        AND id_personne_1 <> id_personne_2
        AND id_personne_1 < id_personne_2
      )
      OR
      (
        type_foyer = 'MONOPARENTAL'
        AND id_personne_2 IS NULL
      )
    )

);

-- Un seul foyer persistant par couple canonique, y compris après clôture.
CREATE UNIQUE INDEX IF NOT EXISTS foyer_couple_noyau_unique
  ON foyer (id_personne_1, id_personne_2)
  WHERE type_foyer = 'COUPLE';

-- Un seul foyer monoparental persistant par personne fondatrice.
CREATE UNIQUE INDEX IF NOT EXISTS foyer_monoparental_noyau_unique
  ON foyer (id_personne_1)
  WHERE type_foyer = 'MONOPARENTAL';

COMMIT;

-- Vérification après exécution manuelle : aucun foyer n'est inséré ici.
SELECT count(*) AS nombre_foyers
FROM foyer;
