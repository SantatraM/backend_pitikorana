import {
  getAllStatuts,
  getStatutsByLangue,
} from "../services/statut.service.js";
export async function getStatuts(req, res) {
  try {
    return res.json({ success: true, data: await getAllStatuts() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function getStatutsLangue(req, res) {
  try {
    return res.json({
      success: true,
      data: await getStatutsByLangue(req.params.code),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
