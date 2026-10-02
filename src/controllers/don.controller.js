import { isBusinessManager } from "../utils/roles.js";
import {
  cancelDon,
  createDon,
  getDonByJournee,
  getStatistiquesDonsByJournee,
  getDonsByJournee,
  updateDon,
} from "../services/don.service.js";

const ERROR_MESSAGES = {
  DON_INVALID: "Les données du don sont invalides.",
  DON_DONATEUR_INVALID: "Le donateur est invalide ou incompatible avec son type.",
  DON_ARGENT_INVALID: "Les informations du don en argent sont invalides.",
  DON_MATERIEL_INVALID: "Les informations du don matériel sont invalides.",
  DON_RATTACHEMENT_INVALID: "Le rattachement organisationnel du donateur est invalide.",
  DON_CANCELLATION_REASON_REQUIRED: "Le motif d'annulation est obligatoire.",
  DON_JOURNEE_NOT_FOUND: "Journée introuvable.",
  DON_NOT_FOUND: "Don introuvable.",
  DON_ELEMENT_NOT_FOUND: "Élément donateur introuvable.",
  DON_PERSONNE_NOT_FOUND: "Personne donatrice introuvable.",
  DON_FOYER_NOT_FOUND: "Foyer donateur introuvable.",
  DON_JOURNEE_NOT_OPEN: "La journée doit être ouverte pour gérer les dons.",
  DON_ALREADY_CANCELLED: "Ce don est déjà annulé.",
  DON_TARANAKA_NOT_ALLOWED: "Le Taranaka résolu n'est pas associé à cette journée.",
};

function sendError(res, error) {
  const code = error?.code;
  if (["DON_INVALID", "DON_DONATEUR_INVALID", "DON_ARGENT_INVALID", "DON_MATERIEL_INVALID", "DON_RATTACHEMENT_INVALID", "DON_CANCELLATION_REASON_REQUIRED"].includes(code)) {
    return res.status(400).json({ success: false, code, message: ERROR_MESSAGES[code] });
  }
  if (["DON_JOURNEE_NOT_FOUND", "DON_NOT_FOUND", "DON_ELEMENT_NOT_FOUND", "DON_PERSONNE_NOT_FOUND", "DON_FOYER_NOT_FOUND"].includes(code)) {
    return res.status(404).json({ success: false, code, message: ERROR_MESSAGES[code] });
  }
  if (["DON_JOURNEE_NOT_OPEN", "DON_ALREADY_CANCELLED", "DON_TARANAKA_NOT_ALLOWED"].includes(code)) {
    return res.status(409).json({ success: false, code, message: ERROR_MESSAGES[code] });
  }
  console.error("Erreur don Alahadin'ny Taranaka :", error);
  return res.status(500).json({ success: false, message: "Erreur interne du serveur." });
}

export async function createDonForJournee(req, res) {
  try {
    const don = await createDon(req.params.journeeId, req.body, req.auth.compte.id);
    return res.status(201).json({ success: true, data: don });
  } catch (error) { return sendError(res, error); }
}

export async function getDonsForJournee(req, res) {
  try {
    const dons = await getDonsByJournee(req.params.journeeId, {
      includeCancelled: isBusinessManager(req.auth.compte.role),
    });
    return res.status(200).json({ success: true, data: dons });
  } catch (error) { return sendError(res, error); }
}

export async function getDonForJournee(req, res) {
  try {
    const don = await getDonByJournee(req.params.journeeId, req.params.donId, {
      includeCancelled: isBusinessManager(req.auth.compte.role),
    });
    if (!don) return res.status(404).json({ success: false, code: "DON_NOT_FOUND", message: ERROR_MESSAGES.DON_NOT_FOUND });
    return res.status(200).json({ success: true, data: don });
  } catch (error) { return sendError(res, error); }
}

export async function updateDonForJournee(req, res) {
  try {
    const don = await updateDon(req.params.journeeId, req.params.donId, req.body, req.auth.compte.id);
    return res.status(200).json({ success: true, data: don });
  } catch (error) { return sendError(res, error); }
}

export async function cancelDonForJournee(req, res) {
  try {
    const don = await cancelDon(req.params.journeeId, req.params.donId, req.body?.motif_annulation, req.auth.compte.id);
    return res.status(200).json({ success: true, data: don });
  } catch (error) { return sendError(res, error); }
}
export async function getStatistiquesDonsForJournee(req, res) {
  try {
    const statistiques = await getStatistiquesDonsByJournee(req.params.id);
    return res.status(200).json({ success: true, data: statistiques });
  } catch (error) {
    return sendError(res, error);
  }
}