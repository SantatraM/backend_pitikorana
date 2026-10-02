import database from "../config/db.js";
import JourneeAlahadinTaranaka from "../models/JourneeAlahadinTaranaka.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeJourneeId(id) {
  if (!isUuid(id)) {
    throw businessError("Identifiant de journée invalide.", "JOURNEE_INVALID");
  }

  return id.toLowerCase();
}

function normalizeTaranakaIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw businessError(
      "Au moins un Taranaka doit être associé à la journée.",
      "JOURNEE_TARANAKA_REQUIRED",
    );
  }

  const ids = value.map((id) => {
    if (!isUuid(id)) {
      throw businessError("Identifiant de Taranaka invalide.", "JOURNEE_TARANAKA_INVALID");
    }

    return id.toLowerCase();
  });

  if (new Set(ids).size !== ids.length) {
    throw businessError("Un Taranaka ne peut être associé qu'une seule fois.", "JOURNEE_TARANAKA_DUPLICATE");
  }

  return ids;
}

function normalizePayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw businessError("Les données de la journée sont invalides.", "JOURNEE_INVALID");
  }

  let journee;
  try {
    journee = new JourneeAlahadinTaranaka({
      date_journee: payload.date_journee,
      observation: payload.observation,
    });
  } catch (error) {
    throw businessError(error.message, "JOURNEE_INVALID");
  }

  return {
    dateJournee: journee.date_journee,
    observation: journee.observation,
    taranakaIds: normalizeTaranakaIds(payload.id_taranaka),
  };
}

const journeeSelect = `
  SELECT
    j.id,
    j.date_journee,
    j.statut,
    j.observation,
    j.id_compte_createur,
    j.date_creation,
    j.date_modification,
    CASE
      WHEN cm.id IS NULL THEN NULL
      ELSE json_build_object(
        'id', cm.id,
        'personne', CASE
          WHEN p.id IS NULL THEN NULL
          ELSE json_build_object(
            'id', p.id,
            'nom', p.nom,
            'prenom', p.prenom
          )
        END
      )
    END AS createur,
    COALESCE(
      json_agg(
        json_build_object('id', e.id, 'nom', e.nom)
        ORDER BY e.nom ASC, e.id ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::json
    ) AS taranaka
  FROM journee_alahadin_taranaka j
  LEFT JOIN compte_membre cm ON cm.id = j.id_compte_createur
  LEFT JOIN personne p ON p.id = cm.id_personne
  LEFT JOIN journee_alahadin_taranaka_taranaka jt ON jt.id_journee = j.id
  LEFT JOIN element e ON e.id = jt.id_taranaka
`;

function mapJournee(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    date_journee: row.date_journee,
    statut: row.statut,
    observation: row.observation,
    id_compte_createur: row.id_compte_createur,
    date_creation: row.date_creation,
    date_modification: row.date_modification,
    createur: row.createur,
    taranaka: row.taranaka ?? [],
  };
}

async function validateTaranakaIds(taranakaIds) {
  const result = await database.query(
    `
      SELECT e.id, te.code
      FROM element e
      JOIN type_element te ON te.id = e.id_type_element
      WHERE e.id = ANY($1::uuid[])
    `,
    [taranakaIds],
  );

  const foundById = new Map(result.rows.map((row) => [row.id, row.code]));

  for (const id of taranakaIds) {
    const code = foundById.get(id);

    if (!code) {
      throw businessError("Le Taranaka sélectionné est introuvable.", "JOURNEE_TARANAKA_NOT_FOUND");
    }

    if (code !== "TARANAKA") {
      throw businessError("L'élément sélectionné doit être un Taranaka.", "JOURNEE_TARANAKA_INVALID");
    }
  }
}

async function insertTaranakaAssociations(journeeId, taranakaIds) {
  for (const taranakaId of taranakaIds) {
    await database.query(
      `
        INSERT INTO journee_alahadin_taranaka_taranaka (id_journee, id_taranaka)
        VALUES ($1, $2)
      `,
      [journeeId, taranakaId],
    );
  }
}

async function getJourneeRowById(id, { forUpdate = false } = {}) {
  const result = await database.query(
    `
      SELECT id, statut
      FROM journee_alahadin_taranaka
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function transitionJournee(id, from, to) {
  const journeeId = normalizeJourneeId(id);

  return database.transaction(async () => {
    const current = await getJourneeRowById(journeeId, { forUpdate: true });

    if (!current) {
      throw businessError("Journée introuvable.", "JOURNEE_NOT_FOUND");
    }

    if (current.statut !== from) {
      throw businessError("La transition de statut de la journée est invalide.", "JOURNEE_TRANSITION_INVALID");
    }

    if (to === "OUVERTE") {
      const associationResult = await database.query(
        `
          SELECT 1
          FROM journee_alahadin_taranaka_taranaka
          WHERE id_journee = $1
          LIMIT 1
        `,
        [journeeId],
      );

      if (associationResult.rowCount === 0) {
        throw businessError(
          "Au moins un Taranaka doit être associé avant l'ouverture de la journée.",
          "JOURNEE_TARANAKA_REQUIRED",
        );
      }
    }

    await database.query(
      `
        UPDATE journee_alahadin_taranaka
        SET statut = $2,
            date_modification = now()
        WHERE id = $1
      `,
      [journeeId, to],
    );

    return getJourneeAlahadinTaranakaById(journeeId);
  });
}

export async function createJourneeAlahadinTaranaka(payload, idCompteCreateur) {
  if (!isUuid(idCompteCreateur)) {
    throw businessError("Compte créateur introuvable.", "JOURNEE_INVALID");
  }

  const { dateJournee, observation, taranakaIds } = normalizePayload(payload);

  return database.transaction(async () => {
    await validateTaranakaIds(taranakaIds);

    const created = await database.query(
      `
        INSERT INTO journee_alahadin_taranaka (
          date_journee,
          statut,
          observation,
          id_compte_createur
        )
        VALUES ($1, 'BROUILLON', $2, $3)
        RETURNING id
      `,
      [dateJournee, observation, idCompteCreateur],
    );

    const journeeId = created.rows[0].id;
    await insertTaranakaAssociations(journeeId, taranakaIds);

    return getJourneeAlahadinTaranakaById(journeeId);
  });
}

export async function getJourneesAlahadinTaranaka() {
  const result = await database.query(
    `
      ${journeeSelect}
      GROUP BY j.id, cm.id, p.id
      ORDER BY j.date_journee DESC, j.date_creation DESC, j.id DESC
    `,
  );

  return result.rows.map(mapJournee);
}

export async function getJourneeAlahadinTaranakaById(id) {
  const journeeId = normalizeJourneeId(id);
  const result = await database.query(
    `
      ${journeeSelect}
      WHERE j.id = $1
      GROUP BY j.id, cm.id, p.id
    `,
    [journeeId],
  );

  return mapJournee(result.rows[0]);
}

export async function updateJourneeAlahadinTaranaka(id, payload) {
  const journeeId = normalizeJourneeId(id);
  const { dateJournee, observation, taranakaIds } = normalizePayload(payload);

  return database.transaction(async () => {
    const current = await getJourneeRowById(journeeId, { forUpdate: true });

    if (!current) {
      throw businessError("Journée introuvable.", "JOURNEE_NOT_FOUND");
    }

    if (current.statut !== "BROUILLON") {
      throw businessError("Seule une journée en brouillon peut être modifiée.", "JOURNEE_STATE_INVALID");
    }

    await validateTaranakaIds(taranakaIds);

    await database.query(
      `
        UPDATE journee_alahadin_taranaka
        SET date_journee = $2,
            observation = $3,
            date_modification = now()
        WHERE id = $1
      `,
      [journeeId, dateJournee, observation],
    );

    await database.query(
      `
        DELETE FROM journee_alahadin_taranaka_taranaka
        WHERE id_journee = $1
      `,
      [journeeId],
    );

    await insertTaranakaAssociations(journeeId, taranakaIds);

    return getJourneeAlahadinTaranakaById(journeeId);
  });
}

export async function ouvrirJourneeAlahadinTaranaka(id) {
  return transitionJournee(id, "BROUILLON", "OUVERTE");
}

export async function cloturerJourneeAlahadinTaranaka(id) {
  return transitionJournee(id, "OUVERTE", "CLOTUREE");
}

export async function rouvrirJourneeAlahadinTaranaka(id) {
  return transitionJournee(id, "CLOTUREE", "OUVERTE");
}