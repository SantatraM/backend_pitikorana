import database from "../config/db.js";
import Competence from "../models/Competence.js";
import CompetenceTraduction from "../models/CompetenceTraduction.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const competencesSelect = `
  SELECT
    c.id AS id_competence,
    ct.id AS id_traduction,
    ct.id_langue,
    l.code AS code_langue,
    l.nom AS nom_langue,
    ct.libelle
  FROM competence c
  LEFT JOIN competence_traduction ct ON ct.id_competence = c.id
  LEFT JOIN langue l ON l.id = ct.id_langue
`;

function rowsToCompetences(rows) {
  const competences = new Map();

  for (const row of rows) {
    if (!competences.has(row.id_competence)) {
      competences.set(
        row.id_competence,
        new Competence({ id: row.id_competence, traductions: [] }),
      );
    }

    if (row.id_traduction) {
      competences.get(row.id_competence).traductions.push(
        new CompetenceTraduction({
          id: row.id_traduction,
          id_competence: row.id_competence,
          id_langue: row.id_langue,
          code_langue: row.code_langue,
          nom_langue: row.nom_langue,
          libelle: row.libelle,
        }),
      );
    }
  }

  return [...competences.values()];
}

async function validateLangues(traductions) {
  const ids = traductions.map((traduction) => traduction.id_langue);
  const result = await database.query(
    "SELECT id FROM langue WHERE id = ANY($1::uuid[])",
    [ids],
  );

  if (result.rows.length !== ids.length) {
    throw businessError(
      "Une langue sélectionnée n'existe pas",
      "LANGUE_NOT_FOUND",
    );
  }
}

async function insertTraductions(idCompetence, traductions) {
  for (const traduction of traductions) {
    await database.query(
      `INSERT INTO competence_traduction (id_competence, id_langue, libelle)
      VALUES ($1, $2, $3)`,
      [idCompetence, traduction.id_langue, traduction.libelle],
    );
  }
}

export async function getAllCompetences() {
  const result = await database.query(
    `${competencesSelect} ORDER BY c.id ASC, l.code ASC`,
  );
  return rowsToCompetences(result.rows);
}

export async function getCompetenceById(id) {
  const result = await database.query(
    `${competencesSelect} WHERE c.id = $1 ORDER BY l.code ASC`,
    [id],
  );
  return rowsToCompetences(result.rows)[0] ?? null;
}

export async function getCompetencesByLangue(code) {
  const result = await database.query(
    `SELECT c.id, ct.libelle
    FROM competence c
    JOIN competence_traduction ct ON ct.id_competence = c.id
    JOIN langue l ON l.id = ct.id_langue
    WHERE l.code = $1
    ORDER BY ct.libelle ASC`,
    [code],
  );
  return result.rows;
}

export async function createCompetence(competence) {
  return database.transaction(async () => {
    await validateLangues(competence.traductions);

    const result = await database.query(
      "INSERT INTO competence DEFAULT VALUES RETURNING id",
    );
    const idCompetence = result.rows[0].id;

    await insertTraductions(idCompetence, competence.traductions);
    return getCompetenceById(idCompetence);
  });
}

export async function updateCompetence(id, competence) {
  return database.transaction(async () => {
    const existing = await database.query(
      "SELECT id FROM competence WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!existing.rows[0]) return null;

    await validateLangues(competence.traductions);
    await database.query(
      "DELETE FROM competence_traduction WHERE id_competence = $1",
      [id],
    );
    await insertTraductions(id, competence.traductions);

    return getCompetenceById(id);
  });
}

export async function deleteCompetence(id) {
  return database.transaction(async () => {
    const competence = await getCompetenceById(id);
    if (!competence) return null;

    await database.query("DELETE FROM competence WHERE id = $1", [id]);
    return competence;
  });
}
