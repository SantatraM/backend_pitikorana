import PersonneActivite from "../models/PersonneActivite.js";
import {
  createPersonneActivite,
  deletePersonneActivite,
  getAllPersonnesActivites,
  getPersonneActiviteById,
  getPersonnesActivitesByPersonne as getPersonnesActivitesByPersonneService,
  updatePersonneActivite,
} from "../services/personneActivite.service.js";

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

  if (error.code === "PERSONNE_NOT_FOUND" || error.code === "ACTIVITE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error.code === "ACTIVITE_ALREADY_EXISTS" || error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Cette activité est déjà enregistrée pour cette personne",
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

export async function getPersonnesActivites(req, res) {
  try {
    const lang = req.query.lang || "fr";
    return res.json({
      success: true,
      data: await getAllPersonnesActivites(lang),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getPersonneActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    const association = await getPersonneActiviteById(req.params.id, lang);
    if (!association) {
      return res.status(404).json({
        success: false,
        message: "Activité de la personne introuvable",
      });
    }
    return res.json({ success: true, data: association });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getPersonnesActivitesByPersonne(req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    return res.json({
      success: true,
      data: await getPersonnesActivitesByPersonneService(
        req.params.id_personne,
        lang,
      ),
    });
  } catch (error) {
    console.error(error);
    if (error.code === "PERSONNE_NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addPersonneActivite(req, res) {
  if (!isUuid(req.body?.id_personne) || !isUuid(req.body?.id_activite)) {
    return invalidId(res);
  }

  try {
    const lang = req.query.lang || "fr";
    const association = new PersonneActivite(req.body);
    const nouvelleAssociation = await createPersonneActivite(association, lang);
    return res.status(201).json({
      success: true,
      message: "Activité enregistrée avec succès",
      data: nouvelleAssociation,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editPersonneActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  if (Object.prototype.hasOwnProperty.call(req.body, "id_personne")) {
    return res.status(400).json({
      success: false,
      message: "La personne associée ne peut pas être modifiée",
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body, "id_activite") &&
    !isUuid(req.body.id_activite)
  ) {
    return invalidId(res);
  }

  try {
    const lang = req.query.lang || "fr";
    const association = await updatePersonneActivite(req.params.id, req.body, lang);
    if (!association) {
      return res.status(404).json({
        success: false,
        message: "Activité de la personne introuvable",
      });
    }
    return res.json({
      success: true,
      message: "Activité modifiée avec succès",
      data: association,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removePersonneActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const association = await deletePersonneActivite(req.params.id);
    if (!association) {
      return res.status(404).json({
        success: false,
        message: "Activité de la personne introuvable",
      });
    }
    return res.json({
      success: true,
      message: "Activité supprimée avec succès",
      data: association,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
