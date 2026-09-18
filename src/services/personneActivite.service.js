import database from "../config/db.js";
import PersonneActivite from "../models/PersonneActivite.js";
import { assertCanManagePersonne } from "./personneAuthorization.service.js";

const associationFields = [
  "id_personne",
  "id_activite",
  "lieu_travail",
  "etude_en_cours",
  "formations",
  "experience_anterieur",
  "diplome_ou_apprentissage",
];

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapPersonneActiviteRow(row) {
  return new PersonneActivite({
    id: row.id,
    id_personne: row.id_personne,
    id_activite: row.id_activite,
    id_domaine_activite: row.id_domaine_activite,
    activite: row.activite,
    domaine_activite: row.domaine_activite,
    lieu_travail: row.lieu_travail,
    etude_en_cours: row.etude_en_cours,
    formations: row.formations,
    experience_anterieur: row.experience_anterieur,
    diplome_ou_apprentissage: row.diplome_ou_apprentissage,
  });
}

async function getPersonneActiviteRawById(id) {
  const result = await database.query(
    "SELECT * FROM personne_activite WHERE id = $1",
    [id],
  );

  return result.rows[0] ? new PersonneActivite(result.rows[0]) : null;
}

async function validatePersonne(idPersonne) {
  const result = await database.query(
    "SELECT id FROM personne WHERE id = $1",
    [idPersonne],
  );

  if (!result.rows[0]) {
    throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
  }
}

async function validateActivite(idActivite) {
  const result = await database.query(
    "SELECT id FROM activite WHERE id = $1",
    [idActivite],
  );

  if (!result.rows[0]) {
    throw businessError("Activité introuvable", "ACTIVITE_NOT_FOUND");
  }
}

async function validateUniqueAssociation(
  idPersonne,
  idActivite,
  excludedAssociationId = null,
) {
  const result = excludedAssociationId
    ? await database.query(
        `SELECT id FROM personne_activite
        WHERE id_personne = $1 AND id_activite = $2 AND id <> $3`,
        [idPersonne, idActivite, excludedAssociationId],
      )
    : await database.query(
        `SELECT id FROM personne_activite
        WHERE id_personne = $1 AND id_activite = $2`,
        [idPersonne, idActivite],
      );

  if (result.rows[0]) {
    throw businessError(
      "Cette activité est déjà enregistrée pour cette personne",
      "ACTIVITE_ALREADY_EXISTS",
    );
  }
}

function mergeAssociation(existing, changes) {
  const data = { id: existing.id };

  for (const field of associationFields) {
    data[field] = Object.prototype.hasOwnProperty.call(changes, field)
      ? changes[field]
      : existing[field];
  }

  return new PersonneActivite(data);
}

export async function getAllPersonnesActivites(lang = "fr") {
  const result = await database.query(
    `SELECT * FROM v_personne_activite
    WHERE code_langue = $1
    ORDER BY id_personne ASC, activite ASC`,
    [lang],
  );
  return result.rows.map(mapPersonneActiviteRow);
}

export async function getPersonneActiviteById(id, lang = "fr") {
  const result = await database.query(
    `SELECT * FROM v_personne_activite
    WHERE id = $1 AND code_langue = $2`,
    [id, lang],
  );
  return result.rows[0] ? mapPersonneActiviteRow(result.rows[0]) : null;
}

export async function getPersonnesActivitesByPersonne(idPersonne, lang = "fr") {
  await validatePersonne(idPersonne);

  const result = await database.query(
    `SELECT * FROM v_personne_activite
    WHERE id_personne = $1 AND code_langue = $2
    ORDER BY activite ASC`,
    [idPersonne, lang],
  );
  return result.rows.map(mapPersonneActiviteRow);
}

export async function createPersonneActivite(association, lang = "fr", auth) {
  await assertCanManagePersonne(association.id_personne, auth);
  await validateActivite(association.id_activite);
  await validateUniqueAssociation(
    association.id_personne,
    association.id_activite,
  );

  const result = await database.query(
    `INSERT INTO personne_activite (
      id_personne,
      id_activite,
      lieu_travail,
      etude_en_cours,
      formations,
      experience_anterieur,
      diplome_ou_apprentissage
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    associationFields.map((field) => association[field]),
  );

  return getPersonneActiviteById(result.rows[0].id, lang);
}

export async function updatePersonneActivite(id, changes, lang = "fr", auth) {
  const existing = await getPersonneActiviteRawById(id);
  if (!existing) return null;

  await assertCanManagePersonne(existing.id_personne, auth);

  const association = mergeAssociation(existing, changes);
  await validateActivite(association.id_activite);
  await validateUniqueAssociation(
    existing.id_personne,
    association.id_activite,
    id,
  );

  await database.query(
    `UPDATE personne_activite
    SET
      id_activite = $1,
      lieu_travail = $2,
      etude_en_cours = $3,
      formations = $4,
      experience_anterieur = $5,
      diplome_ou_apprentissage = $6
    WHERE id = $7`,
    [
      association.id_activite,
      association.lieu_travail,
      association.etude_en_cours,
      association.formations,
      association.experience_anterieur,
      association.diplome_ou_apprentissage,
      id,
    ],
  );

  return getPersonneActiviteById(id, lang);
}

export async function deletePersonneActivite(id, auth) {
  const association = await getPersonneActiviteRawById(id);
  if (!association) return null;

  await assertCanManagePersonne(association.id_personne, auth);

  await database.query("DELETE FROM personne_activite WHERE id = $1", [id]);
  return association;
}
