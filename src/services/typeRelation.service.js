import database from "../config/db.js";
import TypeRelation from "../models/TypeRelation.js";
import TypeRelationTraduction from "../models/TypeRelationTraduction.js";

const translationsSelect = `
  SELECT
    tr.id AS id_type_relation,
    tr.id_inverse_defaut,
    tr.id_inverse_masculin,
    tr.id_inverse_feminin,
    trt.id AS id_traduction,
    trt.id_langue,
    l.code AS code_langue,
    l.nom AS nom_langue,
    trt.libelle
  FROM type_relation tr
  LEFT JOIN type_relation_traduction trt
    ON trt.id_type_relation = tr.id
  LEFT JOIN langue l
    ON l.id = trt.id_langue
`;

function groupTypesRelation(rows) {
  const typesRelation = new Map();

  for (const row of rows) {
    if (!typesRelation.has(row.id_type_relation)) {
      typesRelation.set(
        row.id_type_relation,
        new TypeRelation({
          id: row.id_type_relation,
          id_inverse_defaut: row.id_inverse_defaut,
          id_inverse_masculin: row.id_inverse_masculin,
          id_inverse_feminin: row.id_inverse_feminin,
          traductions: [],
        }),
      );
    }

    if (row.id_traduction) {
      typesRelation.get(row.id_type_relation).traductions.push(
        new TypeRelationTraduction({
          id: row.id_traduction,
          id_type_relation: row.id_type_relation,
          id_langue: row.id_langue,
          code_langue: row.code_langue,
          nom_langue: row.nom_langue,
          libelle: row.libelle,
        }),
      );
    }
  }

  return [...typesRelation.values()];
}

export async function getAllTypesRelation() {
  const result = await database.query(
    `${translationsSelect} ORDER BY tr.id ASC, l.code ASC`,
  );
  return groupTypesRelation(result.rows);
}

export async function getTypesRelationByLangue(code) {
  const result = await database.query(
    `SELECT
      tr.id AS id_type_relation,
      tr.id_inverse_defaut,
      tr.id_inverse_masculin,
      tr.id_inverse_feminin,
      trt.id AS id_traduction,
      trt.id_langue,
      l.code AS code_langue,
      l.nom AS nom_langue,
      trt.libelle
    FROM type_relation tr
    JOIN type_relation_traduction trt
      ON trt.id_type_relation = tr.id
    JOIN langue l
      ON l.id = trt.id_langue
    WHERE l.code = $1
    ORDER BY trt.libelle ASC`,
    [code],
  );

  return result.rows.map((row) => ({
    id: row.id_type_relation,
    id_inverse_defaut: row.id_inverse_defaut,
    id_inverse_masculin: row.id_inverse_masculin,
    id_inverse_feminin: row.id_inverse_feminin,
    id_traduction: row.id_traduction,
    id_langue: row.id_langue,
    code_langue: row.code_langue,
    nom_langue: row.nom_langue,
    libelle: row.libelle,
  }));
}
