import PhotoPersonne from "../models/PhotoPersonne.js";
import {
  createPhotoPersonne,
  deletePhotoPersonne,
  getAllPhotosPersonneForReader,
  getPhotoByPersonneForReader,
  getPhotoPersonneByIdForReader,
  updatePhotoPersonne,
  uploadPhotoPersonne,
  replaceUploadedPhotoPersonne,
} from "../services/photoPersonne.service.js";
import { getRequestContext } from "../config/requestContext.js";

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

function photoWithoutStoragePath(photo, url_photo = null) {
  return {
    id: photo.id,
    id_personne: photo.id_personne,
    ...(url_photo ? { url_photo } : {}),
  };
}

function handleWriteError(error, res) {
  console.error(error);

  if (error.code === "PERSONNE_MANAGEMENT_FORBIDDEN") {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (error.code === "PERSONNE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error.code === "PERSON_PHOTO_EXISTS") {
    return res.status(409).json({ success: false, message: error.message });
  }

  if (error.code === "PHOTO_PATH_EXISTS") {
    return res.status(409).json({ success: false, message: error.message });
  }

  if (error.code) {
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }

  return res.status(400).json({ success: false, message: error.message });
}

export async function getPhotosPersonne(req, res) {
  try {
    return res.json({
      success: true,
      data: await getAllPhotosPersonneForReader(req.auth),
    });
  } catch (error) {
    if (error.code === "PHOTO_DELETE_CONFLICT") {
      return res.status(409).json({ success: false, message: error.message });
    }

    console.error(error.code ?? "Erreur suppression photo");
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getPhotoPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const photo = await getPhotoPersonneByIdForReader(req.params.id, req.auth);
    if (photo === undefined) {
      return res
        .status(404)
        .json({ success: false, message: "Photo introuvable" });
    }
    return res.json({ success: true, data: photo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getPhotoPersonneByPersonne(req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  try {
    const photo = await getPhotoByPersonneForReader(
      req.params.id_personne,
      req.auth,
    );
    if (photo === undefined) {
      return res
        .status(404)
        .json({ success: false, message: "Photo introuvable" });
    }
    return res.json({ success: true, data: photo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addPhotoPersonne(req, res) {
  try {
    if (!isUuid(req.body.id_personne)) return invalidId(res);

    const photo = new PhotoPersonne(req.body);
    const nouvellePhoto = await createPhotoPersonne(photo, req.auth);
    return res.status(201).json({
      success: true,
      message: "Photo créée avec succès",
      data: photoWithoutStoragePath(nouvellePhoto),
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function uploadPhoto(req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  const context = getRequestContext();
  if (context?.uploadFormDataError) {
    return res.status(400).json({ success: false, message: "Formulaire multipart invalide" });
  }
  if (!context?.uploadFormData) {
    return res.status(501).json({
      success: false,
      message: "L'upload d'image doit être exécuté via Wrangler avec Cloudflare Images",
    });
  }

  const file = context.uploadFormData.get("photo");
  if (!file || typeof file.stream !== "function") {
    return res.status(400).json({ success: false, message: "La photo est obligatoire" });
  }

  try {
    const result = await uploadPhotoPersonne(req.params.id_personne, file, req.auth);
    return res.status(201).json({
      success: true,
      message: "Photo ajoutée avec succès",
      data: photoWithoutStoragePath(result.photo, result.url_photo),
    });
  } catch (error) {
    if (error.code === "PHOTO_TOO_LARGE") return res.status(413).json({ success: false, message: error.message });
    if (["PHOTO_REQUIRED", "PHOTO_TYPE_INVALID", "PHOTO_INVALID"].includes(error.code)) return res.status(400).json({ success: false, message: error.message });
    if (error.code === "PERSONNE_MANAGEMENT_FORBIDDEN") return res.status(403).json({ success: false, message: error.message });
    if (error.code === "PERSONNE_NOT_FOUND") return res.status(404).json({ success: false, message: error.message });
    if (["PERSON_PHOTO_EXISTS", "PHOTO_PATH_EXISTS"].includes(error.code)) return res.status(409).json({ success: false, message: error.message });
    if (error.code === "IMAGE_PROCESSOR_UNAVAILABLE") return res.status(501).json({ success: false, message: error.message });
    console.error(error.code ?? "Erreur upload photo");
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function replaceUploadedPhoto(req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  const context = getRequestContext();
  if (context?.uploadFormDataError) {
    return res.status(400).json({ success: false, message: "Formulaire multipart invalide" });
  }
  if (!context?.uploadFormData) {
    return res.status(501).json({
      success: false,
      message: "L'upload d'image doit être exécuté via Wrangler avec Cloudflare Images",
    });
  }

  const file = context.uploadFormData.get("photo");
  if (!file || typeof file.stream !== "function") {
    return res.status(400).json({ success: false, message: "La photo est obligatoire" });
  }

  try {
    const result = await replaceUploadedPhotoPersonne(req.params.id_personne, file, req.auth);
    return res.json({
      success: true,
      message: "Photo remplacée avec succès",
      data: photoWithoutStoragePath(result.photo, result.url_photo),
    });
  } catch (error) {
    if (error.code === "PHOTO_TOO_LARGE") return res.status(413).json({ success: false, message: error.message });
    if (["PHOTO_REQUIRED", "PHOTO_TYPE_INVALID", "PHOTO_INVALID"].includes(error.code)) return res.status(400).json({ success: false, message: error.message });
    if (error.code === "PERSONNE_MANAGEMENT_FORBIDDEN") return res.status(403).json({ success: false, message: error.message });
    if (["PERSONNE_NOT_FOUND", "PERSON_PHOTO_NOT_FOUND"].includes(error.code)) return res.status(404).json({ success: false, message: error.message });
    if (error.code === "PHOTO_REPLACEMENT_CONFLICT") return res.status(409).json({ success: false, message: error.message });
    if (error.code === "IMAGE_PROCESSOR_UNAVAILABLE") return res.status(501).json({ success: false, message: error.message });
    console.error(error.code ?? "Erreur remplacement photo");
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function editPhotoPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const photo = await updatePhotoPersonne(req.params.id, req.body.chemin_photo, req.auth);
    if (!photo) {
      return res
        .status(404)
        .json({ success: false, message: "Photo introuvable" });
    }
    return res.json({
      success: true,
      message: "Photo modifiée avec succès",
      data: photoWithoutStoragePath(photo),
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removePhotoPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const photo = await deletePhotoPersonne(req.params.id, req.auth);
    if (!photo) {
      return res
        .status(404)
        .json({ success: false, message: "Photo introuvable" });
    }
    return res.json({
      success: true,
      message: "Photo supprimée avec succès",
      data: photoWithoutStoragePath(photo),
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}
