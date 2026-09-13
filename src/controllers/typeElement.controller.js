import { getAllTypesElement } from "../services/typeElement.service.js";

export async function getTypesElement(req, res) {
  try {
    const typesElement = await getAllTypesElement();
    res.json({
      success: true,
      data: typesElement,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}
