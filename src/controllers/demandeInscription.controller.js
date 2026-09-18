import {
  createDemandeInscription,
  creerCompteMembreDepuisDemande,
  getAllDemandesInscription,
  getDemandeInscriptionById,
  getSuiviDemandeInscription,
  refuserDemandeInscription,
  searchPersonnesPourInscription,
  validerDemandeInscription,
} from "../services/demandeInscription.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

function handleCreateError(error, res) {
  if (error.code === "PERSONNE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (
    ["PENDING_EMAIL_EXISTS", "PENDING_PHONE_EXISTS", "PENDING_PERSON_EXISTS"].includes(
      error.code,
    )
  ) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error.code === "DRAFT_FK_NOT_FOUND") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code) {
    console.error(error.code);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
  return res.status(400).json({ success: false, message: error.message });
}

function handleTreatmentError(error, res) {
  if (error.code === "DEMANDE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error.code === "DEMANDE_NOT_PENDING") {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error.code === "DRAFT_INVALID" || !error.code) {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(error.code);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

function handleCompteCreationError(error, res) {
  if (error.code === "SUIVI_INVALID") {
    return res.status(401).json({ success: false, message: error.message });
  }
  if (["DEMANDE_NOT_VALIDATED", "COMPTE_MEMBRE_EXISTS"].includes(error.code)) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Un compte membre existe déjà pour cette personne",
    });
  }
  if (!error.code) {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(error.code);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function getDemandesInscription(req, res) {
  try {
    return res.json({ success: true, data: await getAllDemandesInscription() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getDemandeInscription(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const demande = await getDemandeInscriptionById(req.params.id);
    if (!demande) {
      return res
        .status(404)
        .json({ success: false, message: "Demande d'inscription introuvable" });
    }
    return res.json({ success: true, data: demande });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addDemandeInscription(req, res) {
  try {
    const result = await createDemandeInscription(req.body);
    return res.status(201).json({
      success: true,
      message: "Demande d'inscription envoyée avec succès",
      data: { ...result.demande, code_suivi: result.code_suivi },
    });
  } catch (error) {
    return handleCreateError(error, res);
  }
}

export async function suiviDemandeInscription(req, res) {
  try {
    const suivi = await getSuiviDemandeInscription(
      req.body?.reference,
      req.body?.code_suivi,
    );
    return res.json({ success: true, data: suivi });
  } catch (error) {
    if (error.code === "SUIVI_INVALID") {
      return res.status(401).json({ success: false, message: error.message });
    }
    if (!error.code) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(error.code);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function recherchePersonneInscription(req, res) {
  try {
    const personnes = await searchPersonnesPourInscription(req.query.q);
    return res.json({ success: true, data: personnes });
  } catch (error) {
    if (!error.code) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(error.code);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function creerCompteMembre(req, res) {
  try {
    const compte = await creerCompteMembreDepuisDemande(req.body);
    return res.status(201).json({
      success: true,
      message: "Vita ny famoronana ny kaontinao. Afaka miditra ianao.",
      data: compte,
    });
  } catch (error) {
    return handleCompteCreationError(error, res);
  }
}

export async function validerDemandeInscriptionController(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const demande = await validerDemandeInscription(
      req.params.id,
      req.body,
      req.auth.compte.id,
    );
    return res.json({
      success: true,
      message: "Demande validée avec succès",
      data: {
        id: demande.id,
        reference: demande.reference,
        statut: demande.statut,
        role_attribue: demande.role_attribue,
        id_personne: demande.id_personne,
        date_traitement: demande.date_traitement,
      },
    });
  } catch (error) {
    return handleTreatmentError(error, res);
  }
}

export async function refuserDemandeInscriptionController(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);
  try {
    const demande = await refuserDemandeInscription(
      req.params.id,
      req.body,
      req.auth.compte.id,
    );
    return res.json({
      success: true,
      message: "Demande refusée",
      data: {
        id: demande.id,
        reference: demande.reference,
        statut: demande.statut,
        date_traitement: demande.date_traitement,
        commentaire_admin: demande.commentaire_admin,
      },
    });
  } catch (error) {
    return handleTreatmentError(error, res);
  }
}
