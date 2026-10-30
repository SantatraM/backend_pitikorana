import database from "../config/db.js";

const TETIKASA_CREATOR_ROLES = new Set(["ADMIN", "PASTEUR"]);
const DRAFT_STATUS = "DRAFITRA";
const COLLECTION_LIMITS = {
  responsables: 50,
  actions: 200,
  ressources: 200,
  budget: 200,
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getCreator(auth) {
  if (!auth?.personne?.id) {
    throw businessError("Authentification requise", "AUTH_REQUIRED");
  }
  if (!TETIKASA_CREATOR_ROLES.has(auth?.compte?.role)) {
    throw businessError("Accès interdit", "TETIKASA_FORBIDDEN");
  }
  return auth.personne.id;
}

function assertPlainObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw businessError(message, "TETIKASA_INVALID");
  }
}

function assertAllowedFields(value, fields, message) {
  if (Object.keys(value).some((field) => !fields.has(field))) {
    throw businessError(message, "TETIKASA_INVALID");
  }
}

function normalizeUuid(value, label, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw businessError(`${label} est obligatoire`, "TETIKASA_INVALID");
    return null;
  }
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  return value.trim();
}

function normalizeText(value, label, maxLength, { nullable = true } = {}) {
  if ((value === null || value === undefined) && nullable) return null;
  if (typeof value !== "string") {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  const normalized = value.trim();
  if ((!normalized && !nullable) || normalized.length > maxLength) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  return normalized || null;
}

function normalizeDate(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  return value;
}

function assertDateRange(start, end, label) {
  if (start && end && end < start) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
}

function normalizeDecimal(value, label, { required = false, precision, scale, min = null } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw businessError(`${label} est obligatoire`, "TETIKASA_INVALID");
    return null;
  }
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  const normalized = String(value).trim();
  const [integer, fraction = ""] = normalized.split(".");
  if (integer.length + fraction.length > precision || fraction.length > scale) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || (min !== null && numeric < min)) {
    throw businessError(`${label} est invalide`, "TETIKASA_INVALID");
  }
  return normalized.includes(".")
    ? normalized.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "")
    : normalized;
}

function normalizeOrder(items, normalizer) {
  return items
    .map((item, index) => ({ item: normalizer(item, index), inputOrder: item?.ordre ?? index + 1, index }))
    .map((entry) => {
      if (!Number.isInteger(entry.inputOrder) || entry.inputOrder <= 0) {
        throw businessError("Ordre invalide", "TETIKASA_INVALID");
      }
      return entry;
    })
    .sort((left, right) => left.inputOrder - right.inputOrder || left.index - right.index)
    .map(({ item }, index) => ({ ...item, ordre: index + 1 }));
}

function normalizeCollection(value, name, normalizer) {
  if (!Array.isArray(value) || value.length > COLLECTION_LIMITS[name]) {
    throw businessError(`La collection ${name} est invalide`, "TETIKASA_INVALID");
  }
  return normalizeOrder(value, normalizer);
}

function normalizeResponsables(value) {
  const responsables = normalizeCollection(value, "responsables", (item) => {
    assertPlainObject(item, "Responsable invalide");
    assertAllowedFields(item, new Set(["id_personne", "type_responsabilite"]), "Responsable invalide");
    const type = typeof item.type_responsabilite === "string"
      ? item.type_responsabilite.trim().toUpperCase()
      : "";
    if (!["PRINCIPAL", "ASSOCIE"].includes(type)) {
      throw businessError("Type de responsabilité invalide", "TETIKASA_INVALID");
    }
    return {
      id_personne: normalizeUuid(item.id_personne, "Personne responsable", true),
      type_responsabilite: type,
    };
  });
  if (new Set(responsables.map((row) => row.id_personne)).size !== responsables.length) {
    throw businessError("Une personne ne peut être responsable qu'une fois", "TETIKASA_INVALID");
  }
  return responsables;
}

function normalizeActions(value) {
  return normalizeCollection(value, "actions", (item) => {
    assertPlainObject(item, "Action invalide");
    assertAllowedFields(
      item,
      new Set(["titre", "description", "id_responsable", "date_debut_prevue", "date_fin_prevue", "ordre"]),
      "Action invalide",
    );
    const start = normalizeDate(item.date_debut_prevue, "Date de début de l'action");
    const end = normalizeDate(item.date_fin_prevue, "Date de fin de l'action");
    assertDateRange(start, end, "Période de l'action");
    return {
      titre: normalizeText(item.titre, "Titre de l'action", 200, { nullable: false }),
      description: normalizeText(item.description, "Description de l'action", 100000),
      id_responsable: normalizeUuid(item.id_responsable, "Responsable de l'action"),
      date_debut_prevue: start,
      date_fin_prevue: end,
    };
  });
}

function normalizeRessources(value) {
  return normalizeCollection(value, "ressources", (item) => {
    assertPlainObject(item, "Ressource invalide");
    assertAllowedFields(
      item,
      new Set(["type_ressource", "description", "quantite", "unite", "observation", "ordre"]),
      "Ressource invalide",
    );
    const type = typeof item.type_ressource === "string" ? item.type_ressource.trim().toUpperCase() : "";
    if (!["OLONA", "FAHAIZA_MANAO", "FITAOVANA_ZAVATRA", "FITATERANA", "TOERANA", "HAFA"].includes(type)) {
      throw businessError("Type de ressource invalide", "TETIKASA_INVALID");
    }
    return {
      type_ressource: type,
      description: normalizeText(item.description, "Description de la ressource", 100000, { nullable: false }),
      quantite: normalizeDecimal(item.quantite, "Quantité de la ressource", { precision: 12, scale: 3, min: 0.000000001 }),
      unite: normalizeText(item.unite, "Unité de la ressource", 100),
      observation: normalizeText(item.observation, "Observation de la ressource", 100000),
    };
  });
}

function normalizeBudget(value) {
  return normalizeCollection(value, "budget", (item) => {
    assertPlainObject(item, "Ligne budget invalide");
    assertAllowedFields(
      item,
      new Set(["designation", "quantite", "prix_unitaire_estime", "ordre"]),
      "Ligne budget invalide",
    );
    return {
      designation: normalizeText(item.designation, "Désignation budget", 100000, { nullable: false }),
      quantite: normalizeDecimal(item.quantite, "Quantité budget", { required: true, precision: 12, scale: 3, min: 0.000000001 }),
      prix_unitaire_estime: normalizeDecimal(item.prix_unitaire_estime, "Prix unitaire estimé", { required: true, precision: 18, scale: 2, min: 0 }),
    };
  });
}

function mapExistingTetikasa(row, idSosoKevitra) {
  return {
    created: false,
    tetikasa: {
      id: row.id,
      statut: row.statut_code,
      id_soso_kevitra_source: idSosoKevitra,
    },
  };
}

async function getExistingTetikasa(idSosoKevitra) {
  const result = await database.query(
    `SELECT t.id, statut.code AS statut_code
    FROM tetikasa t
    JOIN statut_tetikasa statut ON statut.id = t.id_statut_tetikasa
    WHERE t.id_soso_kevitra_source = $1`,
    [idSosoKevitra],
  );
  return result.rows[0] ?? null;
}

export async function creerTetikasaDepuisSosoKevitra(idSosoKevitra, auth) {
  const idCreateur = getCreator(auth);

  try {
    return await database.transaction(async () => {
      const sourceResult = await database.query(
        `SELECT
          s.id,
          s.titre,
          s.description,
          s.raison,
          s.objectif,
          s.beneficiaires,
          s.lieu,
          s.lieu_non_defini,
          s.periode_souhaitee,
          s.ressources_necessaires,
          s.devise,
          statut.code AS statut_code,
          decision.decision AS decision_finale
        FROM soso_kevitra s
        JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
        LEFT JOIN soso_kevitra_decision decision ON decision.id_soso_kevitra = s.id
        WHERE s.id = $1
        FOR UPDATE OF s`,
        [idSosoKevitra],
      );
      const source = sourceResult.rows[0];
      if (!source) {
        throw businessError("Soso-kevitra introuvable", "SOSO_KEVITRA_NOT_FOUND");
      }

      const existing = await getExistingTetikasa(idSosoKevitra);
      if (existing) return mapExistingTetikasa(existing, idSosoKevitra);

      if (source.statut_code !== "ACCEPTE" || source.decision_finale !== "ACCEPTE") {
        throw businessError(
          "Seul un Soso-kevitra accepté peut devenir un Tetikasa",
          "SOSO_KEVITRA_NOT_ACCEPTED",
        );
      }

      const statutResult = await database.query(
        "SELECT id, code FROM statut_tetikasa WHERE code = 'DRAFITRA'",
      );
      const statut = statutResult.rows[0];
      if (!statut) {
        throw businessError("Statut Tetikasa DRAFITRA introuvable", "TETIKASA_STATUS_NOT_FOUND");
      }

      const tetikasaResult = await database.query(
        `INSERT INTO tetikasa (
          id_soso_kevitra_source,
          created_by,
          id_statut_tetikasa,
          titre,
          description,
          raison,
          objectif,
          beneficiaires,
          lieu,
          lieu_non_defini,
          periode_source_soso,
          ressources_source_soso,
          devise
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id`,
        [
          source.id,
          idCreateur,
          statut.id,
          source.titre,
          source.description,
          source.raison,
          source.objectif,
          source.beneficiaires,
          source.lieu,
          source.lieu_non_defini,
          source.periode_souhaitee,
          source.ressources_necessaires,
          source.devise,
        ],
      );
      const idTetikasa = tetikasaResult.rows[0].id;

      await database.query(
        `INSERT INTO tetikasa_action (
          id_tetikasa, titre, description, id_responsable,
          date_debut_prevue, date_fin_prevue, ordre
        )
        SELECT $1, description, NULL, NULL, NULL, NULL, ordre
        FROM soso_kevitra_action
        WHERE id_soso_kevitra = $2
        ORDER BY ordre ASC`,
        [idTetikasa, source.id],
      );

      await database.query(
        `INSERT INTO tetikasa_ligne_budget (
          id_tetikasa, designation, quantite, prix_unitaire_estime, ordre
        )
        SELECT $1, designation, quantite, prix_unitaire_estime, ordre
        FROM soso_kevitra_ligne_budget
        WHERE id_soso_kevitra = $2
        ORDER BY ordre ASC`,
        [idTetikasa, source.id],
      );

      await database.query(
        `INSERT INTO tetikasa_historique (
          id_tetikasa, action, id_acteur, commentaire
        ) VALUES ($1, 'CREATION_DRAFT', $2, $3)`,
        [idTetikasa, idCreateur, `Drafitra créé depuis le Soso-kevitra ${source.id}`],
      );

      return {
        created: true,
        tetikasa: {
          id: idTetikasa,
          statut: statut.code,
          id_soso_kevitra_source: source.id,
        },
      };
    });
  } catch (error) {
    if (error.code !== "23505") throw error;

    const existing = await getExistingTetikasa(idSosoKevitra);
    if (existing) return mapExistingTetikasa(existing, idSosoKevitra);
    throw error;
  }
}

const MAIN_EDITABLE_FIELDS = new Set([
  "titre",
  "description",
  "raison",
  "objectif",
  "beneficiaires",
  "lieu",
  "lieu_non_defini",
  "date_debut_prevue",
  "date_fin_prevue",
  "devise",
]);

function normalizeMainPatch(body) {
  assertPlainObject(body, "Données Tetikasa invalides");
  assertAllowedFields(body, MAIN_EDITABLE_FIELDS, "Un champ Tetikasa n'est pas modifiable");
  const patch = {};
  for (const field of MAIN_EDITABLE_FIELDS) {
    if (!Object.hasOwn(body, field)) continue;
    if (field === "lieu_non_defini") {
      if (typeof body[field] !== "boolean") {
        throw businessError("Indicateur de lieu invalide", "TETIKASA_INVALID");
      }
      patch[field] = body[field];
      continue;
    }
    if (field === "date_debut_prevue" || field === "date_fin_prevue") {
      patch[field] = normalizeDate(body[field], field);
      continue;
    }
    if (field === "devise") {
      if (typeof body[field] !== "string" || !/^[A-Za-z]{3}$/.test(body[field].trim())) {
        throw businessError("Devise invalide", "TETIKASA_INVALID");
      }
      patch[field] = body[field].trim().toUpperCase();
      continue;
    }
    patch[field] = normalizeText(body[field], field, field === "titre" ? 200 : 100000);
  }
  if (Object.keys(patch).length === 0) {
    throw businessError("Aucun champ Tetikasa à modifier", "TETIKASA_INVALID");
  }
  return patch;
}

async function getDraftForUpdate(idTetikasa) {
  const result = await database.query(
    `SELECT
      t.id,
      t.titre,
      t.description,
      t.raison,
      t.objectif,
      t.beneficiaires,
      t.lieu,
      t.lieu_non_defini,
      to_char(t.date_debut_prevue, 'YYYY-MM-DD') AS date_debut_prevue,
      to_char(t.date_fin_prevue, 'YYYY-MM-DD') AS date_fin_prevue,
      t.devise,
      statut.code AS statut_code
    FROM tetikasa t
    JOIN statut_tetikasa statut ON statut.id = t.id_statut_tetikasa
    WHERE t.id = $1
    FOR UPDATE OF t`,
    [idTetikasa],
  );
  return result.rows[0] ?? null;
}

function assertDraft(tetikasa) {
  if (tetikasa.statut_code !== DRAFT_STATUS) {
    throw businessError("Seul un Tetikasa au statut DRAFITRA peut être modifié", "TETIKASA_STATE_INVALID");
  }
}

function sameValue(left, right) {
  return (left ?? null) === (right ?? null);
}

async function addModificationHistory(idTetikasa, idActeur) {
  await database.query(
    `INSERT INTO tetikasa_historique (id_tetikasa, action, id_acteur)
    VALUES ($1, 'MODIFICATION_DRAFT', $2)`,
    [idTetikasa, idActeur],
  );
}

export async function updateTetikasaDraft(idTetikasa, body, auth) {
  const idActeur = getCreator(auth);
  const patch = normalizeMainPatch(body);

  return database.transaction(async () => {
    const tetikasa = await getDraftForUpdate(idTetikasa);
    if (!tetikasa) throw businessError("Tetikasa introuvable", "TETIKASA_NOT_FOUND");
    assertDraft(tetikasa);

    const next = { ...tetikasa, ...patch };
    assertDateRange(next.date_debut_prevue, next.date_fin_prevue, "Période prévisionnelle");
    const changedFields = Object.keys(patch).filter((field) => !sameValue(tetikasa[field], patch[field]));
    if (changedFields.length === 0) {
      return { modified: false, tetikasa: { id: tetikasa.id, statut: tetikasa.statut_code } };
    }

    const assignments = changedFields.map((field, index) => `${field} = $${index + 1}`);
    await database.query(
      `UPDATE tetikasa
      SET ${assignments.join(", ")}, date_modification = now()
      WHERE id = $${changedFields.length + 1}`,
      [...changedFields.map((field) => patch[field]), tetikasa.id],
    );
    await addModificationHistory(tetikasa.id, idActeur);
    return { modified: true, tetikasa: { id: tetikasa.id, statut: tetikasa.statut_code } };
  });
}

async function getCurrentContent(idTetikasa) {
  const [responsables, actions, ressources, budget] = await Promise.all([
    database.query(
      `SELECT id_personne, type_responsabilite
      FROM tetikasa_responsable
      WHERE id_tetikasa = $1
      ORDER BY CASE WHEN type_responsabilite = 'PRINCIPAL' THEN 0 ELSE 1 END, id_personne ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT titre, description, id_responsable,
        to_char(date_debut_prevue, 'YYYY-MM-DD') AS date_debut_prevue,
        to_char(date_fin_prevue, 'YYYY-MM-DD') AS date_fin_prevue,
        ordre
      FROM tetikasa_action
      WHERE id_tetikasa = $1
      ORDER BY ordre ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT type_ressource, description, quantite, unite, observation, ordre
      FROM tetikasa_ressource
      WHERE id_tetikasa = $1
      ORDER BY ordre ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT designation, quantite, prix_unitaire_estime, ordre
      FROM tetikasa_ligne_budget
      WHERE id_tetikasa = $1
      ORDER BY ordre ASC`,
      [idTetikasa],
    ),
  ]);
  return {
    responsables: responsables.rows.map((row) => ({
      id_personne: row.id_personne,
      type_responsabilite: row.type_responsabilite,
    })),
    actions: actions.rows.map((row) => ({ ...row, description: row.description ?? null, id_responsable: row.id_responsable ?? null })),
    ressources: ressources.rows.map((row) => ({
      ...row,
      quantite: row.quantite === null ? null : normalizeDecimal(row.quantite, "Quantité de la ressource", { precision: 12, scale: 3, min: 0.000000001 }),
      unite: row.unite ?? null,
      observation: row.observation ?? null,
    })),
    budget: budget.rows.map((row) => ({
      ...row,
      quantite: normalizeDecimal(row.quantite, "Quantité budget", { precision: 12, scale: 3, min: 0.000000001 }),
      prix_unitaire_estime: normalizeDecimal(row.prix_unitaire_estime, "Prix unitaire estimé", { precision: 18, scale: 2, min: 0 }),
    })),
  };
}

function sameCollection(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeCurrentResponsables(rows) {
  return rows
    .map((row) => ({
      id_personne: row.id_personne,
      type_responsabilite: row.type_responsabilite,
    }))
    .sort((left, right) => (
      left.type_responsabilite.localeCompare(right.type_responsabilite)
      || left.id_personne.localeCompare(right.id_personne)
    ));
}

async function assertPersonsExist(ids) {
  if (ids.length === 0) return;
  const result = await database.query(
    "SELECT id FROM personne WHERE id = ANY($1::uuid[])",
    [ids],
  );
  if (result.rows.length !== ids.length) {
    throw businessError("Une personne référencée est introuvable", "TETIKASA_PERSON_NOT_FOUND");
  }
}

function normalizeContentPatch(body) {
  assertPlainObject(body, "Contenu Tetikasa invalide");
  const fields = new Set(["responsables", "actions", "ressources", "budget"]);
  assertAllowedFields(body, fields, "Un champ de contenu Tetikasa n'est pas autorisé");
  const patch = {};
  if (Object.hasOwn(body, "responsables")) patch.responsables = normalizeResponsables(body.responsables);
  if (Object.hasOwn(body, "actions")) patch.actions = normalizeActions(body.actions);
  if (Object.hasOwn(body, "ressources")) patch.ressources = normalizeRessources(body.ressources);
  if (Object.hasOwn(body, "budget")) patch.budget = normalizeBudget(body.budget);
  if (Object.keys(patch).length === 0) {
    throw businessError("Aucune collection Tetikasa à modifier", "TETIKASA_INVALID");
  }
  return patch;
}

async function replaceResponsables(idTetikasa, rows) {
  await database.query("DELETE FROM tetikasa_responsable WHERE id_tetikasa = $1", [idTetikasa]);
  for (const row of rows) {
    await database.query(
      `INSERT INTO tetikasa_responsable (id_tetikasa, id_personne, type_responsabilite)
      VALUES ($1, $2, $3)`,
      [idTetikasa, row.id_personne, row.type_responsabilite],
    );
  }
}

async function replaceActions(idTetikasa, rows) {
  await database.query("DELETE FROM tetikasa_action WHERE id_tetikasa = $1", [idTetikasa]);
  return insertActions(idTetikasa, rows);
}

async function insertActions(idTetikasa, rows) {
  for (const row of rows) {
    await database.query(
      `INSERT INTO tetikasa_action (
        id_tetikasa, titre, description, id_responsable,
        date_debut_prevue, date_fin_prevue, ordre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [idTetikasa, row.titre, row.description, row.id_responsable, row.date_debut_prevue, row.date_fin_prevue, row.ordre],
    );
  }
}

async function replaceRessources(idTetikasa, rows) {
  await database.query("DELETE FROM tetikasa_ressource WHERE id_tetikasa = $1", [idTetikasa]);
  for (const row of rows) {
    await database.query(
      `INSERT INTO tetikasa_ressource (
        id_tetikasa, type_ressource, description, quantite, unite, observation, ordre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [idTetikasa, row.type_ressource, row.description, row.quantite, row.unite, row.observation, row.ordre],
    );
  }
}

async function replaceBudget(idTetikasa, rows) {
  await database.query("DELETE FROM tetikasa_ligne_budget WHERE id_tetikasa = $1", [idTetikasa]);
  for (const row of rows) {
    await database.query(
      `INSERT INTO tetikasa_ligne_budget (
        id_tetikasa, designation, quantite, prix_unitaire_estime, ordre
      ) VALUES ($1, $2, $3, $4, $5)`,
      [idTetikasa, row.designation, row.quantite, row.prix_unitaire_estime, row.ordre],
    );
  }
}

export async function updateTetikasaDraftContent(idTetikasa, body, auth) {
  const idActeur = getCreator(auth);
  const patch = normalizeContentPatch(body);

  return database.transaction(async () => {
    const tetikasa = await getDraftForUpdate(idTetikasa);
    if (!tetikasa) throw businessError("Tetikasa introuvable", "TETIKASA_NOT_FOUND");
    assertDraft(tetikasa);

    const current = await getCurrentContent(idTetikasa);
    const next = {
      responsables: patch.responsables ?? current.responsables,
      actions: patch.actions ?? current.actions,
      ressources: patch.ressources ?? current.ressources,
      budget: patch.budget ?? current.budget,
    };
    const principalCount = next.responsables.filter((row) => row.type_responsabilite === "PRINCIPAL").length;
    if (principalCount > 1) {
      throw businessError("Un seul responsable principal est autorisé", "TETIKASA_INVALID");
    }
    const responsibleIds = new Set(next.responsables.map((row) => row.id_personne));
    const actionResponsibleIds = next.actions
      .map((row) => row.id_responsable)
      .filter(Boolean);
    if (actionResponsibleIds.some((id) => !responsibleIds.has(id))) {
      throw businessError("Le responsable d'une action doit être responsable du Tetikasa", "TETIKASA_INVALID");
    }
    await assertPersonsExist([...new Set([...responsibleIds, ...actionResponsibleIds])]);

    const responsiblesChanged = Object.hasOwn(patch, "responsables")
      && !sameCollection(normalizeCurrentResponsables(current.responsables), normalizeCurrentResponsables(next.responsables));
    const actionsChanged = Object.hasOwn(patch, "actions") && !sameCollection(current.actions, next.actions);
    const ressourcesChanged = Object.hasOwn(patch, "ressources") && !sameCollection(current.ressources, next.ressources);
    const budgetChanged = Object.hasOwn(patch, "budget") && !sameCollection(current.budget, next.budget);
    const changed = responsiblesChanged || actionsChanged || ressourcesChanged || budgetChanged;
    if (!changed) {
      return { modified: false, tetikasa: { id: tetikasa.id, statut: tetikasa.statut_code } };
    }

    if (actionsChanged && responsiblesChanged) {
      await database.query("DELETE FROM tetikasa_action WHERE id_tetikasa = $1", [idTetikasa]);
      await replaceResponsables(idTetikasa, next.responsables);
      await insertActions(idTetikasa, next.actions);
    } else {
      if (actionsChanged) await replaceActions(idTetikasa, next.actions);
      if (responsiblesChanged) await replaceResponsables(idTetikasa, next.responsables);
    }
    if (ressourcesChanged) await replaceRessources(idTetikasa, next.ressources);
    if (budgetChanged) await replaceBudget(idTetikasa, next.budget);

    await database.query("UPDATE tetikasa SET date_modification = now() WHERE id = $1", [idTetikasa]);
    await addModificationHistory(idTetikasa, idActeur);
    return { modified: true, tetikasa: { id: tetikasa.id, statut: tetikasa.statut_code } };
  });
}

export async function getTetikasaById(idTetikasa, auth) {
  if (!auth?.personne?.id) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const mainResult = await database.query(
    `SELECT
      t.id,
      t.id_soso_kevitra_source,
      t.titre,
      t.description,
      t.raison,
      t.objectif,
      t.beneficiaires,
      t.lieu,
      t.lieu_non_defini,
      t.periode_source_soso,
      t.ressources_source_soso,
      to_char(t.date_debut_prevue, 'YYYY-MM-DD') AS date_debut_prevue,
      to_char(t.date_fin_prevue, 'YYYY-MM-DD') AS date_fin_prevue,
      t.devise,
      t.date_creation,
      t.date_modification,
      statut.id AS statut_id,
      statut.code AS statut_code,
      createur.id AS created_by_id,
      createur.nom AS created_by_nom,
      createur.prenom AS created_by_prenom,
      createur.nom_usage AS created_by_nom_usage
    FROM tetikasa t
    JOIN statut_tetikasa statut ON statut.id = t.id_statut_tetikasa
    JOIN personne createur ON createur.id = t.created_by
    WHERE t.id = $1`,
    [idTetikasa],
  );
  const main = mainResult.rows[0];
  if (!main) return null;
  const [responsables, actions, ressources, budget, total, historique] = await Promise.all([
    database.query(
      `SELECT r.id, r.type_responsabilite, r.date_creation,
        p.id AS personne_id, p.nom, p.prenom, p.nom_usage
      FROM tetikasa_responsable r
      JOIN personne p ON p.id = r.id_personne
      WHERE r.id_tetikasa = $1
      ORDER BY CASE WHEN r.type_responsabilite = 'PRINCIPAL' THEN 0 ELSE 1 END, r.date_creation ASC, r.id ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT id, titre, description, id_responsable,
        to_char(date_debut_prevue, 'YYYY-MM-DD') AS date_debut_prevue,
        to_char(date_fin_prevue, 'YYYY-MM-DD') AS date_fin_prevue,
        ordre
      FROM tetikasa_action
      WHERE id_tetikasa = $1
      ORDER BY ordre ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT id, type_ressource, description, quantite, unite, observation, ordre
      FROM tetikasa_ressource
      WHERE id_tetikasa = $1
      ORDER BY ordre ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT id, designation, quantite, prix_unitaire_estime, ordre
      FROM tetikasa_ligne_budget
      WHERE id_tetikasa = $1
      ORDER BY ordre ASC`,
      [idTetikasa],
    ),
    database.query(
      `SELECT COALESCE(SUM(quantite * prix_unitaire_estime), 0) AS total_budget_calcule
      FROM tetikasa_ligne_budget
      WHERE id_tetikasa = $1`,
      [idTetikasa],
    ),
    database.query(
      `SELECT h.id, h.action, h.commentaire, h.date_creation,
        p.id AS acteur_id, p.nom AS acteur_nom, p.prenom AS acteur_prenom, p.nom_usage AS acteur_nom_usage
      FROM tetikasa_historique h
      JOIN personne p ON p.id = h.id_acteur
      WHERE h.id_tetikasa = $1
      ORDER BY h.date_creation ASC, h.id ASC`,
      [idTetikasa],
    ),
  ]);
  return {
    id: main.id,
    id_soso_kevitra_source: main.id_soso_kevitra_source,
    titre: main.titre,
    description: main.description,
    raison: main.raison,
    objectif: main.objectif,
    beneficiaires: main.beneficiaires,
    lieu: main.lieu,
    lieu_non_defini: main.lieu_non_defini,
    periode_source_soso: main.periode_source_soso,
    ressources_source_soso: main.ressources_source_soso,
    date_debut_prevue: main.date_debut_prevue,
    date_fin_prevue: main.date_fin_prevue,
    devise: main.devise,
    date_creation: main.date_creation,
    date_modification: main.date_modification,
    statut: { id: main.statut_id, code: main.statut_code },
    created_by: {
      id: main.created_by_id,
      nom: main.created_by_nom,
      prenom: main.created_by_prenom,
      nom_usage: main.created_by_nom_usage,
    },
    responsables: responsables.rows.map((row) => ({
      id: row.id,
      type_responsabilite: row.type_responsabilite,
      date_creation: row.date_creation,
      personne: { id: row.personne_id, nom: row.nom, prenom: row.prenom, nom_usage: row.nom_usage },
    })),
    actions: actions.rows,
    ressources: ressources.rows,
    budget: budget.rows,
    total_budget_calcule: total.rows[0].total_budget_calcule,
    historique: historique.rows.map((row) => ({
      id: row.id,
      action: row.action,
      commentaire: row.commentaire,
      date_creation: row.date_creation,
      acteur: { id: row.acteur_id, nom: row.acteur_nom, prenom: row.acteur_prenom, nom_usage: row.acteur_nom_usage },
    })),
  };
}
