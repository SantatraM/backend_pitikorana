import database from "../config/db.js";
import PersonneCompetence from "../models/PersonneCompetence.js";

const associationFields = ["id_personne", "id_competence", "partageable"];

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapPersonneCompetenceRow(row) {
  return new PersonneCompetence({
    id: row.id,
    id_personne: row.id_personne,
    id_competence: row.id_competence,
    competence: row.competence,
    partageable: row.partageable,
  });
}

async function getPersonneCompetenceRawById(id) {
  const result = await database.query(
    "SELECT * FROM personne_competence WHERE id = $1",
    [id],
  );
  return result.rows[0] ? new PersonneCompetence(result.rows[0]) : null;
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

async function validateCompetence(idCompetence) {
  const result = await database.query(
    "SELECT id FROM competence WHERE id = $1",
    [idCompetence],
  );
  if (!result.rows[0]) {
    throw businessError("Compétence introuvable", "COMPETENCE_NOT_FOUND");
  }
}

async function validateUniqueAssociation(
  idPersonne,
  idCompetence,
  excludedAssociationId = null,
) {
  const result = excludedAssociationId
    ? await database.query(
        `SELECT id FROM personne_competence
        WHERE id_personne = $1 AND id_competence = $2 AND id <> $3`,
        [idPersonne, idCompetence, excludedAssociationId],
      )
    : await database.query(
        `SELECT id FROM personne_competence
        WHERE id_personne = $1 AND id_competence = $2`,
        [idPersonne, idCompetence],
      );

  if (result.rows[0]) {
    throw businessError(
      "Cette compétence est déjà enregistrée pour cette personne",
      "COMPETENCE_ALREADY_EXISTS",
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
  return new PersonneCompetence(data);
}

export async function getAllPersonnesCompetences(lang = "fr") {
  const result = await database.query(
    `SELECT * FROM v_competence_personne
    WHERE code_langue = $1
    ORDER BY id_personne ASC, competence ASC`,
    [lang],
  );
  return result.rows.map(mapPersonneCompetenceRow);
}

export async function getPersonneCompetenceById(id, lang = "fr") {
  const result = await database.query(
    `SELECT * FROM v_competence_personne
    WHERE id = $1 AND code_langue = $2`,
    [id, lang],
  );
  return result.rows[0] ? mapPersonneCompetenceRow(result.rows[0]) : null;
}

export async function getPersonnesCompetencesByPersonne(
  idPersonne,
  lang = "fr",
) {
  await validatePersonne(idPersonne);
  const result = await database.query(
    `SELECT * FROM v_competence_personne
    WHERE id_personne = $1 AND code_langue = $2
    ORDER BY competence ASC`,
    [idPersonne, lang],
  );
  return result.rows.map(mapPersonneCompetenceRow);
}

export async function getCompetencesPartageablesByPersonne(
  idPersonne,
  lang = "fr",
) {
  await validatePersonne(idPersonne);
  const result = await database.query(
    `SELECT * FROM v_competence_personne
    WHERE id_personne = $1 AND code_langue = $2 AND partageable = true
    ORDER BY competence ASC`,
    [idPersonne, lang],
  );
  return result.rows.map(mapPersonneCompetenceRow);
}

export async function createPersonneCompetence(association, lang = "fr") {
  await validatePersonne(association.id_personne);
  await validateCompetence(association.id_competence);
  await validateUniqueAssociation(
    association.id_personne,
    association.id_competence,
  );

  const result = await database.query(
    `INSERT INTO personne_competence (id_personne, id_competence, partageable)
    VALUES ($1, $2, $3)
    RETURNING id`,
    associationFields.map((field) => association[field]),
  );
  return getPersonneCompetenceById(result.rows[0].id, lang);
}

export async function updatePersonneCompetence(id, changes, lang = "fr") {
  const existing = await getPersonneCompetenceRawById(id);
  if (!existing) return null;

  const association = mergeAssociation(existing, changes);
  await validateCompetence(association.id_competence);
  await validateUniqueAssociation(
    existing.id_personne,
    association.id_competence,
    id,
  );

  await database.query(
    `UPDATE personne_competence
    SET id_competence = $1, partageable = $2
    WHERE id = $3`,
    [association.id_competence, association.partageable, id],
  );
  return getPersonneCompetenceById(id, lang);
}

export async function deletePersonneCompetence(id) {
  const association = await getPersonneCompetenceRawById(id);
  if (!association) return null;

  await database.query("DELETE FROM personne_competence WHERE id = $1", [id]);
  return association;
}
