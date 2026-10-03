import database from "../config/db.js";
import { getFoyerFormePersonne, getFoyerPersonne } from "./personne.service.js";

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

async function getOrReactivateCouple(idPersonne1, idPersonne2) {
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

  const reactivated = await database.query(
    `UPDATE foyer
    SET statut = 'ACTIF', updated_at = now()
    WHERE type_foyer = 'COUPLE'
      AND id_personne_1 = $1
      AND id_personne_2 = $2
      AND statut = 'CLOTURE'
    RETURNING id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at`,
    [idPersonne1, idPersonne2],
  );
  if (reactivated.rows[0]) return reactivated.rows[0];

  const existing = await database.query(
    `SELECT id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at
    FROM foyer
    WHERE type_foyer = 'COUPLE'
      AND id_personne_1 = $1
      AND id_personne_2 = $2
      AND statut = 'ACTIF'`,
    [idPersonne1, idPersonne2],
  );
  return existing.rows[0];
}

async function getOrReactivateMonoparental(idPersonne1) {
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

  const reactivated = await database.query(
    `UPDATE foyer
    SET statut = 'ACTIF', updated_at = now()
    WHERE type_foyer = 'MONOPARENTAL'
      AND id_personne_1 = $1
      AND statut = 'CLOTURE'
    RETURNING id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at`,
    [idPersonne1],
  );
  if (reactivated.rows[0]) return reactivated.rows[0];

  const existing = await database.query(
    `SELECT id, id_personne_1, id_personne_2, type_foyer, statut, created_at, updated_at
    FROM foyer
    WHERE type_foyer = 'MONOPARENTAL'
      AND id_personne_1 = $1
      AND statut = 'ACTIF'`,
    [idPersonne1],
  );
  return existing.rows[0];
}

async function getOrCreateFoyerInTransaction({ typeFoyer, idPersonne1, idPersonne2 = null } = {}) {
  const type = normalizeTypeFoyer(typeFoyer);
  const personne1 = normalizePersonneId(idPersonne1, 1);

  if (type === "MONOPARENTAL") {
    if (idPersonne2 !== null && idPersonne2 !== undefined) {
      throw businessError("Un foyer monoparental ne peut avoir qu'une personne fondatrice", "FOYER_STRUCTURE_INVALID");
    }
    await verifyPersonnesExist(personne1);
    return getOrReactivateMonoparental(personne1);
  }

  const personne2 = normalizePersonneId(idPersonne2, 2);
  if (personne1 === personne2) {
    throw businessError("Un foyer de couple nécessite deux personnes distinctes", "FOYER_PERSONNES_IDENTIQUES");
  }

  const couple = await canonicalizeCoupleIds(personne1, personne2);
  await verifyPersonnesExist(couple.id_personne_1, couple.id_personne_2);
  return getOrReactivateCouple(couple.id_personne_1, couple.id_personne_2);
}

export async function getOrCreateFoyer(options = {}) {
  return database.transaction(() => getOrCreateFoyerInTransaction(options));
}

export async function getFoyerFormePreview(personneId) {
  const foyerForme = await getFoyerFormePersonne(personneId);
  if (!foyerForme) return null;

  return {
    type_foyer: foyerForme.type_foyer,
    personnes: foyerForme.conjoint
      ? [foyerForme.personne, foyerForme.conjoint]
      : [foyerForme.personne],
  };
}

async function closeOtherActiveFoyersForPersonne(personneId, idFoyerConserve) {
  await database.query(
    `UPDATE foyer
    SET statut = 'CLOTURE', updated_at = now()
    WHERE statut = 'ACTIF'
      AND id <> $2
      AND (id_personne_1 = $1 OR id_personne_2 = $1)`,
    [personneId, idFoyerConserve],
  );
}

export async function resolveOrCreatePersistentFoyerInTransaction({ personneId } = {}) {
  const personne = normalizePersonneId(personneId, 1);
  const foyerForme = await getFoyerFormePersonne(personne);
  if (!foyerForme) {
    throw businessError(
      "Cette personne ne possède pas de foyer formé résoluble.",
      "FOYER_NOT_RESOLVABLE",
    );
  }

  const foyer = foyerForme.type_foyer === "COUPLE"
    ? await getOrCreateFoyerInTransaction({
      typeFoyer: "COUPLE",
      idPersonne1: foyerForme.personne.id,
      idPersonne2: foyerForme.conjoint.id,
    })
    : await getOrCreateFoyerInTransaction({
      typeFoyer: "MONOPARENTAL",
      idPersonne1: foyerForme.personne.id,
    });

  const personnesDuFoyer = [
    foyerForme.personne.id,
    ...(foyerForme.conjoint ? [foyerForme.conjoint.id] : []),
  ];
  const personnesOrdonnees = [...new Set(personnesDuFoyer)].sort();
  for (const idPersonne of personnesOrdonnees) {
    await closeOtherActiveFoyersForPersonne(idPersonne, foyer.id);
  }
  return foyer;
}

function normalizeContexte(value) {
  if (!["ORIGINE", "FORME"].includes(value)) {
    throw businessError("Le contexte de foyer est invalide", "FOYER_CONTEXT_INVALID");
  }
  return value;
}

export async function resolveOrCreatePersistentFoyer({ personneId, contexte } = {}) {
  const contexteNormalise = normalizeContexte(contexte);

  if (contexteNormalise === "FORME") {
    return database.transaction(() => resolveOrCreatePersistentFoyerInTransaction({ personneId }));
  }

  const foyerCalcule = await getFoyerPersonne(personneId);
  if (!foyerCalcule) {
    throw businessError("Personne introuvable", "FOYER_PERSONNE_NOT_FOUND");
  }

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