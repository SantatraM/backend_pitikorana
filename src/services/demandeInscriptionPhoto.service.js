import database from "../config/db.js";
import { processImage } from "./imageProcessor.service.js";
import {
  createSignedStorageUrl,
  deleteStorageObject,
  downloadStorageObject,
  uploadStorageObject,
} from "./storage.service.js";

const BUCKET = "photos_personne";
const TEMPORARY_PREFIX = "demandes-inscription/";
const TEMPORARY_PATH_PATTERN =
  /^demandes-inscription\/[0-9a-f-]{36}\.webp$/i;

function error(message, code) {
  const value = new Error(message);
  value.code = code;
  return value;
}

export function normalizeTemporaryDemandePhotoPath(value) {
  if (typeof value !== "string" || !TEMPORARY_PATH_PATTERN.test(value)) {
    throw error("La photo temporaire est invalide", "TEMPORARY_PHOTO_INVALID");
  }
  return value;
}

export async function uploadTemporaryDemandePhoto(file) {
  const image = await processImage(file);
  const path = TEMPORARY_PREFIX + crypto.randomUUID() + ".webp";
  await uploadStorageObject(BUCKET, path, image, "image/webp");
  return {
    chemin_photo_temporaire: path,
    url_photo: await createSignedStorageUrl(BUCKET, path),
  };
}

export async function assertTemporaryDemandePhoto(path) {
  const normalized = normalizeTemporaryDemandePhotoPath(path);
  await downloadStorageObject(BUCKET, normalized);
  return normalized;
}

export async function signedTemporaryDemandePhoto(path) {
  if (!path) return null;
  try {
    return await createSignedStorageUrl(
      BUCKET,
      normalizeTemporaryDemandePhotoPath(path),
    );
  } catch {
    return null;
  }
}

export async function applyTemporaryDemandePhoto(idPersonne, path) {
  const temporaryPath = normalizeTemporaryDemandePhotoPath(path);
  const content = await downloadStorageObject(BUCKET, temporaryPath);
  const finalPath = "personnes/" + idPersonne + "/" + crypto.randomUUID() + ".webp";
  let uploaded = false;

  try {
    await uploadStorageObject(BUCKET, finalPath, content, "image/webp");
    uploaded = true;

    const existing = await database.query(
      "SELECT id, chemin_photo FROM photos_personne WHERE id_personne = $1 FOR UPDATE",
      [idPersonne],
    );
    const current = existing.rows[0] ?? null;
    if (current) {
      await database.query(
        "UPDATE photos_personne SET chemin_photo = $1 WHERE id = $2",
        [finalPath, current.id],
      );
    } else {
      await database.query(
        "INSERT INTO photos_personne (id_personne, chemin_photo) VALUES ($1, $2)",
        [idPersonne, finalPath],
      );
    }

    return { finalPath, previousPath: current?.chemin_photo ?? null };
  } catch (caught) {
    if (uploaded) {
      await deleteStorageObject(BUCKET, finalPath, { allowNotFound: true }).catch(
        () => {},
      );
    }
    throw caught;
  }
}

export async function deleteTemporaryDemandePhoto(path) {
  if (!path) return;
  await deleteStorageObject(
    BUCKET,
    normalizeTemporaryDemandePhotoPath(path),
    { allowNotFound: true },
  );
}

export async function cleanupReplacedPersonPhoto(path) {
  if (!path) return;
  await deleteStorageObject(BUCKET, path, { allowNotFound: true });
}