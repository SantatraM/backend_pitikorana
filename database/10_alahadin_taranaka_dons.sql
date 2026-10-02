-- =========================================================
-- ALAHADIN'NY TARANAKA / DONS V1
-- Structure uniquement : aucune journée ni aucun don n'est créé.
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS journee_alahadin_taranaka (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_journee date NOT NULL,
  statut varchar(20) NOT NULL DEFAULT 'BROUILLON',
  observation text NULL,
  id_compte_createur uuid NULL
    REFERENCES compte_membre(id) ON DELETE SET NULL,
  date_creation timestamptz NOT NULL DEFAULT now(),
  date_modification timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT journee_alahadin_taranaka_statut_check
    CHECK (statut IN ('BROUILLON', 'OUVERTE', 'CLOTUREE'))
);

CREATE TABLE IF NOT EXISTS journee_alahadin_taranaka_taranaka (
  id_journee uuid NOT NULL
    REFERENCES journee_alahadin_taranaka(id) ON DELETE RESTRICT,
  id_taranaka uuid NOT NULL
    REFERENCES element(id) ON DELETE RESTRICT,

  CONSTRAINT journee_alahadin_taranaka_taranaka_pkey
    PRIMARY KEY (id_journee, id_taranaka)
);

CREATE TABLE IF NOT EXISTS don (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_journee uuid NOT NULL
    REFERENCES journee_alahadin_taranaka(id) ON DELETE RESTRICT,

  type_donateur varchar(20) NOT NULL,
  id_taranaka uuid NULL
    REFERENCES element(id) ON DELETE RESTRICT,
  id_sampana uuid NULL
    REFERENCES element(id) ON DELETE RESTRICT,
  id_foyer uuid NULL
    REFERENCES foyer(id) ON DELETE RESTRICT,
  id_personne uuid NULL
    REFERENCES personne(id) ON DELETE RESTRICT,

  type_don varchar(20) NOT NULL,
  montant numeric(14, 2) NULL,
  devise varchar(10) NULL,
  designation varchar(200) NULL,
  quantite numeric(14, 3) NULL,
  unite varchar(50) NULL,

  observation text NULL,
  statut varchar(20) NOT NULL DEFAULT 'VALIDE',
  id_taranaka_snapshot uuid NULL
    REFERENCES element(id) ON DELETE RESTRICT,
  id_sampana_snapshot uuid NULL
    REFERENCES element(id) ON DELETE RESTRICT,

  id_compte_createur uuid NULL
    REFERENCES compte_membre(id) ON DELETE SET NULL,
  id_compte_modificateur uuid NULL
    REFERENCES compte_membre(id) ON DELETE SET NULL,
  id_compte_annulateur uuid NULL
    REFERENCES compte_membre(id) ON DELETE SET NULL,
  date_creation timestamptz NOT NULL DEFAULT now(),
  date_modification timestamptz NOT NULL DEFAULT now(),
  date_annulation timestamptz NULL,
  motif_annulation text NULL,

  CONSTRAINT don_type_donateur_check
    CHECK (type_donateur IN ('TARANAKA', 'SAMPANA', 'FOYER', 'PERSONNE')),

  CONSTRAINT don_donateur_check
    CHECK (
      (type_donateur = 'TARANAKA'
        AND id_taranaka IS NOT NULL
        AND id_sampana IS NULL
        AND id_foyer IS NULL
        AND id_personne IS NULL)
      OR
      (type_donateur = 'SAMPANA'
        AND id_taranaka IS NULL
        AND id_sampana IS NOT NULL
        AND id_foyer IS NULL
        AND id_personne IS NULL)
      OR
      (type_donateur = 'FOYER'
        AND id_taranaka IS NULL
        AND id_sampana IS NULL
        AND id_foyer IS NOT NULL
        AND id_personne IS NULL)
      OR
      (type_donateur = 'PERSONNE'
        AND id_taranaka IS NULL
        AND id_sampana IS NULL
        AND id_foyer IS NULL
        AND id_personne IS NOT NULL)
    ),

  CONSTRAINT don_type_don_check
    CHECK (type_don IN ('ARGENT', 'MATERIEL')),

  CONSTRAINT don_contenu_check
    CHECK (
      (type_don = 'ARGENT'
        AND montant IS NOT NULL
        AND montant > 0
        AND devise IS NOT NULL
        AND btrim(devise) <> ''
        AND designation IS NULL
        AND quantite IS NULL
        AND unite IS NULL)
      OR
      (type_don = 'MATERIEL'
        AND montant IS NULL
        AND devise IS NULL
        AND designation IS NOT NULL
        AND btrim(designation) <> ''
        AND quantite IS NOT NULL
        AND quantite > 0
        AND unite IS NOT NULL
        AND btrim(unite) <> '')
    ),

  CONSTRAINT don_statut_check
    CHECK (statut IN ('VALIDE', 'ANNULE')),

  CONSTRAINT don_annulation_check
    CHECK (
      (statut = 'VALIDE'
        AND date_annulation IS NULL
        AND id_compte_annulateur IS NULL
        AND motif_annulation IS NULL)
      OR
      (statut = 'ANNULE'
        AND date_annulation IS NOT NULL
        AND motif_annulation IS NOT NULL
        AND btrim(motif_annulation) <> '')
    )
);

CREATE INDEX IF NOT EXISTS don_id_journee_idx
  ON don (id_journee);

CREATE INDEX IF NOT EXISTS don_journee_statut_type_idx
  ON don (id_journee, statut, type_don);

CREATE INDEX IF NOT EXISTS don_id_taranaka_idx
  ON don (id_taranaka)
  WHERE id_taranaka IS NOT NULL;

CREATE INDEX IF NOT EXISTS don_id_sampana_idx
  ON don (id_sampana)
  WHERE id_sampana IS NOT NULL;

CREATE INDEX IF NOT EXISTS don_id_foyer_idx
  ON don (id_foyer)
  WHERE id_foyer IS NOT NULL;

CREATE INDEX IF NOT EXISTS don_id_personne_idx
  ON don (id_personne)
  WHERE id_personne IS NOT NULL;

CREATE INDEX IF NOT EXISTS don_journee_taranaka_snapshot_idx
  ON don (id_journee, id_taranaka_snapshot);

CREATE INDEX IF NOT EXISTS don_journee_sampana_snapshot_idx
  ON don (id_journee, id_sampana_snapshot);

COMMIT;

-- Vérification après exécution manuelle : aucune donnée n'est insérée ici.
SELECT count(*) AS nombre_journees
FROM journee_alahadin_taranaka;

SELECT count(*) AS nombre_dons
FROM don;
