import database from "../config/db.js";
import SosoKevitraPhoto from "../models/SosoKevitraPhoto.js";
import { processImage } from "./imageProcessor.service.js";
import {
  createSignedStorageUrls,
  deleteStorageObject,
  uploadStorageObject,
} from "./storage.service.js";

const STORAGE_BUCKET = "photos_personne";
const MAX_PHOTOS = 10;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapPhoto(row) {
  return new SosoKevitraPhoto(row).toJSON();
}

async function getEditableSosoKevitra(idSosoKevitra, idAuteur, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT s.id, s.id_auteur, statut.code AS statut_code
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
    WHERE s.id = $1
    ${forUpdate ? "FOR UPDATE OF s" : ""}`,
    [idSosoKevitra],
  );
  const sosoKevitra = result.rows[0] ?? null;
  if (!sosoKevitra) return null;
  if (sosoKevitra.id_auteur !== idAuteur || !["BROUILLON", "A_CORRIGER"].includes(sosoKevitra.statut_code)) {
    throw businessError("Vous n'êtes pas autorisé à modifier les photos de cette proposition", "SOSO_KEVITRA_PHOTO_FORBIDDEN");
  }
  return sosoKevitra;
}

async function getPhotosRows(idSosoKevitra, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT id, id_soso_kevitra, chemin_photo, ordre, date_creation
    FROM soso_kevitra_photo
    WHERE id_soso_kevitra = $1
    ORDER BY ordre ASC
    ${forUpdate ? "FOR UPDATE" : ""}`,
    [idSosoKevitra],
  );
  return result.rows;
}

async function uploadStorage(path, image) {
  return uploadStorageObject(STORAGE_BUCKET, path, image, "image/webp");
}

async function deleteStorage(path, options = {}) {
  return deleteStorageObject(STORAGE_BUCKET, path, options);
}

async function cleanupUploadedPaths(paths) {
  await Promise.all(paths.map(async (path) => {
    try {
      await deleteStorage(path, { allowNotFound: true });
    } catch {
      console.error("Impossible de nettoyer une photo Soso-kevitra Storage après échec");
    }
  }));
}

async function renumberPhotos(idSosoKevitra, photoIds) {
  if (photoIds.length === 0) return;
  const maxResult = await database.query(
    "SELECT COALESCE(MAX(ordre), 0) AS max_ordre FROM soso_kevitra_photo WHERE id_soso_kevitra = $1",
    [idSosoKevitra],
  );
  const temporaryOffset = Number(maxResult.rows[0].max_ordre) + photoIds.length + 1;
  await database.query(
    "UPDATE soso_kevitra_photo SET ordre = ordre + $1 WHERE id_soso_kevitra = $2",
    [temporaryOffset, idSosoKevitra],
  );
  for (const [index, id] of photoIds.entries()) {
    await database.query(
      "UPDATE soso_kevitra_photo SET ordre = $1 WHERE id = $2 AND id_soso_kevitra = $3",
      [index + 1, id, idSosoKevitra],
    );
  }
}

export async function getSosoKevitraPhotos(idSosoKevitra) {
  const photos = (await getPhotosRows(idSosoKevitra)).map(mapPhoto);
  const urls = await createSignedStorageUrls(
    STORAGE_BUCKET,
    photos.map((photo) => photo.chemin_photo),
  );
  return photos.map((photo) => ({
    ...photo,
    url_photo: urls.get(photo.chemin_photo),
  }));
}

export async function uploadSosoKevitraPhotos(idSosoKevitra, files, auth) {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  if (!Array.isArray(files) || files.length === 0) {
    throw businessError("Au moins une photo est obligatoire", "PHOTO_REQUIRED");
  }
  if (files.length > MAX_PHOTOS) {
    throw businessError("Une proposition ne peut pas contenir plus de 10 photos", "SOSO_KEVITRA_PHOTO_LIMIT");
  }

  const images = await Promise.all(files.map((file) => processImage(file)));
  const uploadedPaths = [];

  let photos;
  try {
    photos = await database.transaction(async () => {
      const sosoKevitra = await getEditableSosoKevitra(idSosoKevitra, idAuteur, { forUpdate: true });
      if (!sosoKevitra) return null;
      const existing = await getPhotosRows(idSosoKevitra, { forUpdate: true });
      if (existing.length + images.length > MAX_PHOTOS) {
        throw businessError("Une proposition ne peut pas contenir plus de 10 photos", "SOSO_KEVITRA_PHOTO_LIMIT");
      }

      const rows = [];
      for (const [index, image] of images.entries()) {
        const path = `soso-kevitra/${idSosoKevitra}/${crypto.randomUUID()}.webp`;
        await uploadStorage(path, image);
        uploadedPaths.push(path);
        const result = await database.query(
          `INSERT INTO soso_kevitra_photo (id_soso_kevitra, chemin_photo, ordre)
          VALUES ($1, $2, $3)
          RETURNING id, id_soso_kevitra, chemin_photo, ordre, date_creation`,
          [idSosoKevitra, path, existing.length + index + 1],
        );
        rows.push(mapPhoto(result.rows[0]));
      }
      return rows;
    });

  } catch (error) {
    await cleanupUploadedPaths(uploadedPaths);
    throw error;
  }
  if (!photos) return null;
  const urls = await createSignedStorageUrls(STORAGE_BUCKET, photos.map((photo) => photo.chemin_photo));
  return photos.map((photo) => ({ ...photo, url_photo: urls.get(photo.chemin_photo) }));
}

export async function deleteSosoKevitraPhoto(idSosoKevitra, idPhoto, auth) {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");

  return database.transaction(async () => {
    const sosoKevitra = await getEditableSosoKevitra(idSosoKevitra, idAuteur, { forUpdate: true });
    if (!sosoKevitra) return null;
    const photoResult = await database.query(
      `SELECT id, id_soso_kevitra, chemin_photo, ordre, date_creation
      FROM soso_kevitra_photo
      WHERE id = $1 AND id_soso_kevitra = $2
      FOR UPDATE`,
      [idPhoto, idSosoKevitra],
    );
    const photo = photoResult.rows[0];
    if (!photo) return undefined;

    await deleteStorage(photo.chemin_photo, { allowNotFound: true });
    const deleted = await database.query(
      "DELETE FROM soso_kevitra_photo WHERE id = $1 AND id_soso_kevitra = $2 RETURNING id",
      [idPhoto, idSosoKevitra],
    );
    if (!deleted.rows[0]) {
      throw businessError("La photo a été modifiée pendant la suppression", "SOSO_KEVITRA_PHOTO_DELETE_CONFLICT");
    }
    const remaining = await getPhotosRows(idSosoKevitra, { forUpdate: true });
    await renumberPhotos(idSosoKevitra, remaining.map((item) => item.id));
    return mapPhoto(photo);
  });
}

export async function reorderSosoKevitraPhotos(idSosoKevitra, photoIds, auth) {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  if (!Array.isArray(photoIds) || photoIds.some((id) => typeof id !== "string")) {
    throw new Error("La liste des photos est invalide");
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw new Error("La liste des photos contient des doublons");
  }

  return database.transaction(async () => {
    const sosoKevitra = await getEditableSosoKevitra(idSosoKevitra, idAuteur, { forUpdate: true });
    if (!sosoKevitra) return null;
    const existing = await getPhotosRows(idSosoKevitra, { forUpdate: true });
    const existingIds = new Set(existing.map((photo) => photo.id));
    if (photoIds.length !== existing.length || photoIds.some((id) => !existingIds.has(id))) {
      throw new Error("La liste des photos doit correspondre exactement aux photos de la proposition");
    }
    await renumberPhotos(idSosoKevitra, photoIds);
    return getPhotosRows(idSosoKevitra);
  });
}

export async function deleteSosoKevitraStoragePhotos(paths) {
  for (const path of paths) {
    await deleteStorage(path, { allowNotFound: true });
  }
}
