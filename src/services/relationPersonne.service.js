import database from "../config/db.js";
import RelationPersonne from "../models/RelationPersonne.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapRelationRow(row) {
  return new RelationPersonne({
    id: row.id,
    id_personne_source: row.id_personne_source,
    id_personne_cible: row.id_personne_cible,
    id_type_relation: row.id_type_relation,
    personne_source: row.id_personne_source
      ? {
          id: row.id_personne_source,
          nom: row.nom_personne_source,
          prenom: row.prenom_personne_source,
        }
      : null,
    personne_cible: row.id_personne_cible
      ? {
          id: row.id_personne_cible,
          nom: row.nom_personne_cible,
          prenom: row.prenom_personne_cible,
        }
      : null,
    type_relation: row.id_type_relation
      ? { id: row.id_type_relation, libelle: row.libelle_type_relation }
      : null,
  });
}

const relationSelect = `
  SELECT
    r.id,
    r.id_personne_source,
    r.id_personne_cible,
    r.id_type_relation,
    source.nom AS nom_personne_source,
    source.prenom AS prenom_personne_source,
    cible.nom AS nom_personne_cible,
    cible.prenom AS prenom_personne_cible,
    trt.libelle AS libelle_type_relation
  FROM relation_personne r
  JOIN personne source ON source.id = r.id_personne_source
  JOIN personne cible ON cible.id = r.id_personne_cible
  LEFT JOIN langue l ON l.code = $1
  LEFT JOIN type_relation_traduction trt
    ON trt.id_type_relation = r.id_type_relation
    AND trt.id_langue = l.id
`;

async function getPersonneForRelation(id) {
  const result = await database.query(
    `SELECT
      p.id,
      p.id_sexe,
      p.id_compte_createur,
      s.code AS code_sexe
    FROM personne p
    LEFT JOIN sexe s ON s.id = p.id_sexe
    WHERE p.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getTypeRelationForInverse(id) {
  const result = await database.query(
    `SELECT
      id,
      id_inverse_defaut,
      id_inverse_masculin,
      id_inverse_feminin
    FROM type_relation
    WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

function resolveInverseType(typeRelation, sourcePersonne) {
  if (typeRelation.id_inverse_defaut) {
    return typeRelation.id_inverse_defaut;
  }

  if (!sourcePersonne.id_sexe || !sourcePersonne.code_sexe) {
    throw businessError(
      "Impossible de déterminer la relation inverse à partir du sexe de la personne source",
      "INVERSE_SEXE_UNSUPPORTED",
    );
  }

  let inverseTypeId = null;
  if (sourcePersonne.code_sexe === "MASCULIN") {
    inverseTypeId = typeRelation.id_inverse_masculin;
  } else if (sourcePersonne.code_sexe === "FEMININ") {
    inverseTypeId = typeRelation.id_inverse_feminin;
  }

  if (!inverseTypeId) {
    throw businessError(
      "Impossible de déterminer la relation inverse à partir du sexe de la personne source",
      "INVERSE_SEXE_UNSUPPORTED",
    );
  }

  return inverseTypeId;
}

async function relationExists(sourceId, cibleId) {
  const result = await database.query(
    `SELECT id
    FROM relation_personne
    WHERE id_personne_source = $1
      AND id_personne_cible = $2
    LIMIT 1`,
    [sourceId, cibleId],
  );
  return result.rows[0] ?? null;
}

async function getRelationRawById(id) {
  const result = await database.query(
    `SELECT id, id_personne_source, id_personne_cible, id_type_relation,
      id_compte_createur
    FROM relation_personne
    WHERE id = $1`,
    [id],
  );
  return result.rows[0]
    ? new RelationPersonne({
        id: result.rows[0].id,
        id_personne_source: result.rows[0].id_personne_source,
        id_personne_cible: result.rows[0].id_personne_cible,
        id_type_relation: result.rows[0].id_type_relation,
        id_compte_createur: result.rows[0].id_compte_createur,
      })
    : null;
}

async function getInverseRelationRaw(sourceId, cibleId, typeId) {
  const result = await database.query(
    `SELECT id, id_personne_source, id_personne_cible, id_type_relation,
      id_compte_createur
    FROM relation_personne
    WHERE id_personne_source = $1
      AND id_personne_cible = $2
      AND id_type_relation = $3`,
    [sourceId, cibleId, typeId],
  );

  return result.rows[0]
    ? new RelationPersonne({
        id: result.rows[0].id,
        id_personne_source: result.rows[0].id_personne_source,
        id_personne_cible: result.rows[0].id_personne_cible,
        id_type_relation: result.rows[0].id_type_relation,
        id_compte_createur: result.rows[0].id_compte_createur,
      })
    : null;
}

export async function getAllRelationsPersonne(lang = "fr") {
  const result = await database.query(
    `${relationSelect} ORDER BY r.id ASC`,
    [lang],
  );
  return result.rows.map(mapRelationRow);
}

export async function getRelationPersonneById(id, lang = "fr") {
  const result = await database.query(
    `${relationSelect} WHERE r.id = $2`,
    [lang, id],
  );
  return result.rows[0] ? mapRelationRow(result.rows[0]) : null;
}

export async function getRelationsPersonneByPersonne(id, lang = "fr") {
  const result = await database.query(
    `${relationSelect} WHERE r.id_personne_source = $2 ORDER BY r.id ASC`,
    [lang, id],
  );
  return result.rows.map(mapRelationRow);
}

function authorizationError(action) {
  const error = new Error(`Vous n'êtes pas autorisé à ${action} cette relation`);
  error.code = `RELATION_${action.toUpperCase()}_FORBIDDEN`;
  return error;
}

function isManagedPerson(personne, auth) {
  return (
    personne.id === auth?.personne?.id ||
    personne.id_compte_createur === auth?.compte?.id
  );
}

function canManageRelation(relation, source, cible, auth) {
  if (auth?.compte?.role === "ADMIN") return true;
  if (!auth?.compte?.id || !auth?.personne?.id) return false;

  return (
    isManagedPerson(source, auth) ||
    isManagedPerson(cible, auth) ||
    relation?.id_compte_createur === auth.compte.id
  );
}

export async function createRelationPersonne(relation, lang = "fr", auth = null) {
  const relationId = await database.transaction(async () => {
    if (relation.id_personne_source === relation.id_personne_cible) {
      throw businessError(
        "La personne source et la personne cible doivent être différentes",
        "SELF_RELATION",
      );
    }

    const [source, cible, typeRelation, existing] = await Promise.all([
      getPersonneForRelation(relation.id_personne_source),
      getPersonneForRelation(relation.id_personne_cible),
      getTypeRelationForInverse(relation.id_type_relation),
      relationExists(
        relation.id_personne_source,
        relation.id_personne_cible,
      ),
    ]);

    if (!source || !cible) {
      throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
    }

    if (!canManageRelation(null, source, cible, auth)) {
      throw authorizationError("creer");
    }

    if (!typeRelation) {
      throw businessError(
        "Type de relation introuvable",
        "TYPE_RELATION_NOT_FOUND",
      );
    }

    if (existing) {
      throw businessError(
        "Une relation familiale existe déjà entre ces deux personnes",
        "RELATION_EXISTS",
      );
    }

    const inverseTypeId = resolveInverseType(typeRelation, source);
    const direct = await database.query(
      `INSERT INTO relation_personne (
        id_personne_source,
        id_personne_cible,
        id_type_relation,
        id_compte_createur
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [
        relation.id_personne_source,
        relation.id_personne_cible,
        relation.id_type_relation,
        auth.compte.id,
      ],
    );

    if (
      !(await relationExists(
        relation.id_personne_cible,
        relation.id_personne_source,
      ))
    ) {
      await database.query(
        `INSERT INTO relation_personne (
          id_personne_source,
          id_personne_cible,
          id_type_relation,
          id_compte_createur
        )
        VALUES ($1, $2, $3, $4)`,
        [
          relation.id_personne_cible,
          relation.id_personne_source,
          inverseTypeId,
          auth.compte.id,
        ],
      );
    }

    return direct.rows[0].id;
  });

  return getRelationPersonneById(relationId, lang);
}

export async function updateRelationPersonneType(
  id,
  idTypeRelation,
  lang = "fr",
  auth = null,
) {
  const relationId = await database.transaction(async () => {
    const relation = await getRelationRawById(id);
    if (!relation) {
      return null;
    }

    const [source, cible, oldTypeRelation, newTypeRelation] = await Promise.all([
      getPersonneForRelation(relation.id_personne_source),
      getPersonneForRelation(relation.id_personne_cible),
      getTypeRelationForInverse(relation.id_type_relation),
      getTypeRelationForInverse(idTypeRelation),
    ]);

    if (!source || !oldTypeRelation) {
      throw businessError(
        "Impossible de déterminer la relation inverse",
        "INVERSE_NOT_CONFIGURED",
      );
    }

    if (!newTypeRelation) {
      throw businessError(
        "Type de relation introuvable",
        "TYPE_RELATION_NOT_FOUND",
      );
    }

    if (!cible || !canManageRelation(relation, source, cible, auth)) {
      throw authorizationError("modifier");
    }

    const oldInverseTypeId = resolveInverseType(oldTypeRelation, source);
    const newInverseTypeId = resolveInverseType(newTypeRelation, source);
    const inverse = await getInverseRelationRaw(
      relation.id_personne_cible,
      relation.id_personne_source,
      oldInverseTypeId,
    );

    await database.query(
      `UPDATE relation_personne
      SET id_type_relation = $1, date_modification = now()
      WHERE id = $2`,
      [idTypeRelation, relation.id],
    );

    if (inverse) {
      await database.query(
        `UPDATE relation_personne
        SET id_type_relation = $1, date_modification = now()
        WHERE id = $2`,
        [newInverseTypeId, inverse.id],
      );
    } else {
      await database.query(
        `INSERT INTO relation_personne (
          id_personne_source,
          id_personne_cible,
          id_type_relation,
          id_compte_createur
        )
        VALUES ($1, $2, $3, $4)`,
        [
          relation.id_personne_cible,
          relation.id_personne_source,
          newInverseTypeId,
          relation.id_compte_createur,
        ],
      );
    }

    return relation.id;
  });

  return relationId ? getRelationPersonneById(relationId, lang) : null;
}

export async function deleteRelationPersonne(id, auth = null, lang = "fr") {
  return database.transaction(async () => {
    const relation = await getRelationRawById(id);
    if (!relation) {
      return null;
    }

    const [source, cible, typeRelation] = await Promise.all([
      getPersonneForRelation(relation.id_personne_source),
      getPersonneForRelation(relation.id_personne_cible),
      getTypeRelationForInverse(relation.id_type_relation),
    ]);

    if (!source || !typeRelation) {
      throw businessError(
        "Impossible de déterminer la relation inverse",
        "INVERSE_NOT_CONFIGURED",
      );
    }

    if (!cible || !canManageRelation(relation, source, cible, auth)) {
      throw authorizationError("supprimer");
    }

    const relationEnrichie = await getRelationPersonneById(id, lang);
    const inverseTypeId = resolveInverseType(typeRelation, source);

    await database.query("DELETE FROM relation_personne WHERE id = $1", [id]);
    await database.query(
      `DELETE FROM relation_personne
      WHERE id_personne_source = $1
        AND id_personne_cible = $2
        AND id_type_relation = $3`,
      [
        relation.id_personne_cible,
        relation.id_personne_source,
        inverseTypeId,
      ],
    );

    return relationEnrichie;
  });
}
