import LienAvecFalimanjaka from "../models/LienAvecFalimanjaka.js";
import {
  createLien,
  deleteLien,
  getAllLiens,
  getLienById,
  getLiensByLangue,
  updateLien,
} from "../services/lienAvecFalimanjaka.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(value);
}

function createLienFromBody(body) {
  if (!Array.isArray(body?.traductions) || body.traductions.length === 0) {
    throw new Error("Au moins une traduction est obligatoire");
  }

  for (const traduction of body.traductions) {
    if (!isUuid(traduction?.id_langue)) {
      throw new Error("L'identifiant de langue est invalide");
    }
  }

  const langues = body.traductions.map((traduction) => traduction.id_langue);

  if (new Set(langues).size !== langues.length) {
    const error = new Error("Une seule traduction par langue est autorisée");
    error.code = "DUPLICATE_TRANSLATION";
    throw error;
  }

  return new LienAvecFalimanjaka({
    traductions: body.traductions,
  });
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Une traduction existe déjà pour cette langue",
    });
  }

  if (error.code === "DUPLICATE_TRANSLATION") {
    return res.status(409).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Une langue sélectionnée n'existe pas",
    });
  }

  if (error.code === "22P02") {
    return res.status(400).json({
      success: false,
      message: "Identifiant invalide",
    });
  }

  if (error.code) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }

  return res.status(400).json({
    success: false,
    message: error.message,
  });
}

export async function getLiens(req, res) {
  try {
    const liens = await getAllLiens();
    res.json({ success: true, data: liens });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getLien(req, res) {
  if (!isUuid(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: "Identifiant invalide" });
  }

  try {
    const lien = await getLienById(req.params.id);

    if (!lien) {
      return res
        .status(404)
        .json({ success: false, message: "Lien introuvable" });
    }

    return res.json({ success: true, data: lien });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getLiensLangue(req, res) {
  try {
    const liens = await getLiensByLangue(req.params.code);
    return res.json({ success: true, data: liens });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addLien(req, res) {
  try {
    const lien = createLienFromBody(req.body);
    const nouveauLien = await createLien(lien);

    return res.status(201).json({
      success: true,
      message: "Lien créé avec succès",
      data: nouveauLien,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editLien(req, res) {
  if (!isUuid(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: "Identifiant invalide" });
  }

  try {
    const lien = createLienFromBody(req.body);
    const lienModifie = await updateLien(req.params.id, lien);

    if (!lienModifie) {
      return res
        .status(404)
        .json({ success: false, message: "Lien introuvable" });
    }

    return res.json({
      success: true,
      message: "Lien modifié avec succès",
      data: lienModifie,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeLien(req, res) {
  if (!isUuid(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: "Identifiant invalide" });
  }

  try {
    const lienSupprime = await deleteLien(req.params.id);

    if (!lienSupprime) {
      return res
        .status(404)
        .json({ success: false, message: "Lien introuvable" });
    }

    return res.json({
      success: true,
      message: "Lien supprimé avec succès",
      data: lienSupprime,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
