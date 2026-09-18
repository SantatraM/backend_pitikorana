import ContactsPersonne from "../models/ContactsPersonne.js";
import {
  createContactPersonne,
  deleteContactPersonne,
  getAllContactsPersonneForReader,
  getContactPersonneByIdForReader,
  getContactByPersonneForReader,
  updateContactPersonne,
} from "../services/contactsPersonne.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "PERSONNE_MANAGEMENT_FORBIDDEN") {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (error.code === "PERSONNE_NOT_FOUND") {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error.code === "CONTACT_ALREADY_EXISTS" || error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Cette personne possède déjà une fiche de contact",
    });
  }

  if (error.code) {
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }

  return res.status(400).json({ success: false, message: error.message });
}

export async function getContactsPersonne(req, res) {
  try {
    return res.json({
      success: true,
      data: await getAllContactsPersonneForReader(req.auth),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getContactPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const contact = await getContactPersonneByIdForReader(
      req.params.id,
      req.auth,
    );
    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact introuvable" });
    }
    return res.json({ success: true, data: contact });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getContactsPersonneByPersonne(req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  try {
    const contact = await getContactByPersonneForReader(
      req.params.id_personne,
      req.auth,
    );
    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact introuvable" });
    }
    return res.json({ success: true, data: contact });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addContactPersonne(req, res) {
  try {
    if (!isUuid(req.body.id_personne)) return invalidId(res);

    const contact = new ContactsPersonne(req.body);
    const nouveauContact = await createContactPersonne(contact, req.auth);
    return res.status(201).json({
      success: true,
      message: "Contact créé avec succès",
      data: nouveauContact,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editContactPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  if (
    Object.prototype.hasOwnProperty.call(req.body, "id_personne") &&
    !isUuid(req.body.id_personne)
  )
    return invalidId(res);

  try {
    const contact = await updateContactPersonne(req.params.id, req.body, req.auth);
    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact introuvable" });
    }
    return res.json({
      success: true,
      message: "Contact modifié avec succès",
      data: contact,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeContactPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const contact = await deleteContactPersonne(req.params.id, req.auth);
    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact introuvable" });
    }
    return res.json({
      success: true,
      message: "Contact supprimé avec succès",
      data: contact,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}
