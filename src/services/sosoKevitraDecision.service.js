import database from "../config/db.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeDecision(value) {
  const decision = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!["ACCEPTE", "REFUSE"].includes(decision)) {
    throw businessError("La décision doit être ACCEPTE ou REFUSE", "DECISION_INVALID");
  }
  return decision;
}

function normalizeObservation(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw businessError("L'observation est invalide", "DECISION_INVALID");
  }
  return value.trim() || null;
}

export async function prendreDecisionFinale(idSosoKevitra, decisionInput, observationInput, personneAdmin) {
  if (!personneAdmin?.id) {
    throw businessError("Authentification requise", "AUTH_REQUIRED");
  }

  const decision = normalizeDecision(decisionInput);
  const observation = normalizeObservation(observationInput);

  return database.transaction(async () => {
    const propositionResult = await database.query(
      `SELECT s.id, s.date_publication, s.date_fin_consultation,
        statut.code AS statut_code, now() AS date_serveur
      FROM soso_kevitra s
      JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
      WHERE s.id = $1
      FOR UPDATE OF s`,
      [idSosoKevitra],
    );
    const proposition = propositionResult.rows[0];
    if (!proposition) {
      throw businessError("Soso-kevitra introuvable", "SOSO_KEVITRA_NOT_FOUND");
    }

    const existingDecision = await database.query(
      "SELECT id FROM soso_kevitra_decision WHERE id_soso_kevitra = $1 FOR UPDATE",
      [idSosoKevitra],
    );
    if (existingDecision.rows[0]) {
      throw businessError("Une décision finale existe déjà", "DECISION_ALREADY_EXISTS");
    }

    if (!proposition.date_publication || !proposition.date_fin_consultation) {
      throw businessError("Cette proposition n'a pas encore été publiée", "DECISION_STATE_INVALID");
    }
    if (!["EN_CONSULTATION", "A_L_ETUDE"].includes(proposition.statut_code)) {
      throw businessError("Cette proposition ne peut pas recevoir de décision finale", "DECISION_STATE_INVALID");
    }

    const consultationTerminee = await database.query(
      "SELECT now() >= $1::timestamptz AS terminee",
      [proposition.date_fin_consultation],
    );
    if (!consultationTerminee.rows[0].terminee) {
      throw businessError("La consultation est encore ouverte", "DECISION_CONSULTATION_OPEN");
    }

    const statusResult = await database.query(
      "SELECT id FROM statut_soso_kevitra WHERE code = $1",
      [decision],
    );
    if (!statusResult.rows[0]) {
      throw businessError("Statut de décision introuvable", "SOSO_KEVITRA_STATUS_NOT_FOUND");
    }

    const decisionResult = await database.query(
      `INSERT INTO soso_kevitra_decision (
        id_soso_kevitra, decision, observation, id_admin
      ) VALUES ($1, $2, $3, $4)
      RETURNING id, decision, observation, date_decision`,
      [idSosoKevitra, decision, observation, personneAdmin.id],
    );
    await database.query(
      `UPDATE soso_kevitra
      SET id_statut_soso_kevitra = $1, date_modification = now()
      WHERE id = $2`,
      [statusResult.rows[0].id, idSosoKevitra],
    );

    return {
      id: idSosoKevitra,
      decision_finale: decisionResult.rows[0],
    };
  });
}
