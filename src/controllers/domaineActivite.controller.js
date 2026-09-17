import DomaineActivite from "../models/DomaineActivite.js";
import {
  createDomaineActivite,
  deleteDomaineActivite,
  getAllDomainesActivite,
  getDomaineActiviteById,
  getDomainesActiviteByLangue,
  updateDomaineActivite,
} from "../services/domaineActivite.service.js";

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

function domaineFromBody(body) {
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

  return new DomaineActivite({ traductions: body.traductions });
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

export async function getDomainesActivite(req, res) {
  try {
    return res.json({ success: true, data: await getAllDomainesActivite() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getDomaineActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const domaine = await getDomaineActiviteById(req.params.id);
    if (!domaine) {
      return res
        .status(404)
        .json({ success: false, message: "Domaine d'activité introuvable" });
    }
    return res.json({ success: true, data: domaine });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getDomainesActiviteLangue(req, res) {
  try {
    return res.json({
      success: true,
      data: await getDomainesActiviteByLangue(req.params.code),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addDomaineActivite(req, res) {
  try {
    const domaine = domaineFromBody(req.body);
    const nouveauDomaine = await createDomaineActivite(domaine);
    return res.status(201).json({
      success: true,
      message: "Domaine d'activité créé avec succès",
      data: nouveauDomaine,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editDomaineActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const domaine = domaineFromBody(req.body);
    const domaineModifie = await updateDomaineActivite(req.params.id, domaine);
    if (!domaineModifie) {
      return res
        .status(404)
        .json({ success: false, message: "Domaine d'activité introuvable" });
    }
    return res.json({
      success: true,
      message: "Domaine d'activité modifié avec succès",
      data: domaineModifie,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeDomaineActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const domaine = await deleteDomaineActivite(req.params.id);
    if (!domaine) {
      return res
        .status(404)
        .json({ success: false, message: "Domaine d'activité introuvable" });
    }
    return res.json({
      success: true,
      message: "Domaine d'activité supprimé avec succès",
      data: domaine,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
