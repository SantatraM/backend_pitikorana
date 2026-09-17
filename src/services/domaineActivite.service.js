import database from "../config/db.js";
import DomaineActivite from "../models/DomaineActivite.js";
import DomaineActiviteTraduction from "../models/DomaineActiviteTraduction.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const domainesSelect = `
  SELECT
    d.id AS id_domaine_activite,
    dt.id AS id_traduction,
    dt.id_langue,
    l.code AS code_langue,
    l.nom AS nom_langue,
    dt.libelle
  FROM domaine_activite d
  LEFT JOIN domaine_activite_traduction dt
    ON dt.id_domaine_activite = d.id
  LEFT JOIN langue l ON l.id = dt.id_langue
`;

function rowsToDomaines(rows) {
  const domaines = new Map();

  for (const row of rows) {
    if (!domaines.has(row.id_domaine_activite)) {
      domaines.set(
        row.id_domaine_activite,
        new DomaineActivite({ id: row.id_domaine_activite, traductions: [] }),
      );
    }

    if (row.id_traduction) {
      domaines.get(row.id_domaine_activite).traductions.push(
        new DomaineActiviteTraduction({
          id: row.id_traduction,
          id_domaine_activite: row.id_domaine_activite,
          id_langue: row.id_langue,
          code_langue: row.code_langue,
          nom_langue: row.nom_langue,
          libelle: row.libelle,
        }),
      );
    }
  }

  return [...domaines.values()];
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

async function insertTraductions(idDomaineActivite, traductions) {
  for (const traduction of traductions) {
    await database.query(
      `INSERT INTO domaine_activite_traduction (
        id_domaine_activite,
        id_langue,
        libelle
      )
      VALUES ($1, $2, $3)`,
      [idDomaineActivite, traduction.id_langue, traduction.libelle],
    );
  }
}

export async function getAllDomainesActivite() {
  const result = await database.query(
    `${domainesSelect} ORDER BY d.id ASC, l.code ASC`,
  );
  return rowsToDomaines(result.rows);
}

export async function getDomaineActiviteById(id) {
  const result = await database.query(
    `${domainesSelect} WHERE d.id = $1 ORDER BY l.code ASC`,
    [id],
  );
  return rowsToDomaines(result.rows)[0] ?? null;
}

export async function getDomainesActiviteByLangue(code) {
  const result = await database.query(
    `SELECT d.id, dt.libelle
    FROM domaine_activite d
    JOIN domaine_activite_traduction dt
      ON dt.id_domaine_activite = d.id
    JOIN langue l ON l.id = dt.id_langue
    WHERE l.code = $1
    ORDER BY dt.libelle ASC`,
    [code],
  );
  return result.rows;
}

export async function createDomaineActivite(domaine) {
  return database.transaction(async () => {
    await validateLangues(domaine.traductions);

    const result = await database.query(
      "INSERT INTO domaine_activite DEFAULT VALUES RETURNING id",
    );
    const idDomaineActivite = result.rows[0].id;

    await insertTraductions(idDomaineActivite, domaine.traductions);
    return getDomaineActiviteById(idDomaineActivite);
  });
}

export async function updateDomaineActivite(id, domaine) {
  return database.transaction(async () => {
    const existing = await database.query(
      "SELECT id FROM domaine_activite WHERE id = $1 FOR UPDATE",
      [id],
    );

    if (!existing.rows[0]) {
      return null;
    }

    await validateLangues(domaine.traductions);
    await database.query(
      "DELETE FROM domaine_activite_traduction WHERE id_domaine_activite = $1",
      [id],
    );
    await insertTraductions(id, domaine.traductions);

    return getDomaineActiviteById(id);
  });
}

export async function deleteDomaineActivite(id) {
  return database.transaction(async () => {
    const domaine = await getDomaineActiviteById(id);
    if (!domaine) {
      return null;
    }

    await database.query("DELETE FROM domaine_activite WHERE id = $1", [id]);
    return domaine;
  });
}
