import Element from "../models/Element.js";
import {
  createElement,
  deleteElement,
  getAllElements,
  getElementById,
  getElementsByParent,
  getElementsByParentAndType,
  getElementsByType,
  updateElement,
} from "../services/element.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(value);
}

function hasOwn(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function validateUuid(value, fieldName, nullable = false) {
  if (nullable && (value === null || value === undefined || value === "")) {
    return;
  }

  if (!isUuid(value)) {
    throw new Error(`L'identifiant ${fieldName} est invalide`);
  }
}

function createElementFromBody(body, existing = null) {
  const value = (key) => (hasOwn(body, key) ? body[key] : existing?.[key]);
  const idTypeElement = value("id_type_element");
  const idSexe = value("id_sexe");
  const rattachementSup = value("rattachement_sup");

  validateUuid(idTypeElement, "du type d'élément");
  validateUuid(idSexe, "du sexe", true);
  validateUuid(rattachementSup, "du parent", true);

  return new Element({
    id_type_element: idTypeElement,
    nom: value("nom"),
    autres_appellations: value("autres_appellations"),
    id_sexe: idSexe,
    nom_conjoint: value("nom_conjoint"),
    ville_origine_conjoint: value("ville_origine_conjoint"),
    rattachement_sup: rattachementSup,
    etat: value("etat"),
  });
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "HAS_CHILDREN") {
    return res.status(409).json({ success: false, message: error.message });
  }

  if (["TYPE_NOT_FOUND", "SEXE_NOT_FOUND", "PARENT_NOT_FOUND", "SELF_PARENT", "HIERARCHY_CYCLE", "HIERARCHY_INVALID"].includes(error.code)) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error.code === "23503" || error.code === "22P02") {
    return res.status(400).json({ success: false, message: "Identifiant invalide ou référence inexistante" });
  }

  if (error.code) {
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }

  return res.status(400).json({ success: false, message: error.message });
}

function invalidId(res) {
  return res.status(400).json({ success: false, message: "Identifiant invalide" });
}

export async function getElements(req, res) {
  try {
    const elements = await getAllElements();
    return res.json({ success: true, data: elements });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getElement(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const element = await getElementById(req.params.id);
    if (!element) return res.status(404).json({ success: false, message: "Élément introuvable" });
    return res.json({ success: true, data: element });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getElementsType(req, res) {
  if (!isUuid(req.params.id_type_element)) return invalidId(res);

  try {
    return res.json({ success: true, data: await getElementsByType(req.params.id_type_element) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getElementsParent(req, res) {
  if (!isUuid(req.params.id_parent)) return invalidId(res);

  try {
    return res.json({ success: true, data: await getElementsByParent(req.params.id_parent) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getElementsParentType(req, res) {
  if (!isUuid(req.params.id_parent) || !isUuid(req.params.id_type_element)) return invalidId(res);

  try {
    return res.json({
      success: true,
      data: await getElementsByParentAndType(req.params.id_parent, req.params.id_type_element),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addElement(req, res) {
  try {
    const element = createElementFromBody(req.body);
    const nouveauElement = await createElement(element);
    return res.status(201).json({ success: true, message: "Élément créé avec succès", data: nouveauElement });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editElement(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const existing = await getElementById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Élément introuvable" });

    const element = createElementFromBody(req.body, existing);
    const elementModifie = await updateElement(req.params.id, element);
    return res.json({ success: true, message: "Élément modifié avec succès", data: elementModifie });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeElement(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const elementSupprime = await deleteElement(req.params.id);
    if (!elementSupprime) return res.status(404).json({ success: false, message: "Élément introuvable" });
    return res.json({ success: true, message: "Élément supprimé avec succès", data: elementSupprime });
  } catch (error) {
    return handleWriteError(error, res);
  }
}
