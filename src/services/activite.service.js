import database from "../config/db.js";
import Activite from "../models/Activite.js";
import ActiviteTraduction from "../models/ActiviteTraduction.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const activitesSelect = `
  SELECT
    a.id AS id_activite,
    a.id_domaine_activite,
    at.id AS id_traduction,
    at.id_langue,
    l.code AS code_langue,
    l.nom AS nom_langue,
    at.libelle
  FROM activite a
  LEFT JOIN activite_traduction at ON at.id_activite = a.id
  LEFT JOIN langue l ON l.id = at.id_langue
`;

function rowsToActivites(rows) {
  const activites = new Map();

  for (const row of rows) {
    if (!activites.has(row.id_activite)) {
      activites.set(
        row.id_activite,
        new Activite({
          id: row.id_activite,
          id_domaine_activite: row.id_domaine_activite,
          traductions: [],
        }),
      );
    }

    if (row.id_traduction) {
      activites.get(row.id_activite).traductions.push(
        new ActiviteTraduction({
          id: row.id_traduction,
          id_activite: row.id_activite,
          id_langue: row.id_langue,
          code_langue: row.code_langue,
          nom_langue: row.nom_langue,
          libelle: row.libelle,
        }),
      );
    }
  }

  return [...activites.values()];
}

async function validateDomaine(idDomaineActivite) {
  if (idDomaineActivite === null) return;

  const result = await database.query(
    "SELECT id FROM domaine_activite WHERE id = $1",
    [idDomaineActivite],
  );

  if (!result.rows[0]) {
    throw businessError(
      "Domaine d'activité introuvable",
      "DOMAINE_NOT_FOUND",
    );
  }
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

async function insertTraductions(idActivite, traductions) {
  for (const traduction of traductions) {
    await database.query(
      `INSERT INTO activite_traduction (id_activite, id_langue, libelle)
      VALUES ($1, $2, $3)`,
      [idActivite, traduction.id_langue, traduction.libelle],
    );
  }
}

export async function getAllActivites() {
  const result = await database.query(
    `${activitesSelect} ORDER BY a.id ASC, l.code ASC`,
  );
  return rowsToActivites(result.rows);
}

export async function getActiviteById(id) {
  const result = await database.query(
    `${activitesSelect} WHERE a.id = $1 ORDER BY l.code ASC`,
    [id],
  );
  return rowsToActivites(result.rows)[0] ?? null;
}

export async function getActivitesByLangue(code) {
  const result = await database.query(
    `SELECT a.id, a.id_domaine_activite, at.libelle
    FROM activite a
    JOIN activite_traduction at ON at.id_activite = a.id
    JOIN langue l ON l.id = at.id_langue
    WHERE l.code = $1
    ORDER BY at.libelle ASC`,
    [code],
  );
  return result.rows;
}

export async function getActivitesByDomaine(idDomaineActivite) {
  await validateDomaine(idDomaineActivite);
  const result = await database.query(
    `${activitesSelect}
    WHERE a.id_domaine_activite = $1
    ORDER BY a.id ASC, l.code ASC`,
    [idDomaineActivite],
  );
  return rowsToActivites(result.rows);
}

export async function getActivitesByDomaineAndLangue(idDomaineActivite, code) {
  await validateDomaine(idDomaineActivite);
  const result = await database.query(
    `SELECT a.id, a.id_domaine_activite, at.libelle
    FROM activite a
    JOIN activite_traduction at ON at.id_activite = a.id
    JOIN langue l ON l.id = at.id_langue
    WHERE a.id_domaine_activite = $1 AND l.code = $2
    ORDER BY at.libelle ASC`,
    [idDomaineActivite, code],
  );
  return result.rows;
}

export async function createActivite(activite) {
  return database.transaction(async () => {
    await validateDomaine(activite.id_domaine_activite);
    await validateLangues(activite.traductions);

    const result = await database.query(
      "INSERT INTO activite (id_domaine_activite) VALUES ($1) RETURNING id",
      [activite.id_domaine_activite],
    );
    const idActivite = result.rows[0].id;

    await insertTraductions(idActivite, activite.traductions);
    return getActiviteById(idActivite);
  });
}

export async function updateActivite(id, activite) {
  return database.transaction(async () => {
    const existing = await database.query(
      "SELECT id FROM activite WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!existing.rows[0]) return null;

    await validateDomaine(activite.id_domaine_activite);
    await validateLangues(activite.traductions);
    await database.query(
      "UPDATE activite SET id_domaine_activite = $1 WHERE id = $2",
      [activite.id_domaine_activite, id],
    );
    await database.query(
      "DELETE FROM activite_traduction WHERE id_activite = $1",
      [id],
    );
    await insertTraductions(id, activite.traductions);

    return getActiviteById(id);
  });
}

export async function deleteActivite(id) {
  return database.transaction(async () => {
    const activite = await getActiviteById(id);
    if (!activite) return null;

    await database.query("DELETE FROM activite WHERE id = $1", [id]);
    return activite;
  });
}
