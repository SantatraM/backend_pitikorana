import database from "../config/db.js";
import Sexe from "../models/Sexe.js";

function group(rows) {
  const values = new Map();
  for (const row of rows) {
    if (!values.has(row.id_sexe))
      values.set(row.id_sexe, new Sexe({ id: row.id_sexe, traductions: [] }));
    if (row.id_traduction)
      values
        .get(row.id_sexe)
        .traductions.push({
          id: row.id_traduction,
          id_sexe: row.id_sexe,
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
const select = `SELECT s.id AS id_sexe, st.id AS id_traduction, st.libelle, l.id AS id_langue, l.code AS code_langue, l.nom AS nom_langue FROM sexe s LEFT JOIN sexe_traduction st ON st.id_sexe = s.id LEFT JOIN langue l ON l.id = st.id_langue`;
export async function getAllSexes() {
  return group((await database.query(`${select} ORDER BY s.id, l.code`)).rows);
}
export async function getSexesByLangue(code) {
  return (
    await database.query(
      `SELECT s.id, st.libelle FROM sexe s JOIN sexe_traduction st ON st.id_sexe = s.id JOIN langue l ON l.id = st.id_langue WHERE l.code = $1 ORDER BY st.libelle ASC`,
      [code],
    )
  ).rows;
}
