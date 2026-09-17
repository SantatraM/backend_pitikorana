import Activite from "../models/Activite.js";
import {
  createActivite,
  deleteActivite,
  getActiviteById,
  getActivitesByDomaine,
  getActivitesByDomaineAndLangue,
  getActivitesByLangue,
  getAllActivites,
  updateActivite,
} from "../services/activite.service.js";

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

function activiteFromBody(body) {
  if (!Array.isArray(body?.traductions) || body.traductions.length === 0) {
    throw new Error("Au moins une traduction est obligatoire");
  }

  const idDomaineActivite = body.id_domaine_activite ?? null;
  if (idDomaineActivite !== null && !isUuid(idDomaineActivite)) {
    throw new Error("L'identifiant de domaine est invalide");
  }

  const langues = body.traductions.map((traduction) => traduction?.id_langue);
  if (langues.some((idLangue) => !isUuid(idLangue))) {
    throw new Error("L'identifiant de langue est invalide");
  }

  if (new Set(langues).size !== langues.length) {
    throw new Error("Une seule traduction par langue est autorisée");
  }

  return new Activite({
    id_domaine_activite: idDomaineActivite,
    traductions: body.traductions,
  });
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "DOMAINE_NOT_FOUND" || error.code === "LANGUE_NOT_FOUND") {
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

function handleDomaineReadError(error, res) {
  console.error(error);
  if (error.code === "DOMAINE_NOT_FOUND") {
    return res
      .status(404)
      .json({ success: false, message: "Domaine d'activité introuvable" });
  }
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function getActivites(req, res) {
  try {
    return res.json({ success: true, data: await getAllActivites() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const activite = await getActiviteById(req.params.id);
    if (!activite) {
      return res
        .status(404)
        .json({ success: false, message: "Activité introuvable" });
    }
    return res.json({ success: true, data: activite });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getActivitesLangue(req, res) {
  try {
    return res.json({
      success: true,
      data: await getActivitesByLangue(req.params.code),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getActivitesDomaine(req, res) {
  if (!isUuid(req.params.id_domaine)) return invalidId(res);

  try {
    return res.json({
      success: true,
      data: await getActivitesByDomaine(req.params.id_domaine),
    });
  } catch (error) {
    return handleDomaineReadError(error, res);
  }
}

export async function getActivitesDomaineLangue(req, res) {
  if (!isUuid(req.params.id_domaine)) return invalidId(res);

  try {
    return res.json({
      success: true,
      data: await getActivitesByDomaineAndLangue(
        req.params.id_domaine,
        req.params.code,
      ),
    });
  } catch (error) {
    return handleDomaineReadError(error, res);
  }
}

export async function addActivite(req, res) {
  try {
    const activite = activiteFromBody(req.body);
    const nouvelleActivite = await createActivite(activite);
    return res.status(201).json({
      success: true,
      message: "Activité créée avec succès",
      data: nouvelleActivite,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const activite = activiteFromBody(req.body);
    const activiteModifiee = await updateActivite(req.params.id, activite);
    if (!activiteModifiee) {
      return res
        .status(404)
        .json({ success: false, message: "Activité introuvable" });
    }
    return res.json({
      success: true,
      message: "Activité modifiée avec succès",
      data: activiteModifiee,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeActivite(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const activite = await deleteActivite(req.params.id);
    if (!activite) {
      return res
        .status(404)
        .json({ success: false, message: "Activité introuvable" });
    }
    return res.json({
      success: true,
      message: "Activité supprimée avec succès",
      data: activite,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
