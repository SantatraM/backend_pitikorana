import database from "../config/db.js";
import TypeElement from "../models/TypeElement.js";

export async function getAllTypesElement() {
  const result = await database.query(
    `SELECT id, code, libelle FROM type_element ORDER BY libelle ASC`,
  );

  return result.rows.map(
    (row) =>
      new TypeElement({
        id: row.id,
        code: row.code,
        libelle: row.libelle,
      }),
  );
}
