import database from "../config/db.js";
import LienAvecFalimanjaka from "../models/LienAvecFalimanjaka.js";

function rowsToLiens(rows) {
  const liens = new Map();

  for (const row of rows) {
    if (!liens.has(row.id_lien)) {
      liens.set(
        row.id_lien,
        new LienAvecFalimanjaka({
          id: row.id_lien,
          traductions: [],
        }),
      );
    }

    if (row.id_traduction) {
      liens.get(row.id_lien).traductions.push({
        id: row.id_traduction,
        id_lien: row.id_lien,
        id_langue: row.id_langue,
        libelle: row.libelle,
        langue: {
          id: row.id_langue,
          code: row.code_langue,
          nom: row.nom_langue,
        },
      });
    }
  }

  return [...liens.values()];
}

const liensSelect = `
  SELECT
    l.id AS id_lien,
    t.id AS id_traduction,
    t.libelle,
    langue.id AS id_langue,
    langue.code AS code_langue,
    langue.nom AS nom_langue
  FROM lien_avec_falimanjaka l
  LEFT JOIN lien_avec_falimanjaka_traduction t ON t.id_lien = l.id
  LEFT JOIN langue ON langue.id = t.id_langue
`;

export async function getAllLiens() {
  const result = await database.query(
    `${liensSelect} ORDER BY l.id, langue.code`,
  );
  return rowsToLiens(result.rows);
}

export async function getLienById(id) {
  const result = await database.query(
    `${liensSelect} WHERE l.id = $1 ORDER BY langue.code`,
    [id],
  );

  return rowsToLiens(result.rows)[0] ?? null;
}

export async function getLiensByLangue(code) {
  const result = await database.query(
    `
      ${liensSelect}
      WHERE langue.code = $1
      ORDER BY l.id
    `,
    [code],
  );

  return rowsToLiens(result.rows);
}

export async function createLien(lien) {
  return database.transaction(async () => {
    const lienResult = await database.query(
      `INSERT INTO lien_avec_falimanjaka DEFAULT VALUES RETURNING id`,
    );
    const idLien = lienResult.rows[0].id;

    for (const traduction of lien.traductions) {
      await database.query(
        `
          INSERT INTO lien_avec_falimanjaka_traduction (id_lien, id_langue, libelle)
          VALUES ($1, $2, $3)
        `,
        [idLien, traduction.id_langue, traduction.libelle],
      );
    }

    return getLienById(idLien);
  });
}

export async function updateLien(id, lien) {
  return database.transaction(async () => {
    const exists = await database.query(
      `SELECT id FROM lien_avec_falimanjaka WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if (exists.rows.length === 0) {
      return null;
    }

    for (const traduction of lien.traductions) {
      await database.query(
        `
          INSERT INTO lien_avec_falimanjaka_traduction (id_lien, id_langue, libelle)
          VALUES ($1, $2, $3)
          ON CONFLICT (id_lien, id_langue)
          DO UPDATE SET libelle = EXCLUDED.libelle
        `,
        [id, traduction.id_langue, traduction.libelle],
      );
    }

    return getLienById(id);
  });
}

export async function deleteLien(id) {
  return database.transaction(async () => {
    const lien = await getLienById(id);

    if (!lien) {
      return null;
    }

    await database.query(`DELETE FROM lien_avec_falimanjaka WHERE id = $1`, [
      id,
    ]);

    return lien;
  });
}
