import database from "../config/db.js";
import RelationPersonne from "../models/RelationPersonne.js";
import { canManagePersonneRecord } from "./personneAuthorization.service.js";

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
    origine: row.origine,
    personne_source: row.id_personne_source
      ? {
          id: row.id_personne_source,
          nom: row.nom_personne_source,
          prenom: row.prenom_personne_source,
          sexe: row.code_sexe_personne_source ?? null,
        }
      : null,
    personne_cible: row.id_personne_cible
      ? {
          id: row.id_personne_cible,
          nom: row.nom_personne_cible,
          prenom: row.prenom_personne_cible,
          sexe: row.code_sexe_personne_cible ?? null,
        }
      : null,
    type_relation: row.id_type_relation
      ? {
          id: row.id_type_relation,
          code: row.code_type_relation,
          libelle: row.libelle_type_relation,
        }
      : null,
  });
}

const relationSelect = `
  SELECT
    r.id,
    r.id_personne_source,
    r.id_personne_cible,
    r.id_type_relation,
    r.origine,
    source.nom AS nom_personne_source,
    source.prenom AS prenom_personne_source,
    sexe_source.code AS code_sexe_personne_source,
    cible.nom AS nom_personne_cible,
    cible.prenom AS prenom_personne_cible,
    sexe_cible.code AS code_sexe_personne_cible,
    tr.code AS code_type_relation,
    trt.libelle AS libelle_type_relation
  FROM relation_personne r
  JOIN personne source ON source.id = r.id_personne_source
  JOIN personne cible ON cible.id = r.id_personne_cible
  LEFT JOIN sexe sexe_source ON sexe_source.id = source.id_sexe
  LEFT JOIN sexe sexe_cible ON sexe_cible.id = cible.id_sexe
  JOIN type_relation tr ON tr.id = r.id_type_relation
  LEFT JOIN langue l ON l.code = $1
  LEFT JOIN type_relation_traduction trt
    ON trt.id_type_relation = r.id_type_relation
    AND trt.id_langue = l.id
`;

async function getPersonneForRelation(id) {
  const result = await database.query(
    `SELECT
      p.id,
      p.id_compte_createur,
      EXISTS (
        SELECT 1
        FROM compte_membre cm
        WHERE cm.id_personne = p.id
      ) AS has_compte_membre
    FROM personne p
    WHERE p.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getTypeRelationForInverse(id) {
  const result = await database.query(
    `SELECT
      id,
      code,
      id_inverse_defaut
    FROM type_relation
    WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

function resolveInverseType(typeRelation) {
  if (!typeRelation.id_inverse_defaut) {
    throw businessError(
      "La relation ne possède pas de type inverse configuré",
      "INVERSE_NOT_CONFIGURED",
    );
  }
  return typeRelation.id_inverse_defaut;
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

async function assertConjointAvailableInTransaction(sourceId, cibleId) {
  await database.query(
    `SELECT id
    FROM personne
    WHERE id = ANY($1::uuid[])
    ORDER BY id
    FOR UPDATE`,
    [[sourceId, cibleId]],
  );

  const existingConjoint = await database.query(
    `SELECT 1
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = 'CONJOINT'
      AND (
        (r.id_personne_source = $1 AND r.id_personne_cible <> $2)
        OR (r.id_personne_cible = $1 AND r.id_personne_source <> $2)
        OR (r.id_personne_source = $2 AND r.id_personne_cible <> $1)
        OR (r.id_personne_cible = $2 AND r.id_personne_source <> $1)
      )
    LIMIT 1`,
    [sourceId, cibleId],
  );

  if (existingConjoint.rows[0]) {
    throw businessError(
      "Cette personne possède déjà un conjoint enregistré.",
      "CONJOINT_ALREADY_EXISTS",
    );
  }
}
async function getRelationByPair(sourceId, cibleId) {
  const result = await database.query(
    `SELECT id, id_type_relation, origine
    FROM relation_personne
    WHERE id_personne_source = $1
      AND id_personne_cible = $2
    LIMIT 1`,
    [sourceId, cibleId],
  );
  return result.rows[0] ?? null;
}

async function addAutoJustifications(relationId, justificationIds) {
  const ids = [...new Set(justificationIds.filter(Boolean))].filter(
    (id) => id !== relationId,
  );

  if (!ids.length) {
    throw businessError(
      "Impossible de justifier la relation générée automatiquement",
      "FAMILY_PROPAGATION_CONFLICT",
    );
  }

  for (const sourceId of ids) {
    await database.query(
      `INSERT INTO relation_personne_justification (
        id_relation,
        id_relation_source
      )
      VALUES ($1, $2)
      ON CONFLICT (id_relation, id_relation_source) DO NOTHING`,
      [relationId, sourceId],
    );
  }
}

async function ensureAutoRelationInTransaction({
  sourceId,
  cibleId,
  typeId,
  inverseTypeId,
  justificationIds,
  idCompteCreateur,
}) {
  async function ensureOne(fromId, toId, expectedTypeId) {
    const existing = await getRelationByPair(fromId, toId);

    if (existing && existing.id_type_relation !== expectedTypeId) {
      throw businessError(
        "Une relation incompatible existe déjà entre deux membres de la fratrie",
        "FAMILY_PROPAGATION_CONFLICT",
      );
    }

    if (existing) {
      if (existing.origine === "AUTO") {
        await addAutoJustifications(existing.id, justificationIds);
      }
      return existing.id;
    }

    const inserted = await database.query(
      `INSERT INTO relation_personne (
        id_personne_source,
        id_personne_cible,
        id_type_relation,
        id_compte_createur,
        origine
      )
      VALUES ($1, $2, $3, $4, 'AUTO')
      RETURNING id`,
      [fromId, toId, expectedTypeId, idCompteCreateur],
    );
    const relationId = inserted.rows[0].id;
    await addAutoJustifications(relationId, justificationIds);
    return relationId;
  }

  await ensureOne(sourceId, cibleId, typeId);
  await ensureOne(cibleId, sourceId, inverseTypeId);
}

async function getFratrieGroupInTransaction(personneId) {
  const membersResult = await database.query(
    `WITH RECURSIVE groupe(id, chemin) AS (
      SELECT $1::uuid, ARRAY[$1::uuid]
      UNION ALL
      SELECT
        CASE
          WHEN r.id_personne_source = g.id THEN r.id_personne_cible
          ELSE r.id_personne_source
        END,
        g.chemin || CASE
          WHEN r.id_personne_source = g.id THEN r.id_personne_cible
          ELSE r.id_personne_source
        END
      FROM groupe g
      JOIN relation_personne r
        ON r.id_personne_source = g.id OR r.id_personne_cible = g.id
      JOIN type_relation tr
        ON tr.id = r.id_type_relation AND tr.code = 'FRATRIE'
      WHERE NOT (
        CASE
          WHEN r.id_personne_source = g.id THEN r.id_personne_cible
          ELSE r.id_personne_source
        END = ANY(g.chemin)
      )
    )
    SELECT DISTINCT id FROM groupe
    ORDER BY id`,
    [personneId],
  );
  const memberIds = membersResult.rows.map((row) => row.id);

  const edgesResult = await database.query(
    `SELECT r.id, r.id_personne_source, r.id_personne_cible
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = 'FRATRIE'
      AND r.id_personne_source = ANY($1::uuid[])
      AND r.id_personne_cible = ANY($1::uuid[])
    ORDER BY r.id ASC`,
    [memberIds],
  );

  return { memberIds, edges: edgesResult.rows };
}

function getFratriePathJustifications(sourceId, cibleId, edges) {
  if (sourceId === cibleId) return [];

  const adjacency = new Map();
  for (const edge of edges) {
    for (const [from, to] of [
      [edge.id_personne_source, edge.id_personne_cible],
      [edge.id_personne_cible, edge.id_personne_source],
    ]) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ to, relationId: edge.id });
    }
  }

  const queue = [{ id: sourceId, relationIds: [] }];
  const visited = new Set([sourceId]);
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (visited.has(neighbor.to)) continue;
      const relationIds = [...current.relationIds, neighbor.relationId];
      if (neighbor.to === cibleId) return relationIds;
      visited.add(neighbor.to);
      queue.push({ id: neighbor.to, relationIds });
    }
  }
  return null;
}

function getCoherentParentSet(parentSets) {
  const nonEmptySets = [...parentSets.values()].filter((parents) => parents.size);
  const distinctSets = [
    ...new Map(
      nonEmptySets.map((parents) => [[...parents].sort().join("|"), parents]),
    ).values(),
  ];
  const maximalSets = distinctSets.filter(
    (parents) =>
      !distinctSets.some(
        (other) =>
          other !== parents &&
          parents.size < other.size &&
          [...parents].every((parentId) => other.has(parentId)),
      ),
  );

  if (maximalSets.length > 1) {
    throw businessError(
      "Conflit de parents dans le groupe de fratrie",
      "FAMILY_PROPAGATION_CONFLICT",
    );
  }

  return maximalSets[0] ?? new Set();
}

async function getTypeRelationByCode(code) {
  const result = await database.query(
    `SELECT id, id_inverse_defaut
    FROM type_relation
    WHERE code = $1`,
    [code],
  );
  return result.rows[0] ?? null;
}

async function getParentRelationsForChildrenInTransaction(childIds) {
  if (!childIds.length) return [];

  const result = await database.query(
    `SELECT r.id, r.id_personne_source AS id_enfant, r.id_personne_cible AS id_parent
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = 'PARENT'
      AND r.id_personne_source = ANY($1::uuid[])`,
    [childIds],
  );
  return result.rows;
}

function assertValidParentCount(parentRelations) {
  const parentsByChild = new Map();
  for (const relation of parentRelations) {
    if (!parentsByChild.has(relation.id_enfant)) {
      parentsByChild.set(relation.id_enfant, new Set());
    }
    parentsByChild.get(relation.id_enfant).add(relation.id_parent);
  }

  for (const parents of parentsByChild.values()) {
    if (parents.size > 2) {
      throw businessError(
        "Un enfant ne peut pas posséder plus de deux parents dans sa famille déclarée",
        "FAMILY_PROPAGATION_CONFLICT",
      );
    }
  }
}

async function getConjointPairsForPersonnesInTransaction(personneIds) {
  if (!personneIds.length) return [];

  const result = await database.query(
    `SELECT r.id, r.id_personne_source, r.id_personne_cible
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = 'CONJOINT'
      AND (
        r.id_personne_source = ANY($1::uuid[])
        OR r.id_personne_cible = ANY($1::uuid[])
      )
    ORDER BY r.id ASC`,
    [personneIds],
  );

  // Une union est persistée dans les deux sens. Une seule relation suffit
  // comme justification de la règle de parenté dérivée.
  const pairs = new Map();
  for (const relation of result.rows) {
    const key = [relation.id_personne_source, relation.id_personne_cible]
      .sort()
      .join(":");
    if (!pairs.has(key)) pairs.set(key, relation);
  }
  return [...pairs.values()];
}

async function getChildrenOfParentInTransaction(parentId) {
  const result = await database.query(
    `SELECT r.id_personne_source
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = 'PARENT'
      AND r.id_personne_cible = $1`,
    [parentId],
  );
  return result.rows.map((row) => row.id_personne_source);
}

async function propagateConjointParentsInTransaction({
  personneIds,
  idCompteCreateur,
}) {
  const uniquePersonneIds = [...new Set(personneIds.filter(Boolean))];
  if (!uniquePersonneIds.length) return [];

  const parentType = await getTypeRelationByCode("PARENT");
  if (!parentType?.id_inverse_defaut) {
    throw businessError(
      "Les types de relation nécessaires ne sont pas correctement configurés",
      "INVERSE_NOT_CONFIGURED",
    );
  }

  const conjointPairs = await getConjointPairsForPersonnesInTransaction(
    uniquePersonneIds,
  );
  const affectedChildren = new Set();

  for (const conjoint of conjointPairs) {
    for (const [parentId, conjointId] of [
      [conjoint.id_personne_source, conjoint.id_personne_cible],
      [conjoint.id_personne_cible, conjoint.id_personne_source],
    ]) {
      const childIds = await getChildrenOfParentInTransaction(parentId);
      const parentRelations = await getParentRelationsForChildrenInTransaction(
        childIds,
      );
      const parentRelationsByChild = new Map();
      for (const relation of parentRelations) {
        if (!parentRelationsByChild.has(relation.id_enfant)) {
          parentRelationsByChild.set(relation.id_enfant, []);
        }
        parentRelationsByChild.get(relation.id_enfant).push(relation);
      }

      for (const [childId, childParents] of parentRelationsByChild) {
        affectedChildren.add(childId);
        assertValidParentCount(childParents);

        // Un conjoint ne complète que le parent manquant : il ne remplace
        // jamais un second parent déjà déclaré.
        if (
          childParents.length !== 1 ||
          childParents[0].id_parent !== parentId
        ) {
          continue;
        }

        await ensureAutoRelationInTransaction({
          sourceId: childId,
          cibleId: conjointId,
          typeId: parentType.id,
          inverseTypeId: parentType.id_inverse_defaut,
          justificationIds: [childParents[0].id, conjoint.id],
          idCompteCreateur,
        });
      }
    }
  }

  return [...affectedChildren];
}

async function reconcileFamilyLegacyInTransaction({ personneIds, idCompteCreateur }) {
  const affectedPersonIds = new Set(personneIds.filter(Boolean));
  const initialParentRelations = await getParentRelationsForChildrenInTransaction(
    [...affectedPersonIds],
  );
  assertValidParentCount(initialParentRelations);

  // Une relation PARENT/ENFANT peut révéler le conjoint d'un parent sans que
  // ce parent soit lui-même l'une des deux personnes de la relation saisie.
  for (const relation of initialParentRelations) {
    affectedPersonIds.add(relation.id_parent);
  }

  const conjointChildren = await propagateConjointParentsInTransaction({
    personneIds: [...affectedPersonIds],
    idCompteCreateur,
  });
  for (const childId of conjointChildren) affectedPersonIds.add(childId);

  const reconciledGroups = new Set();
  for (const personneId of affectedPersonIds) {
    const { memberIds } = await getFratrieGroupInTransaction(personneId);
    const groupKey = [...memberIds].sort().join(":");
    if (reconciledGroups.has(groupKey)) continue;
    reconciledGroups.add(groupKey);

    await propagateFratrieGroupInTransaction({
      personneId,
      idCompteCreateur,
    });
  }
}
async function propagateFratrieGroupInTransaction({
  personneId,
  idCompteCreateur,
}) {
  const { memberIds, edges } = await getFratrieGroupInTransaction(personneId);
  const parentsResult = await database.query(
    `SELECT r.id, r.id_personne_source AS id_enfant, r.id_personne_cible AS id_parent
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = 'PARENT'
      AND r.id_personne_source = ANY($1::uuid[])`,
    [memberIds],
  );

  const parentsByMember = new Map(memberIds.map((id) => [id, new Set()]));
  const parentRelationIds = new Map();
  for (const row of parentsResult.rows) {
    parentsByMember.get(row.id_enfant).add(row.id_parent);
    parentRelationIds.set(`${row.id_enfant}:${row.id_parent}`, row.id);
  }

  for (const parents of parentsByMember.values()) {
    if (parents.size > 2) {
      throw businessError(
        "Un enfant ne peut pas posséder plus de deux parents dans sa famille déclarée",
        "FAMILY_PROPAGATION_CONFLICT",
      );
    }
  }

  const coherentParents = getCoherentParentSet(parentsByMember);
  if (coherentParents.size > 2) {
    throw businessError(
      "Un enfant ne peut pas posséder plus de deux parents dans sa famille déclarée",
      "FAMILY_PROPAGATION_CONFLICT",
    );
  }
  const [parentType, fratrieType] = await Promise.all([
    getTypeRelationByCode("PARENT"),
    getTypeRelationByCode("FRATRIE"),
  ]);
  if (!parentType?.id_inverse_defaut || !fratrieType?.id_inverse_defaut) {
    throw businessError(
      "Les types de relation nécessaires ne sont pas correctement configurés",
      "INVERSE_NOT_CONFIGURED",
    );
  }

  for (const memberId of memberIds) {
    const memberParents = parentsByMember.get(memberId);
    for (const parentId of coherentParents) {
      if (memberParents.has(parentId)) continue;
      const ownerId = memberIds.find((candidateId) =>
        parentsByMember.get(candidateId).has(parentId),
      );
      const path = getFratriePathJustifications(ownerId, memberId, edges);
      const parentRelationId = parentRelationIds.get(`${ownerId}:${parentId}`);
      if (!path || !parentRelationId) {
        throw businessError(
          "Impossible de justifier la propagation des parents",
          "FAMILY_PROPAGATION_CONFLICT",
        );
      }
      await ensureAutoRelationInTransaction({
        sourceId: memberId,
        cibleId: parentId,
        typeId: parentType.id,
        inverseTypeId: parentType.id_inverse_defaut,
        justificationIds: [parentRelationId, ...path],
        idCompteCreateur,
      });
      memberParents.add(parentId);
    }
  }

  for (let index = 0; index < memberIds.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < memberIds.length; otherIndex += 1) {
      const sourceId = memberIds[index];
      const cibleId = memberIds[otherIndex];
      const path = getFratriePathJustifications(sourceId, cibleId, edges);
      if (!path?.length) {
        throw businessError(
          "Impossible de justifier la complétion de la fratrie",
          "FAMILY_PROPAGATION_CONFLICT",
        );
      }
      await ensureAutoRelationInTransaction({
        sourceId,
        cibleId,
        typeId: fratrieType.id,
        inverseTypeId: fratrieType.id_inverse_defaut,
        justificationIds: path,
        idCompteCreateur,
      });
    }
  }

  return memberIds;
}


export async function backfillFratrieGroup(personneId) {
  return database.transaction(() =>
    propagateFratrieGroupInTransaction({
      personneId,
      idCompteCreateur: null,
    }),
  );
}

const FAMILY_CODES = new Set(["PARENT", "ENFANT", "CONJOINT", "FRATRIE"]);
const MAX_RECONCILIATION_ITERATIONS = 64;

function familyRelationKey(sourceId, cibleId) {
  return `${sourceId}:${cibleId}`;
}

function relationProofKey(keys) {
  return [...new Set(keys)].sort().join("|");
}

async function getFamilyTypesInTransaction() {
  const result = await database.query(
    `SELECT id, code, id_inverse_defaut
     FROM type_relation
     WHERE code = ANY($1::text[])`,
    [[...FAMILY_CODES]],
  );
  const byCode = new Map(result.rows.map((row) => [row.code, row]));
  if (byCode.size !== FAMILY_CODES.size) {
    throw businessError(
      "Les types de relation nécessaires ne sont pas correctement configurés",
      "INVERSE_NOT_CONFIGURED",
    );
  }
  const byId = new Map(result.rows.map((row) => [row.id, row]));
  for (const type of result.rows) {
    if (!type.id_inverse_defaut || !byId.has(type.id_inverse_defaut)) {
      throw businessError(
        "Les types de relation nécessaires ne sont pas correctement configurés",
        "INVERSE_NOT_CONFIGURED",
      );
    }
  }
  return { byCode, byId };
}

async function getConnectedFamilyPersonIds(seedIds) {
  const seeds = [...new Set(seedIds.filter(Boolean))].sort();
  if (!seeds.length) return [];
  const result = await database.query(
    `WITH RECURSIVE component(id, path) AS (
      SELECT seed.id, ARRAY[seed.id]
      FROM unnest($1::uuid[]) AS seed(id)
      UNION ALL
      SELECT
        CASE WHEN r.id_personne_source = component.id
          THEN r.id_personne_cible ELSE r.id_personne_source END,
        component.path || CASE WHEN r.id_personne_source = component.id
          THEN r.id_personne_cible ELSE r.id_personne_source END
      FROM component
      JOIN relation_personne r
        ON r.id_personne_source = component.id OR r.id_personne_cible = component.id
      JOIN type_relation tr ON tr.id = r.id_type_relation
      WHERE tr.code = ANY($2::text[])
        AND NOT (CASE WHEN r.id_personne_source = component.id
          THEN r.id_personne_cible ELSE r.id_personne_source END = ANY(component.path))
    )
    SELECT DISTINCT id FROM component ORDER BY id`,
    [seeds, [...FAMILY_CODES]],
  );
  return result.rows.map((row) => row.id);
}

async function lockFamilyComponentInTransaction(seedIds) {
  let ids = [...new Set(seedIds.filter(Boolean))].sort();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const componentIds = await getConnectedFamilyPersonIds(ids);
    const nextIds = [...new Set([...ids, ...componentIds])].sort();
    await database.query(
      `SELECT id FROM personne WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [nextIds],
    );
    const stableIds = await getConnectedFamilyPersonIds(nextIds);
    const merged = [...new Set([...nextIds, ...stableIds])].sort();
    if (merged.length === nextIds.length && merged.every((id, index) => id === nextIds[index])) {
      return merged;
    }
    ids = merged;
  }
  throw businessError(
    "Le composant familial a changé pendant sa réconciliation",
    "FAMILY_PROPAGATION_CONFLICT",
  );
}

async function getFamilyRelationsForPersonIds(personIds) {
  if (!personIds.length) return [];
  const result = await database.query(
    `SELECT
      r.id,
      r.id_personne_source,
      r.id_personne_cible,
      r.id_type_relation,
      r.id_compte_createur,
      r.origine,
      tr.code
    FROM relation_personne r
    JOIN type_relation tr ON tr.id = r.id_type_relation
    WHERE tr.code = ANY($1::text[])
      AND r.id_personne_source = ANY($2::uuid[])
      AND r.id_personne_cible = ANY($2::uuid[])
    ORDER BY r.id`,
    [[...FAMILY_CODES], personIds],
  );
  return result.rows;
}

async function normalizeManualInversesInTransaction(rows, types, idCompteCreateur) {
  const byKey = new Map(rows.map((row) => [familyRelationKey(row.id_personne_source, row.id_personne_cible), row]));
  for (const row of rows.filter((item) => item.origine === "MANUELLE")) {
    const type = types.byCode.get(row.code);
    const inverseType = types.byId.get(type.id_inverse_defaut);
    const inverseKey = familyRelationKey(row.id_personne_cible, row.id_personne_source);
    const inverse = byKey.get(inverseKey);
    if (inverse && inverse.code !== inverseType.code) {
      throw businessError(
        "Une relation inverse incompatible existe dans la famille",
        "FAMILY_PROPAGATION_CONFLICT",
      );
    }
    if (inverse?.origine === "AUTO") {
      await database.query(
        `UPDATE relation_personne
         SET origine = 'MANUELLE', date_modification = now()
         WHERE id = $1`,
        [inverse.id],
      );
      await database.query(
        "DELETE FROM relation_personne_justification WHERE id_relation = $1",
        [inverse.id],
      );
      inverse.origine = "MANUELLE";
      continue;
    }
    if (inverse) continue;

    const inserted = await database.query(
      `INSERT INTO relation_personne (
        id_personne_source, id_personne_cible, id_type_relation,
        id_compte_createur, origine
      ) VALUES ($1, $2, $3, $4, 'MANUELLE')
      RETURNING id`,
      [row.id_personne_cible, row.id_personne_source, inverseType.id, idCompteCreateur ?? row.id_compte_createur],
    );
    byKey.set(inverseKey, {
      id: inserted.rows[0].id,
      id_personne_source: row.id_personne_cible,
      id_personne_cible: row.id_personne_source,
      id_type_relation: inverseType.id,
      id_compte_createur: idCompteCreateur ?? row.id_compte_createur,
      origine: "MANUELLE",
      code: inverseType.code,
    });
  }
}

function assertCalculatedParentCounts(state) {
  const parentsByChild = new Map();
  for (const relation of state.values()) {
    if (relation.code !== "PARENT") continue;
    if (!parentsByChild.has(relation.id_personne_source)) {
      parentsByChild.set(relation.id_personne_source, new Set());
    }
    parentsByChild.get(relation.id_personne_source).add(relation.id_personne_cible);
  }
  for (const parents of parentsByChild.values()) {
    if (parents.size > 2) {
      throw businessError(
        "Un enfant ne peut pas posséder plus de deux parents dans sa famille déclarée",
        "FAMILY_PROPAGATION_CONFLICT",
      );
    }
  }
  return parentsByChild;
}

function assertCalculatedConjoints(state) {
  const conjointByPerson = new Map();
  for (const relation of state.values()) {
    if (relation.code !== "CONJOINT") continue;
    if (!conjointByPerson.has(relation.id_personne_source)) {
      conjointByPerson.set(relation.id_personne_source, new Set());
    }
    conjointByPerson.get(relation.id_personne_source).add(relation.id_personne_cible);
  }
  for (const conjoints of conjointByPerson.values()) {
    if (conjoints.size > 1) {
      throw businessError(
        "Cette personne possède déjà un conjoint enregistré.",
        "CONJOINT_ALREADY_EXISTS",
      );
    }
  }
}

function getCalculatedFratrieGroups(state, personIds) {
  const adjacency = new Map(personIds.map((id) => [id, new Set()]));
  for (const relation of state.values()) {
    if (relation.code !== "FRATRIE") continue;
    adjacency.get(relation.id_personne_source)?.add(relation.id_personne_cible);
    adjacency.get(relation.id_personne_cible)?.add(relation.id_personne_source);
  }
  const groups = [];
  const visited = new Set();
  for (const personId of personIds) {
    if (visited.has(personId)) continue;
    const members = [];
    const queue = [personId];
    visited.add(personId);
    while (queue.length) {
      const current = queue.shift();
      members.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    groups.push(members.sort());
  }
  return groups;
}

function findFratriePathKeys(state, sourceId, cibleId) {
  if (sourceId === cibleId) return [];
  const adjacency = new Map();
  for (const relation of state.values()) {
    if (relation.code !== "FRATRIE") continue;
    const key = familyRelationKey(relation.id_personne_source, relation.id_personne_cible);
    for (const [from, to] of [[relation.id_personne_source, relation.id_personne_cible], [relation.id_personne_cible, relation.id_personne_source]]) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ to, key });
    }
  }
  const queue = [{ id: sourceId, keys: [] }];
  const visited = new Set([sourceId]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current.id) ?? []) {
      if (visited.has(next.to)) continue;
      const keys = [...current.keys, next.key];
      if (next.to === cibleId) return keys;
      visited.add(next.to);
      queue.push({ id: next.to, keys });
    }
  }
  return null;
}

function calculateExpectedAutoRelations({ manualRows, personIds, types }) {
  const manual = new Map(manualRows.map((row) => [familyRelationKey(row.id_personne_source, row.id_personne_cible), row]));
  const state = new Map(manual);
  const expected = new Map();

  function addOne(sourceId, cibleId, code, proofKeys) {
    const key = familyRelationKey(sourceId, cibleId);
    const manualRelation = manual.get(key);
    if (manualRelation && manualRelation.code !== code) {
      throw businessError("Une relation MANUELLE incompatible occupe déjà cette paire", "FAMILY_PROPAGATION_CONFLICT");
    }
    const current = state.get(key);
    if (current && current.code !== code) {
      throw businessError("Une relation incompatible existe déjà dans la famille", "FAMILY_PROPAGATION_CONFLICT");
    }
    if (manualRelation) return false;
    const normalizedProof = [...new Set(proofKeys)].sort();
    const currentExpected = expected.get(key);
    if (currentExpected) {
      if (relationProofKey(normalizedProof) < relationProofKey(currentExpected.proofKeys)) {
        currentExpected.proofKeys = normalizedProof;
      }
      return false;
    }
    const relation = {
      id_personne_source: sourceId,
      id_personne_cible: cibleId,
      id_type_relation: types.byCode.get(code).id,
      code,
      origine: "AUTO",
    };
    state.set(key, relation);
    expected.set(key, { ...relation, proofKeys: normalizedProof });
    return true;
  }

  function addPair(sourceId, cibleId, code, proofKeys) {
    const type = types.byCode.get(code);
    const inverse = types.byId.get(type.id_inverse_defaut);
    const directAdded = addOne(sourceId, cibleId, code, proofKeys);
    const inverseAdded = addOne(cibleId, sourceId, inverse.code, proofKeys);
    return directAdded || inverseAdded;
  }

  for (let iteration = 0; iteration < MAX_RECONCILIATION_ITERATIONS; iteration += 1) {
    let changed = false;
    assertCalculatedConjoints(state);
    const parentsByChild = assertCalculatedParentCounts(state);

    const couples = new Map();
    for (const relation of state.values()) {
      if (relation.code !== "CONJOINT") continue;
      const ids = [relation.id_personne_source, relation.id_personne_cible].sort();
      const key = ids.join(":");
      if (!couples.has(key)) couples.set(key, ids);
    }
    for (const [first, second] of couples.values()) {
      for (const [parentId, conjointId] of [[first, second], [second, first]]) {
        for (const [childId, parents] of parentsByChild) {
          if (parents.size !== 1 || !parents.has(parentId)) continue;
          changed = addPair(
            childId,
            conjointId,
            "PARENT",
            [familyRelationKey(childId, parentId), familyRelationKey(parentId, conjointId)],
          ) || changed;
        }
      }
    }

    for (const members of getCalculatedFratrieGroups(state, personIds)) {
      const parentSets = new Map(members.map((id) => [id, new Set(parentsByChild.get(id) ?? [])]));
      const coherentParents = getCoherentParentSet(parentSets);
      if (coherentParents.size > 2) {
        throw businessError("Un enfant ne peut pas posséder plus de deux parents dans sa famille déclarée", "FAMILY_PROPAGATION_CONFLICT");
      }
      for (const memberId of members) {
        for (const parentId of coherentParents) {
          if (parentSets.get(memberId).has(parentId)) continue;
          const ownerId = members.find((candidate) => parentSets.get(candidate).has(parentId));
          const path = findFratriePathKeys(state, ownerId, memberId);
          if (!ownerId || !path?.length) {
            throw businessError("Impossible de justifier la propagation des parents", "FAMILY_PROPAGATION_CONFLICT");
          }
          changed = addPair(
            memberId,
            parentId,
            "PARENT",
            [familyRelationKey(ownerId, parentId), ...path],
          ) || changed;
        }
      }
      for (let index = 0; index < members.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < members.length; otherIndex += 1) {
          const sourceId = members[index];
          const cibleId = members[otherIndex];
          if (state.has(familyRelationKey(sourceId, cibleId))) continue;
          const path = findFratriePathKeys(state, sourceId, cibleId);
          if (!path?.length) continue;
          changed = addPair(sourceId, cibleId, "FRATRIE", path) || changed;
        }
      }
    }

    if (!changed) return { expected, state };
  }
  throw businessError("La réconciliation familiale n'a pas convergé", "FAMILY_PROPAGATION_CONFLICT");
}

async function refreshAutoJustificationsInTransaction(personIds, expected) {
  const rows = await getFamilyRelationsForPersonIds(personIds);
  const byKey = new Map(rows.map((row) => [familyRelationKey(row.id_personne_source, row.id_personne_cible), row]));
  const autoIds = rows.filter((row) => row.origine === "AUTO").map((row) => row.id);
  if (autoIds.length) {
    await database.query(
      "DELETE FROM relation_personne_justification WHERE id_relation = ANY($1::uuid[])",
      [autoIds],
    );
  }
  for (const relation of expected.values()) {
    const target = byKey.get(familyRelationKey(relation.id_personne_source, relation.id_personne_cible));
    if (!target || target.origine !== "AUTO") continue;
    const sourceIds = relation.proofKeys
      .map((key) => byKey.get(key)?.id)
      .filter((id) => id && id !== target.id);
    await addAutoJustifications(target.id, sourceIds);
  }
}

export async function reconcileFamilyInTransaction({ personneIds, idCompteCreateur }) {
  const personIds = await lockFamilyComponentInTransaction(personneIds);
  if (!personIds.length) return;
  const types = await getFamilyTypesInTransaction();
  let rows = await getFamilyRelationsForPersonIds(personIds);
  await normalizeManualInversesInTransaction(rows, types, idCompteCreateur);
  rows = await getFamilyRelationsForPersonIds(personIds);

  const manualRows = rows.filter((row) => row.origine === "MANUELLE");
  const { expected } = calculateExpectedAutoRelations({ manualRows, personIds, types });
  const existingAuto = rows.filter((row) => row.origine === "AUTO");
  const obsoleteAutoIds = existingAuto
    .filter((row) => {
      const expectedRelation = expected.get(familyRelationKey(row.id_personne_source, row.id_personne_cible));
      return !expectedRelation || expectedRelation.code !== row.code;
    })
    .map((row) => row.id);
  if (obsoleteAutoIds.length) {
    await database.query("DELETE FROM relation_personne WHERE id = ANY($1::uuid[])", [obsoleteAutoIds]);
  }

  rows = await getFamilyRelationsForPersonIds(personIds);
  const currentByKey = new Map(rows.map((row) => [familyRelationKey(row.id_personne_source, row.id_personne_cible), row]));
  for (const relation of expected.values()) {
    const current = currentByKey.get(familyRelationKey(relation.id_personne_source, relation.id_personne_cible));
    if (current?.origine === "MANUELLE") {
      if (current.code !== relation.code) {
        throw businessError("Une relation MANUELLE incompatible occupe déjà cette paire", "FAMILY_PROPAGATION_CONFLICT");
      }
      continue;
    }
    if (current) continue;
    const inserted = await database.query(
      `INSERT INTO relation_personne (
        id_personne_source, id_personne_cible, id_type_relation,
        id_compte_createur, origine
      ) VALUES ($1, $2, $3, $4, 'AUTO')
      RETURNING id`,
      [
        relation.id_personne_source,
        relation.id_personne_cible,
        relation.id_type_relation,
        idCompteCreateur ?? null,
      ],
    );
    currentByKey.set(familyRelationKey(relation.id_personne_source, relation.id_personne_cible), {
      ...relation,
      id: inserted.rows[0].id,
    });
  }
  await refreshAutoJustificationsInTransaction(personIds, expected);
}
async function getRelationRawById(id) {
  const result = await database.query(
    `SELECT id, id_personne_source, id_personne_cible, id_type_relation,
      id_compte_createur, origine
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
        origine: result.rows[0].origine,
      })
    : null;
}

async function getInverseRelationRaw(sourceId, cibleId, typeId) {
  const result = await database.query(
    `SELECT id, id_personne_source, id_personne_cible, id_type_relation,
      id_compte_createur, origine
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
        origine: result.rows[0].origine,
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

function canManageRelation(source, auth) {
  // Une relation est gérée depuis la fiche source. Les droits suivent donc
  // exactement ceux de cette personne : ADMIN/créateur historique si elle
  // n'a pas de compte, propriétaire exclusif si elle en possède un.
  return canManagePersonneRecord(source, auth);
}

async function promoteAutoRelationPairInTransaction({ sourceId, cibleId, typeRelation, auth }) {
  const inverseTypeId = resolveInverseType(typeRelation);
  const direct = await getRelationByPair(sourceId, cibleId);
  if (!direct || direct.id_type_relation !== typeRelation.id || direct.origine !== "AUTO") {
    throw businessError("Une relation familiale existe déjà entre ces deux personnes", "RELATION_EXISTS");
  }
  const inverse = await getRelationByPair(cibleId, sourceId);
  if (inverse && inverse.id_type_relation !== inverseTypeId) {
    throw businessError("Une relation incompatible existe déjà entre ces deux personnes", "FAMILY_PROPAGATION_CONFLICT");
  }

  await database.query(
    `UPDATE relation_personne
     SET origine = 'MANUELLE', date_modification = now()
     WHERE id = $1`,
    [direct.id],
  );
  await database.query(
    "DELETE FROM relation_personne_justification WHERE id_relation = $1",
    [direct.id],
  );
  if (inverse?.origine === "AUTO") {
    await database.query(
      `UPDATE relation_personne
       SET origine = 'MANUELLE', date_modification = now()
       WHERE id = $1`,
      [inverse.id],
    );
    await database.query(
      "DELETE FROM relation_personne_justification WHERE id_relation = $1",
      [inverse.id],
    );
  } else if (!inverse) {
    await database.query(
      `INSERT INTO relation_personne (
        id_personne_source, id_personne_cible, id_type_relation,
        id_compte_createur, origine
      ) VALUES ($1, $2, $3, $4, 'MANUELLE')`,
      [cibleId, sourceId, inverseTypeId, auth.compte.id],
    );
  }
  return direct.id;
}
export async function createRelationPersonneInTransaction(
  relation,
  lang = "fr",
  auth = null,
  { reconcile = true } = {},
) {
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

    if (!canManageRelation(source, auth)) {
      throw authorizationError("creer");
    }

    if (!typeRelation) {
      throw businessError(
        "Type de relation introuvable",
        "TYPE_RELATION_NOT_FOUND",
      );
    }

    if (existing) {
      if (existing.id === undefined) {
        throw businessError("Une relation familiale existe déjà entre ces deux personnes", "RELATION_EXISTS");
      }
      const existingRelation = await getRelationByPair(
        relation.id_personne_source,
        relation.id_personne_cible,
      );
      if (
        existingRelation?.id_type_relation === typeRelation.id
        && existingRelation.origine === "AUTO"
      ) {
        const relationId = await promoteAutoRelationPairInTransaction({
          sourceId: relation.id_personne_source,
          cibleId: relation.id_personne_cible,
          typeRelation,
          auth,
        });
        if (reconcile) {
          await reconcileFamilyInTransaction({
            personneIds: [relation.id_personne_source, relation.id_personne_cible],
            idCompteCreateur: auth.compte.id,
          });
        }
        return getRelationPersonneById(relationId, lang);
      }
      throw businessError(
        "Une relation familiale existe déjà entre ces deux personnes",
        "RELATION_EXISTS",
      );
    }

    if (typeRelation.code === "CONJOINT") {
      await assertConjointAvailableInTransaction(
        relation.id_personne_source,
        relation.id_personne_cible,
      );
    }

    const inverseTypeId = resolveInverseType(typeRelation);
    const direct = await database.query(
      `INSERT INTO relation_personne (
        id_personne_source,
        id_personne_cible,
        id_type_relation,
        id_compte_createur,
        origine
      )
      VALUES ($1, $2, $3, $4, 'MANUELLE')
      RETURNING id`,
      [
        relation.id_personne_source,
        relation.id_personne_cible,
        relation.id_type_relation,
        auth.compte.id,
      ],
    );

    const inverse = await getRelationByPair(
      relation.id_personne_cible,
      relation.id_personne_source,
    );
    if (inverse && inverse.id_type_relation !== inverseTypeId) {
      throw businessError("Une relation inverse incompatible existe dans la famille", "FAMILY_PROPAGATION_CONFLICT");
    }
    if (inverse?.origine === "AUTO") {
      await database.query(
        `UPDATE relation_personne
         SET origine = 'MANUELLE', date_modification = now()
         WHERE id = $1`,
        [inverse.id],
      );
      await database.query(
        "DELETE FROM relation_personne_justification WHERE id_relation = $1",
        [inverse.id],
      );
    } else if (!inverse) {
      await database.query(
        `INSERT INTO relation_personne (
          id_personne_source,
          id_personne_cible,
          id_type_relation,
          id_compte_createur,
          origine
        )
        VALUES ($1, $2, $3, $4, 'MANUELLE')`,
        [
          relation.id_personne_cible,
          relation.id_personne_source,
          inverseTypeId,
          auth.compte.id,
        ],
      );
    }

    const relationId = direct.rows[0].id;
    if (reconcile) {
      await reconcileFamilyInTransaction({
        personneIds: [
          relation.id_personne_source,
          relation.id_personne_cible,
        ],
        idCompteCreateur: auth.compte.id,
      });
    }
    return getRelationPersonneById(relationId, lang);
}

export async function createRelationPersonne(relation, lang = "fr", auth = null) {
  return database.transaction(() =>
    createRelationPersonneInTransaction(relation, lang, auth),
  );
}

async function deleteRelationPairInTransaction({ sourceId, cibleId, typeId }) {
  const type = await getTypeRelationForInverse(typeId);
  if (!type) throw businessError("Type de relation introuvable", "TYPE_RELATION_NOT_FOUND");
  const inverseTypeId = resolveInverseType(type);
  await database.query(
    `DELETE FROM relation_personne
     WHERE id_personne_source = $1
       AND id_personne_cible = $2
       AND id_type_relation = $3`,
    [sourceId, cibleId, typeId],
  );
  await database.query(
    `DELETE FROM relation_personne
     WHERE id_personne_source = $1
       AND id_personne_cible = $2
       AND id_type_relation = $3`,
    [cibleId, sourceId, inverseTypeId],
  );
}

export async function synchronizePersonneRelationsInTransaction({
  idPersonne,
  relations,
  lang = "fr",
  auth = null,
}) {
  const existing = await getRelationsPersonneByPersonne(idPersonne, lang);
  const existingByKey = new Map(existing.map((relation) => [
    `${relation.id_personne_cible}:${relation.id_type_relation}`,
    relation,
  ]));
  const requestedByKey = new Map();
  for (const item of relations) {
    const key = `${item.id_personne_liee}:${item.id_type_relation}`;
    requestedByKey.set(key, item);
  }

  const seeds = new Set([idPersonne]);
  for (const item of relations) seeds.add(item.id_personne_liee);
  for (const relation of existing) seeds.add(relation.id_personne_cible);

  for (const relation of existing.filter((item) => item.origine === "MANUELLE")) {
    const key = `${relation.id_personne_cible}:${relation.id_type_relation}`;
    if (requestedByKey.has(key)) continue;
    await deleteRelationPairInTransaction({
      sourceId: idPersonne,
      cibleId: relation.id_personne_cible,
      typeId: relation.id_type_relation,
    });
  }

  for (const item of relations) {
    const key = `${item.id_personne_liee}:${item.id_type_relation}`;
    const existingExact = existingByKey.get(key);
    if (existingExact?.origine === "MANUELLE") continue;
    if (existingExact?.origine === "AUTO") {
      if (item.action === "CONFIRMER_MANUELLE") {
        await createRelationPersonneInTransaction(
          new RelationPersonne({
            id_personne_source: idPersonne,
            id_personne_cible: item.id_personne_liee,
            id_type_relation: item.id_type_relation,
          }),
          lang,
          auth,
          { reconcile: false },
        );
      }
      continue;
    }

    const occupied = await getRelationByPair(idPersonne, item.id_personne_liee);
    if (occupied) {
      throw businessError("Une relation incompatible existe déjà entre ces deux personnes", "FAMILY_PROPAGATION_CONFLICT");
    }
    await createRelationPersonneInTransaction(
      new RelationPersonne({
        id_personne_source: idPersonne,
        id_personne_cible: item.id_personne_liee,
        id_type_relation: item.id_type_relation,
      }),
      lang,
      auth,
      { reconcile: false },
    );
  }

  return [...seeds];
}
export async function updateRelationPersonneType(
  id,
  idTypeRelation,
  lang = "fr",
  auth = null,
) {
  const relationId = await database.transaction(async () => {
    const relation = await getRelationRawById(id);
    if (!relation) return null;

    const [source, cible, oldTypeRelation, newTypeRelation] = await Promise.all([
      getPersonneForRelation(relation.id_personne_source),
      getPersonneForRelation(relation.id_personne_cible),
      getTypeRelationForInverse(relation.id_type_relation),
      getTypeRelationForInverse(idTypeRelation),
    ]);
    if (!source || !oldTypeRelation) {
      throw businessError("Impossible de déterminer la relation inverse", "INVERSE_NOT_CONFIGURED");
    }
    if (!newTypeRelation) throw businessError("Type de relation introuvable", "TYPE_RELATION_NOT_FOUND");
    if (!cible || !canManageRelation(source, auth)) throw authorizationError("modifier");
    if (newTypeRelation.code === "CONJOINT") {
      await assertConjointAvailableInTransaction(relation.id_personne_source, relation.id_personne_cible);
    }

    const oldInverseTypeId = resolveInverseType(oldTypeRelation);
    const newInverseTypeId = resolveInverseType(newTypeRelation);
    const inverse = await getInverseRelationRaw(
      relation.id_personne_cible,
      relation.id_personne_source,
      oldInverseTypeId,
    );
    if (inverse && inverse.id_type_relation !== oldInverseTypeId) {
      throw businessError("Une relation inverse incompatible existe dans la famille", "FAMILY_PROPAGATION_CONFLICT");
    }

    await database.query(
      `UPDATE relation_personne
       SET id_type_relation = $1, origine = 'MANUELLE', date_modification = now()
       WHERE id = $2`,
      [idTypeRelation, relation.id],
    );
    await database.query("DELETE FROM relation_personne_justification WHERE id_relation = $1", [relation.id]);

    if (inverse) {
      await database.query(
        `UPDATE relation_personne
         SET id_type_relation = $1, origine = 'MANUELLE', date_modification = now()
         WHERE id = $2`,
        [newInverseTypeId, inverse.id],
      );
      await database.query("DELETE FROM relation_personne_justification WHERE id_relation = $1", [inverse.id]);
    } else {
      await database.query(
        `INSERT INTO relation_personne (
          id_personne_source, id_personne_cible, id_type_relation,
          id_compte_createur, origine
        ) VALUES ($1, $2, $3, $4, 'MANUELLE')`,
        [
          relation.id_personne_cible,
          relation.id_personne_source,
          newInverseTypeId,
          auth.compte.id,
        ],
      );
    }

    await reconcileFamilyInTransaction({
      personneIds: [relation.id_personne_source, relation.id_personne_cible],
      idCompteCreateur: auth.compte.id,
    });
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

    if (!cible || !canManageRelation(source, auth)) {
      throw authorizationError("supprimer");
    }

    const relationEnrichie = await getRelationPersonneById(id, lang);
    const inverseTypeId = resolveInverseType(typeRelation);

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

    await reconcileFamilyInTransaction({
      personneIds: [relation.id_personne_source, relation.id_personne_cible],
      idCompteCreateur: auth.compte.id,
    });
    return relationEnrichie;
  });
}
