import PersonneCompetence from "../models/PersonneCompetence.js";
import {
  createPersonneCompetence,
  deletePersonneCompetence,
  getAllPersonnesCompetences,
  getCompetencesPartageablesByPersonne,
  getPersonneCompetenceById,
  getPersonnesCompetencesByPersonne as getPersonnesCompetencesByPersonneService,
  updatePersonneCompetence,
} from "../services/personneCompetence.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "PERSONNE_MANAGEMENT_FORBIDDEN") {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (error.code === "PERSONNE_NOT_FOUND" || error.code === "COMPETENCE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error.code === "COMPETENCE_ALREADY_EXISTS" || error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Cette compétence est déjà enregistrée pour cette personne",
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Référence associée invalide",
    });
  }

  if (error.code) {
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }

  return res.status(400).json({ success: false, message: error.message });
}

export async function getPersonnesCompetences(req, res) {
  try {
    const lang = req.query.lang || "fr";
    return res.json({
      success: true,
      data: await getAllPersonnesCompetences(lang),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getPersonneCompetence(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    const association = await getPersonneCompetenceById(req.params.id, lang);
    if (!association) {
      return res.status(404).json({
        success: false,
        message: "Compétence de la personne introuvable",
      });
    }
    return res.json({ success: true, data: association });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

async function getByPersonne(handler, req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    return res.json({
      success: true,
      data: await handler(req.params.id_personne, lang),
    });
  } catch (error) {
    console.error(error);
    if (error.code === "PERSONNE_NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getPersonnesCompetencesByPersonne(req, res) {
  return getByPersonne(getPersonnesCompetencesByPersonneService, req, res);
}

export async function getCompetencesPartageables(req, res) {
  return getByPersonne(getCompetencesPartageablesByPersonne, req, res);
}

export async function addPersonneCompetence(req, res) {
  if (!isUuid(req.body?.id_personne) || !isUuid(req.body?.id_competence)) {
    return invalidId(res);
  }

  try {
    const lang = req.query.lang || "fr";
    const association = new PersonneCompetence(req.body);
    const nouvelleAssociation = await createPersonneCompetence(association, lang, req.auth);
    return res.status(201).json({
      success: true,
      message: "Compétence enregistrée avec succès",
      data: nouvelleAssociation,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editPersonneCompetence(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  if (Object.prototype.hasOwnProperty.call(req.body, "id_personne")) {
    return res.status(400).json({
      success: false,
      message: "La personne associée ne peut pas être modifiée",
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body, "id_competence") &&
    !isUuid(req.body.id_competence)
  ) {
    return invalidId(res);
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body, "partageable") &&
    typeof req.body.partageable !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "Le champ partageable doit être un booléen",
    });
  }

  try {
    const lang = req.query.lang || "fr";
    const association = await updatePersonneCompetence(
      req.params.id,
      req.body,
      lang,
      req.auth,
    );
    if (!association) {
      return res.status(404).json({
        success: false,
        message: "Compétence de la personne introuvable",
      });
    }
    return res.json({
      success: true,
      message: "Compétence modifiée avec succès",
      data: association,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removePersonneCompetence(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const association = await deletePersonneCompetence(req.params.id, req.auth);
    if (!association) {
      return res.status(404).json({
        success: false,
        message: "Compétence de la personne introuvable",
      });
    }
    return res.json({
      success: true,
      message: "Compétence supprimée avec succès",
      data: association,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}
