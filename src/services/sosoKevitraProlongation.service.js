import database from "../config/db.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeReason(raison) {
  if (typeof raison !== "string" || !raison.trim()) {
    throw businessError("La raison est obligatoire", "PROLONGATION_INVALID");
  }
  return raison.trim();
}

function normalizeDate(value) {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(new Date(value).getTime())) {
    throw businessError("La nouvelle date de fin est invalide", "PROLONGATION_INVALID");
  }
  return value;
}

export async function prolongerConsultation(idSosoKevitra, nouvelleDateFin, raison, personneAdmin) {
  if (!personneAdmin?.id) {
    throw businessError("Authentification requise", "AUTH_REQUIRED");
  }
  const dateFin = normalizeDate(nouvelleDateFin);
  const raisonNormalisee = normalizeReason(raison);

  return database.transaction(async () => {
    const propositionResult = await database.query(
      `SELECT s.*, statut.code AS statut_code, now() AS date_serveur
      FROM soso_kevitra s
      JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
      WHERE s.id = $1
      FOR UPDATE OF s`,
      [idSosoKevitra],
    );
    const proposition = propositionResult.rows[0];
    if (!proposition) throw businessError("Soso-kevitra introuvable", "SOSO_KEVITRA_NOT_FOUND");
    if (!proposition.date_publication || !["EN_CONSULTATION", "A_L_ETUDE"].includes(proposition.statut_code) || !proposition.date_fin_consultation) {
      throw businessError("Cette proposition ne peut pas être prolongée", "PROLONGATION_STATE_INVALID");
    }
    const decision = await database.query(
      "SELECT id FROM soso_kevitra_decision WHERE id_soso_kevitra = $1",
      [idSosoKevitra],
    );
    if (decision.rows[0]) throw businessError("Une décision finale existe déjà", "PROLONGATION_DECISION_EXISTS");
    const validation = await database.query(
      "SELECT $1::timestamptz > $2::timestamptz AND $1::timestamptz > now() AS valide",
      [dateFin, proposition.date_fin_consultation],
    );
    if (!validation.rows[0].valide) throw businessError("La nouvelle date doit être future et supérieure à la date actuelle", "PROLONGATION_INVALID");
    const statut = await database.query("SELECT id FROM statut_soso_kevitra WHERE code = 'EN_CONSULTATION'");
    if (!statut.rows[0]) throw businessError("Statut EN_CONSULTATION introuvable", "SOSO_KEVITRA_STATUS_NOT_FOUND");
    await database.query(
      `INSERT INTO soso_kevitra_prolongation (id_soso_kevitra, ancienne_date_fin, nouvelle_date_fin, raison, id_admin)
      VALUES ($1, $2, $3, $4, $5)`,
      [idSosoKevitra, proposition.date_fin_consultation, dateFin, raisonNormalisee, personneAdmin.id],
    );
    await database.query(
      `UPDATE soso_kevitra
      SET date_fin_consultation = $1, id_statut_soso_kevitra = $2, date_modification = now()
      WHERE id = $3`,
      [dateFin, statut.rows[0].id, idSosoKevitra],
    );
    return { id: idSosoKevitra, ancienne_date_fin_consultation: proposition.date_fin_consultation, nouvelle_date_fin_consultation: dateFin, raison: raisonNormalisee, consultation_ouverte: true, statut_fonctionnel: "EN_CONSULTATION" };
  });
}