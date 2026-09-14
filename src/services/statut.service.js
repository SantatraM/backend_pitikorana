import database from "../config/db.js";
import Statut from "../models/Statut.js";

function group(rows) {
  const values = new Map();
  for (const row of rows) {
    if (!values.has(row.id_statut))
      values.set(
        row.id_statut,
        new Statut({ id: row.id_statut, traductions: [] }),
      );
    if (row.id_traduction)
      values
        .get(row.id_statut)
        .traductions.push({
          id: row.id_traduction,
          id_statut: row.id_statut,
          id_langue: row.id_langue,
          libelle: row.libelle,
          langue: {
            id: row.id_langue,
            code: row.code_langue,
            nom: row.nom_langue,
          },
        });
  }
  return [...values.values()];
}
const select = `SELECT s.id AS id_statut, st.id AS id_traduction, st.libelle, l.id AS id_langue, l.code AS code_langue, l.nom AS nom_langue FROM statut s LEFT JOIN statut_traduction st ON st.id_statut = s.id LEFT JOIN langue l ON l.id = st.id_langue`;
export async function getAllStatuts() {
  return group((await database.query(`${select} ORDER BY s.id, l.code`)).rows);
}
export async function getStatutsByLangue(code) {
  return (
    await database.query(
      `SELECT s.id, st.libelle FROM statut s JOIN statut_traduction st ON st.id_statut = s.id JOIN langue l ON l.id = st.id_langue WHERE l.code = $1 ORDER BY st.libelle ASC`,
      [code],
    )
  ).rows;
}
