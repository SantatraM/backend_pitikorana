import database from "../config/db.js";
import TypeElement from "../models/TypeElement.js";

export async function getAllTypesElement() {
  const result = await database.query(
    `SELECT id, libelle FROM type_element ORDER BY libelle ASC`,
  );

  return result.rows.map(
    (row) =>
      new TypeElement({
        id: row.id,
        libelle: row.libelle,
      }),
  );
}
