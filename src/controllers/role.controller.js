import { getAllRoles, getRoleById } from "../services/role.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

export async function getRoles(req, res) {
  try {
    return res.json({ success: true, data: await getAllRoles() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getRole(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return invalidId(res);

  try {
    const role = await getRoleById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rôle introuvable" });
    }
    return res.json({ success: true, data: role });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
