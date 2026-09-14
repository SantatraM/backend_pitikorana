import {
  getAllTypesRelation,
  getTypesRelationByLangue,
} from "../services/typeRelation.service.js";

export async function getTypesRelation(req, res) {
  try {
    return res.json({ success: true, data: await getAllTypesRelation() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getTypesRelationLangue(req, res) {
  try {
    return res.json({
      success: true,
      data: await getTypesRelationByLangue(req.params.code),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
