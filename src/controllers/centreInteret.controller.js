import CentreInteret from "../models/CentreInteret.js";
import {
  createCentreInteret,
  deleteCentreInteret,
  getAllCentresInteret,
  getCentreInteretById,
  getCentresInteretByLangue,
  updateCentreInteret,
} from "../services/centreInteret.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === "string" && UUID_PATTERN.test(value);
const invalidId = (res) => res.status(400).json({ success: false, message: "Identifiant invalide" });

function centreFromBody(body) {
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
  return new CentreInteret({ traductions: body.traductions });
}

function writeError(error, res) {
  console.error(error);
  if (error.code === "LANGUE_NOT_FOUND") return res.status(400).json({ success: false, message: error.message });
  if (error.code === "23505") return res.status(409).json({ success: false, message: "Une traduction existe déjà pour cette langue" });
  if (error.code) return res.status(500).json({ success: false, message: "Erreur serveur" });
  return res.status(400).json({ success: false, message: error.message });
}

export async function getCentresInteret(req, res) {
  try { return res.json({ success: true, data: await getAllCentresInteret() }); }
  catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Erreur serveur" }); }
}

export async function getCentreInteret(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const centre = await getCentreInteretById(req.params.id);
    return centre ? res.json({ success: true, data: centre }) : res.status(404).json({ success: false, message: "Centre d'intérêt introuvable" });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Erreur serveur" }); }
}

export async function getCentresInteretLangue(req, res) {
  try { return res.json({ success: true, data: await getCentresInteretByLangue(req.params.code) }); }
  catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Erreur serveur" }); }
}

export async function addCentreInteret(req, res) {
  try {
    const centre = await createCentreInteret(centreFromBody(req.body));
    return res.status(201).json({ success: true, message: "Centre d'intérêt créé avec succès", data: centre });
  } catch (error) { return writeError(error, res); }
}

export async function editCentreInteret(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const centre = await updateCentreInteret(req.params.id, centreFromBody(req.body));
    return centre ? res.json({ success: true, message: "Centre d'intérêt modifié avec succès", data: centre }) : res.status(404).json({ success: false, message: "Centre d'intérêt introuvable" });
  } catch (error) { return writeError(error, res); }
}

export async function removeCentreInteret(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const centre = await deleteCentreInteret(req.params.id);
    return centre ? res.json({ success: true, message: "Centre d'intérêt supprimé avec succès", data: centre }) : res.status(404).json({ success: false, message: "Centre d'intérêt introuvable" });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Erreur serveur" }); }
}
