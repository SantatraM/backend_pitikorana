import database from "../config/db.js";
import { getFoyerPersonne } from "./personne.service.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTypeFoyer(value) {
  if (!["COUPLE", "MONOPARENTAL"].includes(value)) {
    throw businessError("Le type de foyer est invalide", "FOYER_TYPE_INVALID");
  }
  return value;
}

function normalizePersonneId(value, position) {
  if (!isUuid(value)) {
    throw businessError(`La personne ${position} est requise et doit être valide`, "FOYER_PERSONNE_INVALID");
  }
  return value.toLowerCase();
}

async function verifyPersonnesExist(idPersonne1, idPersonne2 = null) {
  const ids = idPersonne2 ? [idPersonne1, idPersonne2] : [idPersonne1];
  const result = await database.query(
    "SELECT id FROM personne WHERE id = ANY($1::uuid[])",
    [ids],
  );
  const foundIds = new Set(result.rows.map((row) => row.id));
  const missingId = ids.find((id) => !foundIds.has(id));
  if (missingId) {
    throw businessError("Personne introuvable", "FOYER_PERSONNE_NOT_FOUND");
  }
}

async function canonicalizeCoupleIds(idPersonne1, idPersonne2) {
  const result = await database.query(
    "SELECT LEAST($1::uuid, $2::uuid) AS id_personne_1, GREATEST($1::uuid, $2::uuid) AS id_personne_2",
    [idPersonne1, idPersonne2],
  );
  return result.rows[0];
}

async function getOrCreateCouple(idPersonne1, idPersonne2) {
  const inserted = await database.query(
    `INSERT INTO foyer (id_personne_1, id_personne_2, type_foyer)
    VALUES ($1, $2, 'COUPLE')
    ON CONFLICT (id_personne_1, id_personne_2)
      WHERE type_foyer = 'COUPLE'
    DO NOTHING
    RETURNING id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at`,
    [idPersonne1, idPersonne2],
  );
  if (inserted.rows[0]) return inserted.rows[0];

  const existing = await database.query(
    `SELECT id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at
    FROM foyer
    WHERE type_foyer = 'COUPLE'
      AND id_personne_1 = $1
      AND id_personne_2 = $2`,
    [idPersonne1, idPersonne2],
  );
  return existing.rows[0];
}

async function getOrCreateMonoparental(idPersonne1) {
  const inserted = await database.query(
    `INSERT INTO foyer (id_personne_1, type_foyer)
    VALUES ($1, 'MONOPARENTAL')
    ON CONFLICT (id_personne_1)
      WHERE type_foyer = 'MONOPARENTAL'
    DO NOTHING
    RETURNING id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at`,
    [idPersonne1],
  );
  if (inserted.rows[0]) return inserted.rows[0];

  const existing = await database.query(
    `SELECT id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at
    FROM foyer
    WHERE type_foyer = 'MONOPARENTAL'
      AND id_personne_1 = $1`,
    [idPersonne1],
  );
  return existing.rows[0];
}

export async function getOrCreateFoyer({ typeFoyer, idPersonne1, idPersonne2 = null } = {}) {
  const type = normalizeTypeFoyer(typeFoyer);
  const personne1 = normalizePersonneId(idPersonne1, 1);

  if (type === 'MONOPARENTAL') {
    if (idPersonne2 !== null && idPersonne2 !== undefined) {
      throw businessError("Un foyer monoparental ne peut avoir qu'une personne fondatrice", "FOYER_STRUCTURE_INVALID");
    }
    return database.transaction(async () => {
      await verifyPersonnesExist(personne1);
      return getOrCreateMonoparental(personne1);
    });
  }

  const personne2 = normalizePersonneId(idPersonne2, 2);
  if (personne1 === personne2) {
    throw businessError("Un foyer de couple nécessite deux personnes distinctes", "FOYER_PERSONNES_IDENTIQUES");
  }

  return database.transaction(async () => {
    const couple = await canonicalizeCoupleIds(personne1, personne2);
    await verifyPersonnesExist(couple.id_personne_1, couple.id_personne_2);
    return getOrCreateCouple(couple.id_personne_1, couple.id_personne_2);
  });
}

function normalizeContexte(value) {
  if (!["ORIGINE", "FORME"].includes(value)) {
    throw businessError("Le contexte de foyer est invalide", "FOYER_CONTEXT_INVALID");
  }
  return value;
}

export async function resolveOrCreatePersistentFoyer({ personneId, contexte } = {}) {
  const contexteNormalise = normalizeContexte(contexte);
  const foyerCalcule = await getFoyerPersonne(personneId);

  if (!foyerCalcule) {
    throw businessError("Personne introuvable", "FOYER_PERSONNE_NOT_FOUND");
  }

  if (contexteNormalise === "ORIGINE") {
    const foyerOrigine = foyerCalcule.foyer_origine;
    if (foyerOrigine?.statut !== "COMPLET" || foyerOrigine.parents.length !== 2) {
      throw businessError(
        "Le foyer d'origine n'est pas suffisamment établi pour être persisté",
        "FOYER_NOT_RESOLVABLE",
      );
    }
    return getOrCreateFoyer({
      typeFoyer: "COUPLE",
      idPersonne1: foyerOrigine.parents[0].id,
      idPersonne2: foyerOrigine.parents[1].id,
    });
  }

  const foyerForme = foyerCalcule.foyer_forme;
  if (foyerForme?.statut !== "COMPLET" || !foyerForme.conjoint?.id) {
    throw businessError(
      "Le foyer formé n'est pas suffisamment établi pour être persisté",
      "FOYER_NOT_RESOLVABLE",
    );
  }

  return getOrCreateFoyer({
    typeFoyer: "COUPLE",
    idPersonne1: foyerCalcule.personne.id,
    idPersonne2: foyerForme.conjoint.id,
  });
}

export async function getPersistentFoyerByPersonne(idPersonne) {
  const personneId = normalizePersonneId(idPersonne, 1);
  const personneResult = await database.query(
    "SELECT id FROM personne WHERE id = $1",
    [personneId],
  );
  if (!personneResult.rows[0]) {
    throw businessError("Personne introuvable", "FOYER_PERSONNE_NOT_FOUND");
  }

  const result = await database.query(
    `
      SELECT
        f.id,
        f.type_foyer,
        f.statut,
        f.created_at,
        f.updated_at,
        json_build_object('id', p1.id, 'nom', p1.nom, 'prenom', p1.prenom) AS personne_1,
        CASE WHEN p2.id IS NULL THEN NULL
          ELSE json_build_object('id', p2.id, 'nom', p2.nom, 'prenom', p2.prenom)
        END AS personne_2
      FROM foyer f
      JOIN personne p1 ON p1.id = f.id_personne_1
      LEFT JOIN personne p2 ON p2.id = f.id_personne_2
      WHERE f.statut = 'ACTIF'
        AND (f.id_personne_1 = $1 OR f.id_personne_2 = $1)
      ORDER BY f.created_at ASC, f.id ASC
    `,
    [personneId],
  );

  if (result.rows.length > 1) {
    throw businessError(
      "Plusieurs foyers actifs correspondent à cette personne",
      "FOYER_PERSISTENT_AMBIGUOUS",
    );
  }

  return result.rows[0] ?? null;
}