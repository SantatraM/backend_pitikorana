import database from "../config/db.js";
import SosoKevitraSoutien from "../models/SosoKevitraSoutien.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function consultationOpen(row) {
  return row.statut_code === "EN_CONSULTATION"
    && row.date_fin_consultation !== null
    && new Date(row.date_serveur).getTime() < new Date(row.date_fin_consultation).getTime();
}

async function lockSosoKevitra(idSosoKevitra) {
  const result = await database.query(
    `SELECT s.id, s.id_auteur, s.date_fin_consultation,
      statut.code AS statut_code, now() AS date_serveur
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
    WHERE s.id = $1
    FOR UPDATE OF s`,
    [idSosoKevitra],
  );
  return result.rows[0] ?? null;
}

function assertConsultationOpen(row) {
  if (!consultationOpen(row)) {
    throw businessError("La consultation est fermée", "SOSO_KEVITRA_CONSULTATION_CLOSED");
  }
}

async function countSoutiens(idSosoKevitra) {
  const result = await database.query(
    "SELECT COUNT(*)::integer AS nombre_soutiens FROM soso_kevitra_soutien WHERE id_soso_kevitra = $1",
    [idSosoKevitra],
  );
  return result.rows[0].nombre_soutiens;
}

export async function addSoutienSosoKevitra(idSosoKevitra, auth) {
  const idPersonne = auth?.personne?.id;
  if (!idPersonne) throw businessError("Authentification requise", "AUTH_REQUIRED");

  try {
    return await database.transaction(async () => {
      const sosoKevitra = await lockSosoKevitra(idSosoKevitra);
      if (!sosoKevitra) return null;
      assertConsultationOpen(sosoKevitra);
      if (sosoKevitra.id_auteur === idPersonne) {
        throw businessError("L'auteur ne peut pas soutenir sa propre proposition", "SOSO_KEVITRA_AUTHOR_SUPPORT_FORBIDDEN");
      }
      await database.query(
        `INSERT INTO soso_kevitra_soutien (id_soso_kevitra, id_personne)
        VALUES ($1, $2)`,
        [idSosoKevitra, idPersonne],
      );
      return {
        nombre_soutiens: await countSoutiens(idSosoKevitra),
        utilisateur_soutient: true,
      };
    });
  } catch (error) {
    if (error.code === "23505") {
      throw businessError("Vous soutenez déjà cette proposition", "SOSO_KEVITRA_ALREADY_SUPPORTED");
    }
    throw error;
  }
}

export async function removeSoutienSosoKevitra(idSosoKevitra, auth) {
  const idPersonne = auth?.personne?.id;
  if (!idPersonne) throw businessError("Authentification requise", "AUTH_REQUIRED");

  return database.transaction(async () => {
    const sosoKevitra = await lockSosoKevitra(idSosoKevitra);
    if (!sosoKevitra) return null;
    assertConsultationOpen(sosoKevitra);
    const result = await database.query(
      `DELETE FROM soso_kevitra_soutien
      WHERE id_soso_kevitra = $1 AND id_personne = $2
      RETURNING id_soso_kevitra, id_personne, date_soutien`,
      [idSosoKevitra, idPersonne],
    );
    if (!result.rows[0]) {
      throw businessError("Vous ne soutenez pas cette proposition", "SOSO_KEVITRA_SUPPORT_NOT_FOUND");
    }
    return {
      soutien: new SosoKevitraSoutien(result.rows[0]).toJSON(),
      nombre_soutiens: await countSoutiens(idSosoKevitra),
      utilisateur_soutient: false,
    };
  });
}