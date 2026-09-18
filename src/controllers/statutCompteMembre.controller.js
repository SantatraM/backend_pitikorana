import {
  getAllStatutsCompteMembre,
  getStatutCompteMembreById,
} from "../services/statutCompteMembre.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

export async function getStatutsCompteMembre(req, res) {
  try {
    return res.json({ success: true, data: await getAllStatutsCompteMembre() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getStatutCompteMembre(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);

  try {
    const statut = await getStatutCompteMembreById(req.params.id);
    if (!statut) {
      return res.status(404).json({
        success: false,
        message: "Statut de compte membre introuvable",
      });
    }
    return res.json({ success: true, data: statut });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
