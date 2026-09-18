import {
  getAllStatutsDemandeInscription,
  getStatutDemandeInscriptionById,
} from "../services/statutDemandeInscription.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

export async function getStatutsDemandeInscription(req, res) {
  try {
    return res.json({
      success: true,
      data: await getAllStatutsDemandeInscription(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getStatutDemandeInscription(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);

  try {
    const statut = await getStatutDemandeInscriptionById(req.params.id);
    if (!statut) {
      return res.status(404).json({
        success: false,
        message: "Statut de demande d'inscription introuvable",
      });
    }
    return res.json({ success: true, data: statut });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
