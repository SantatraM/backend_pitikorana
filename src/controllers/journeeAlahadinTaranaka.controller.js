import {
  cloturerJourneeAlahadinTaranaka,
  createJourneeAlahadinTaranaka,
  getJourneeAlahadinTaranakaById,
  getJourneesAlahadinTaranaka,
  ouvrirJourneeAlahadinTaranaka,
  rouvrirJourneeAlahadinTaranaka,
  updateJourneeAlahadinTaranaka,
} from "../services/journeeAlahadinTaranaka.service.js";

const ERROR_MESSAGES = {
  JOURNEE_INVALID: "Les données de la journée sont invalides.",
  JOURNEE_TARANAKA_REQUIRED: "Au moins un Taranaka doit être associé à la journée.",
  JOURNEE_TARANAKA_DUPLICATE: "Un Taranaka ne peut être associé qu'une seule fois.",
  JOURNEE_TARANAKA_INVALID: "L'élément sélectionné doit être un Taranaka valide.",
  JOURNEE_TARANAKA_NOT_FOUND: "Le Taranaka sélectionné est introuvable.",
  JOURNEE_NOT_FOUND: "Journée introuvable.",
  JOURNEE_STATE_INVALID: "Seule une journée en brouillon peut être modifiée.",
  JOURNEE_TRANSITION_INVALID: "La transition de statut de la journée est invalide.",
};

function sendError(res, error) {
  const code = error?.code;

  if (
    code === "JOURNEE_INVALID" ||
    code === "JOURNEE_TARANAKA_REQUIRED" ||
    code === "JOURNEE_TARANAKA_DUPLICATE" ||
    code === "JOURNEE_TARANAKA_INVALID"
  ) {
    return res.status(400).json({ success: false, code, message: ERROR_MESSAGES[code] });
  }

  if (code === "JOURNEE_NOT_FOUND" || code === "JOURNEE_TARANAKA_NOT_FOUND") {
    return res.status(404).json({ success: false, code, message: ERROR_MESSAGES[code] });
  }

  if (code === "JOURNEE_STATE_INVALID" || code === "JOURNEE_TRANSITION_INVALID") {
    return res.status(409).json({ success: false, code, message: ERROR_MESSAGES[code] });
  }

  console.error("Erreur journée Alahadin'ny Taranaka :", error);
  return res.status(500).json({ success: false, message: "Erreur interne du serveur." });
}

export async function createJournee(req, res) {
  try {
    const journee = await createJourneeAlahadinTaranaka(req.body, req.auth.compte.id);
    return res.status(201).json({ success: true, data: journee });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getJournees(_req, res) {
  try {
    const journees = await getJourneesAlahadinTaranaka();
    return res.status(200).json({ success: true, data: journees });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getJournee(req, res) {
  try {
    const journee = await getJourneeAlahadinTaranakaById(req.params.id);

    if (!journee) {
      return res.status(404).json({ success: false, code: "JOURNEE_NOT_FOUND", message: ERROR_MESSAGES.JOURNEE_NOT_FOUND });
    }

    return res.status(200).json({ success: true, data: journee });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateJournee(req, res) {
  try {
    const journee = await updateJourneeAlahadinTaranaka(req.params.id, req.body);
    return res.status(200).json({ success: true, data: journee });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function ouvrirJournee(req, res) {
  try {
    const journee = await ouvrirJourneeAlahadinTaranaka(req.params.id);
    return res.status(200).json({ success: true, data: journee });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function cloturerJournee(req, res) {
  try {
    const journee = await cloturerJourneeAlahadinTaranaka(req.params.id);
    return res.status(200).json({ success: true, data: journee });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function rouvrirJournee(req, res) {
  try {
    const journee = await rouvrirJourneeAlahadinTaranaka(req.params.id);
    return res.status(200).json({ success: true, data: journee });
  } catch (error) {
    return sendError(res, error);
  }
}