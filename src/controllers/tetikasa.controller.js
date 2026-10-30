import {
  getTetikasaList,
  getTetikasaById,
  updateTetikasaDraft,
  updateTetikasaDraftContent,
  transitionTetikasa,
  creerTetikasaManuel,
} from "../services/tetikasa.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidId(res) {
  return res.status(400).json({ success: false, message: "Identifiant invalide" });
}

function handleTetikasaError(error, res) {
  if (error.code === "AUTH_REQUIRED") {
    return res.status(401).json({ success: false, message: error.message });
  }
  if (error.code === "TETIKASA_FORBIDDEN") {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (error.code === "TETIKASA_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error.code === "TETIKASA_INCOMPLETE") {
    return res.status(409).json({ success: false, code: error.code, message: error.message, fields: error.fields });
  }
  if (["TETIKASA_STATE_INVALID", "TETIKASA_REVISION_CONFLICT"].includes(error.code)) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (["TETIKASA_INVALID", "TETIKASA_PERSON_NOT_FOUND"].includes(error.code)) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === "TETIKASA_STATUS_NOT_FOUND") {
    return res.status(500).json({ success: false, message: "Configuration Tetikasa indisponible" });
  }
  if (error.code) console.error(error);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function listTetikasa(req, res) {
  try {
    const data = await getTetikasaList(req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return handleTetikasaError(error, res);
  }
}

export async function createTetikasa(req, res) {
  try {
    const data = await creerTetikasaManuel(req.body, req.auth);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleTetikasaError(error, res);
  }
}

export async function getTetikasa(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const data = await getTetikasaById(req.params.id, req.auth);
    if (!data) return res.status(404).json({ success: false, message: "Tetikasa introuvable" });
    return res.json({ success: true, data });
  } catch (error) {
    return handleTetikasaError(error, res);
  }
}

export async function updateTetikasa(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const data = await updateTetikasaDraft(req.params.id, req.body, req.auth);
    return res.json({
      success: true,
      message: data.modified ? "Tetikasa modifié avec succès" : "Aucune modification à enregistrer",
      data,
    });
  } catch (error) {
    return handleTetikasaError(error, res);
  }
}

export async function updateTetikasaContent(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const data = await updateTetikasaDraftContent(req.params.id, req.body, req.auth);
    return res.json({
      success: true,
      message: data.modified ? "Contenu Tetikasa modifié avec succès" : "Aucune modification à enregistrer",
      data,
    });
  } catch (error) {
    return handleTetikasaError(error, res);
  }
}

export async function transitionTetikasaController(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const data = await transitionTetikasa(req.params.id, req.body, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    if (["TETIKASA_STATE_INVALID", "TETIKASA_REVISION_CONFLICT"].includes(error.code)) {
      return res.status(409).json({ success: false, code: error.code, message: error.message });
    }
    return handleTetikasaError(error, res);
  }
}
