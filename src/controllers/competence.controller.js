import Competence from "../models/Competence.js";
import {
  createCompetence,
  deleteCompetence,
  getAllCompetences,
  getCompetenceById,
  getCompetencesByLangue,
  updateCompetence,
} from "../services/competence.service.js";

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

function competenceFromBody(body) {
  if (!Array.isArray(body?.traductions) || body.traductions.length === 0) {
    throw new Error("Au moins une traduction est obligatoire");
  }

  const langues = body.traductions.map((traduction) => traduction?.id_langue);
  if (langues.some((idLangue) => !isUuid(idLangue))) {
    throw new Error("L'identifiant de langue est invalide");
  }

  if (new Set(langues).size !== langues.length) {
    throw new Error("Une seule traduction par langue est autorisée");
  }

  return new Competence({ traductions: body.traductions });
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "LANGUE_NOT_FOUND") {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Une traduction existe déjà pour cette langue",
    });
  }

  if (error.code) {
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }

  return res.status(400).json({ success: false, message: error.message });
}

export async function getCompetences(req, res) {
  try {
    return res.json({ success: true, data: await getAllCompetences() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getCompetence(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const competence = await getCompetenceById(req.params.id);
    if (!competence) {
      return res
        .status(404)
        .json({ success: false, message: "Compétence introuvable" });
    }
    return res.json({ success: true, data: competence });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getCompetencesLangue(req, res) {
  try {
    return res.json({
      success: true,
      data: await getCompetencesByLangue(req.params.code),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addCompetence(req, res) {
  try {
    const competence = competenceFromBody(req.body);
    const nouvelleCompetence = await createCompetence(competence);
    return res.status(201).json({
      success: true,
      message: "Compétence créée avec succès",
      data: nouvelleCompetence,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editCompetence(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const competence = competenceFromBody(req.body);
    const competenceModifiee = await updateCompetence(req.params.id, competence);
    if (!competenceModifiee) {
      return res
        .status(404)
        .json({ success: false, message: "Compétence introuvable" });
    }
    return res.json({
      success: true,
      message: "Compétence modifiée avec succès",
      data: competenceModifiee,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeCompetence(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const competence = await deleteCompetence(req.params.id);
    if (!competence) {
      return res
        .status(404)
        .json({ success: false, message: "Compétence introuvable" });
    }
    return res.json({
      success: true,
      message: "Compétence supprimée avec succès",
      data: competence,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
