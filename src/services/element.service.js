import database from "../config/db.js";
import Element from "../models/Element.js";

function rowToElement(row) {
  return new Element({
    id: row.id,
    id_type_element: row.id_type_element,
    nom: row.nom,
    autres_appellations: row.autres_appellations,
    id_sexe: row.id_sexe,
    nom_conjoint: row.nom_conjoint,
    ville_origine_conjoint: row.ville_origine_conjoint,
    rattachement_sup: row.rattachement_sup,
    etat: row.etat,
    type_element: {
      id: row.id_type_element,
      code: row.code_type_element,
      libelle: row.libelle_type_element,
    },
    sexe: row.id_sexe ? { id: row.id_sexe } : null,
    parent: row.id_parent ? { id: row.id_parent, nom: row.nom_parent } : null,
  });
}

const elementsSelect = `
  SELECT
    e.id,
    e.id_type_element,
    e.nom,
    e.autres_appellations,
    e.id_sexe,
    e.nom_conjoint,
    e.ville_origine_conjoint,
    e.rattachement_sup,
    e.etat,
    te.code AS code_type_element,
    te.libelle AS libelle_type_element,
    parent.id AS id_parent,
    parent.nom AS nom_parent
  FROM element e
  JOIN type_element te ON te.id = e.id_type_element
  LEFT JOIN element parent ON parent.id = e.rattachement_sup
`;

function hierarchyError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function validateNoDuplicate(element, elementId = null) {
  const result = await database.query(
    `
      SELECT 1
      FROM element e
      JOIN type_element te ON te.id = e.id_type_element
      WHERE e.id_type_element = $1
        AND te.code IN ('RAZAMBE', 'TARANAKA', 'SAMPANA')
        AND LOWER(BTRIM(e.nom)) = LOWER(BTRIM($2))
        AND e.rattachement_sup IS NOT DISTINCT FROM $3
        AND ($4::uuid IS NULL OR e.id <> $4)
      LIMIT 1
    `,
    [element.id_type_element, element.nom, element.rattachement_sup, elementId],
  );

  if (result.rows.length > 0) {
    throw hierarchyError(
      "Un élément avec ce nom existe déjà à ce niveau de rattachement",
      "ELEMENT_DUPLICATE",
    );
  }
}
async function getTypeById(id) {
  const result = await database.query(
    `SELECT id, code FROM type_element WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getParentById(id) {
  const result = await database.query(
    `
      SELECT e.id, e.nom, te.code AS code_type_element
      FROM element e
      JOIN type_element te ON te.id = e.id_type_element
      WHERE e.id = $1
    `,
    [id],
  );
  return result.rows[0] ?? null;
}

async function validateHierarchy(element, elementId = null) {
  const type = await getTypeById(element.id_type_element);

  if (!type) {
    throw hierarchyError("Le type d'élément sélectionné n'existe pas", "TYPE_NOT_FOUND");
  }

  let parent = null;

  if (element.rattachement_sup) {
    if (elementId && element.rattachement_sup === elementId) {
      throw hierarchyError("Un élément ne peut pas être son propre parent", "SELF_PARENT");
    }

    parent = await getParentById(element.rattachement_sup);

    if (!parent) {
      throw hierarchyError("L'élément parent n'existe pas", "PARENT_NOT_FOUND");
    }

    if (elementId) {
      const descendants = await database.query(
        `
          WITH RECURSIVE descendants AS (
            SELECT id FROM element WHERE rattachement_sup = $1
            UNION ALL
            SELECT e.id
            FROM element e
            JOIN descendants d ON e.rattachement_sup = d.id
          )
          SELECT 1 FROM descendants WHERE id = $2 LIMIT 1
        `,
        [elementId, element.rattachement_sup],
      );

      if (descendants.rows.length > 0) {
        throw hierarchyError("Ce rattachement créerait un cycle hiérarchique", "HIERARCHY_CYCLE");
      }
    }
  }

  const typeCode = type.code;
  const parentTypeCode = parent ? parent.code_type_element : null;

  if (typeCode === "RAZAMBE" && parent) {
    throw hierarchyError("Un RAZAMBE ne peut pas avoir de parent", "HIERARCHY_INVALID");
  }

  if (typeCode === "TARANAKA" && !parent) {
    throw hierarchyError("Un TARANAKA doit être rattaché à un RAZAMBE", "PARENT_REQUIRED");
  }

  if (typeCode === "TARANAKA" && parentTypeCode !== "RAZAMBE") {
    throw hierarchyError("Un TARANAKA doit être rattaché à un RAZAMBE", "HIERARCHY_INVALID");
  }

  if (typeCode === "SAMPANA" && !parent) {
    throw hierarchyError("Un SAMPANA doit être rattaché à un TARANAKA", "PARENT_REQUIRED");
  }

  if (typeCode === "SAMPANA" && parentTypeCode !== "TARANAKA") {
    throw hierarchyError("Un SAMPANA doit être rattaché à un TARANAKA", "HIERARCHY_INVALID");
  }
}

async function validateSexe(idSexe) {
  if (!idSexe) {
    return;
  }

  const result = await database.query(`SELECT id FROM sexe WHERE id = $1`, [idSexe]);

  if (result.rows.length === 0) {
    throw hierarchyError("Le sexe sélectionné n'existe pas", "SEXE_NOT_FOUND");
  }
}

async function validateElement(element, elementId = null) {
  await validateSexe(element.id_sexe);
  await validateHierarchy(element, elementId);
  await validateNoDuplicate(element, elementId);
}

export async function getAllElements() {
  const result = await database.query(`${elementsSelect} ORDER BY e.nom ASC`);
  return result.rows.map(rowToElement);
}

export async function getElementById(id) {
  const result = await database.query(`${elementsSelect} WHERE e.id = $1`, [id]);
  return result.rows.length === 0 ? null : rowToElement(result.rows[0]);
}

export async function getElementsByType(idTypeElement) {
  const result = await database.query(
    `${elementsSelect} WHERE e.id_type_element = $1 ORDER BY e.nom ASC`,
    [idTypeElement],
  );
  return result.rows.map(rowToElement);
}

export async function getElementsByParent(idParent) {
  const result = await database.query(
    `${elementsSelect} WHERE e.rattachement_sup = $1 ORDER BY e.nom ASC`,
    [idParent],
  );
  return result.rows.map(rowToElement);
}

export async function getElementsByParentAndType(idParent, idTypeElement) {
  const result = await database.query(
    `
      ${elementsSelect}
      WHERE e.rattachement_sup = $1 AND e.id_type_element = $2
      ORDER BY e.nom ASC
    `,
    [idParent, idTypeElement],
  );
  return result.rows.map(rowToElement);
}

export async function createElement(element) {
  await validateElement(element);

  const result = await database.query(
    `
      INSERT INTO element (
        id_type_element,
        nom,
        autres_appellations,
        id_sexe,
        nom_conjoint,
        ville_origine_conjoint,
        rattachement_sup,
        etat
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      element.id_type_element,
      element.nom,
      element.autres_appellations,
      element.id_sexe,
      element.nom_conjoint,
      element.ville_origine_conjoint,
      element.rattachement_sup,
      element.etat,
    ],
  );

  return getElementById(result.rows[0].id);
}

export async function updateElement(id, element) {
  const existing = await getElementById(id);

  if (!existing) {
    return null;
  }

  await validateElement(element, id);

  await database.query(
    `
      UPDATE element
      SET
        id_type_element = $1,
        nom = $2,
        autres_appellations = $3,
        id_sexe = $4,
        nom_conjoint = $5,
        ville_origine_conjoint = $6,
        rattachement_sup = $7,
        etat = $8
      WHERE id = $9
    `,
    [
      element.id_type_element,
      element.nom,
      element.autres_appellations,
      element.id_sexe,
      element.nom_conjoint,
      element.ville_origine_conjoint,
      element.rattachement_sup,
      element.etat,
      id,
    ],
  );

  return getElementById(id);
}

export async function deleteElement(id) {
  const element = await getElementById(id);

  if (!element) {
    return null;
  }

  const children = await database.query(
    `SELECT 1 FROM element WHERE rattachement_sup = $1 LIMIT 1`,
    [id],
  );

  if (children.rows.length > 0) {
    throw hierarchyError(
      "Impossible de supprimer cet élément car d'autres éléments lui sont rattachés.",
      "HAS_CHILDREN",
    );
  }

  await database.query(
    `DELETE FROM element WHERE id = $1`,
    [id],
  );

  return element;
}
