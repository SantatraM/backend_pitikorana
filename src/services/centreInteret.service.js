import database from "../config/db.js";
import CentreInteret from "../models/CentreInteret.js";
import CentreInteretTraduction from "../models/CentreInteretTraduction.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const centresSelect = `
  SELECT
    ci.id AS id_centre_interet,
    cit.id AS id_traduction,
    cit.id_langue,
    l.code AS code_langue,
    l.nom AS nom_langue,
    cit.libelle
  FROM centre_interet ci
  LEFT JOIN centre_interet_traduction cit
    ON cit.id_centre_interet = ci.id
  LEFT JOIN langue l ON l.id = cit.id_langue
`;

function rowsToCentresInteret(rows) {
  const centres = new Map();
  for (const row of rows) {
    if (!centres.has(row.id_centre_interet)) {
      centres.set(
        row.id_centre_interet,
        new CentreInteret({ id: row.id_centre_interet, traductions: [] }),
      );
    }
    if (row.id_traduction) {
      centres.get(row.id_centre_interet).traductions.push(
        new CentreInteretTraduction({
          id: row.id_traduction,
          id_centre_interet: row.id_centre_interet,
          id_langue: row.id_langue,
          code_langue: row.code_langue,
          nom_langue: row.nom_langue,
          libelle: row.libelle,
        }),
      );
    }
  }
  return [...centres.values()];
}

async function validateLangues(traductions) {
  const ids = traductions.map((traduction) => traduction.id_langue);
  const result = await database.query(
    "SELECT id FROM langue WHERE id = ANY($1::uuid[])",
    [ids],
  );
  if (result.rows.length !== ids.length) {
    throw businessError("Une langue sélectionnée n'existe pas", "LANGUE_NOT_FOUND");
  }
}

async function insertTraductions(idCentreInteret, traductions) {
  for (const traduction of traductions) {
    await database.query(
      `INSERT INTO centre_interet_traduction (
        id_centre_interet, id_langue, libelle
      ) VALUES ($1, $2, $3)`,
      [idCentreInteret, traduction.id_langue, traduction.libelle],
    );
  }
}

export async function getAllCentresInteret() {
  const result = await database.query(`${centresSelect} ORDER BY ci.id ASC, l.code ASC`);
  return rowsToCentresInteret(result.rows);
}

export async function getCentreInteretById(id) {
  const result = await database.query(
    `${centresSelect} WHERE ci.id = $1 ORDER BY l.code ASC`,
    [id],
  );
  return rowsToCentresInteret(result.rows)[0] ?? null;
}

export async function getCentresInteretByLangue(code) {
  const result = await database.query(
    `SELECT ci.id, cit.libelle
    FROM centre_interet ci
    JOIN centre_interet_traduction cit ON cit.id_centre_interet = ci.id
    JOIN langue l ON l.id = cit.id_langue
    WHERE l.code = $1
    ORDER BY cit.libelle ASC`,
    [code],
  );
  return result.rows;
}

export async function createCentreInteret(centre) {
  return database.transaction(async () => {
    await validateLangues(centre.traductions);
    const result = await database.query("INSERT INTO centre_interet DEFAULT VALUES RETURNING id");
    const idCentreInteret = result.rows[0].id;
    await insertTraductions(idCentreInteret, centre.traductions);
    return getCentreInteretById(idCentreInteret);
  });
}

export async function updateCentreInteret(id, centre) {
  return database.transaction(async () => {
    const existing = await database.query(
      "SELECT id FROM centre_interet WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!existing.rows[0]) return null;
    await validateLangues(centre.traductions);
    await database.query(
      "DELETE FROM centre_interet_traduction WHERE id_centre_interet = $1",
      [id],
    );
    await insertTraductions(id, centre.traductions);
    return getCentreInteretById(id);
  });
}

export async function deleteCentreInteret(id) {
  return database.transaction(async () => {
    const centre = await getCentreInteretById(id);
    if (!centre) return null;
    await database.query("DELETE FROM centre_interet WHERE id = $1", [id]);
    return centre;
  });
}
