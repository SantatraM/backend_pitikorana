import database from "../config/db.js";
import PhotoPersonne from "../models/PhotoPersonne.js";
import { assertCanManagePersonne } from "./personneAuthorization.service.js";
import {
  filterPhotoConfidentielle,
  filterPhotosConfidentielles,
  getConfidentialitesByPersonnes,
} from "./confidentialitePersonne.service.js";
import { processImage } from "./imageProcessor.service.js";
import {
  createSignedStorageUrl,
  createSignedStorageUrls,
  deleteStorageObject,
  uploadStorageObject,
} from "./storage.service.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapPhotoRow(row) {
  return new PhotoPersonne({
    id: row.id,
    id_personne: row.id_personne,
    chemin_photo: row.chemin_photo,
  });
}

async function validateUniquePersonPhoto(idPersonne) {
  const result = await database.query(
    "SELECT id FROM photos_personne WHERE id_personne = $1",
    [idPersonne],
  );
  if (result.rows[0]) {
    throw businessError(
      "Cette personne possède déjà une photo",
      "PERSON_PHOTO_EXISTS",
    );
  }
}

async function validateUniquePhotoPath(cheminPhoto, excludedId = null) {
  const result = excludedId
    ? await database.query(
        "SELECT id FROM photos_personne WHERE chemin_photo = $1 AND id <> $2",
        [cheminPhoto, excludedId],
      )
    : await database.query(
        "SELECT id FROM photos_personne WHERE chemin_photo = $1",
        [cheminPhoto],
      );

  if (result.rows[0]) {
    throw businessError("Cette photo est déjà enregistrée", "PHOTO_PATH_EXISTS");
  }
}

function normalizeUniqueError(error) {
  if (error.code !== "23505") {
    throw error;
  }

  if (error.constraint?.includes("chemin_photo")) {
    throw businessError("Cette photo est déjà enregistrée", "PHOTO_PATH_EXISTS");
  }

  throw businessError(
    "Cette personne possède déjà une photo",
    "PERSON_PHOTO_EXISTS",
  );
}

export async function getAllPhotosPersonne() {
  const result = await database.query("SELECT * FROM photos_personne ORDER BY id");
  return result.rows.map(mapPhotoRow);
}

async function filterPhotoForReader(photo, auth) {
  const configurations = await getConfidentialitesByPersonnes([
    photo.id_personne,
  ]);
  const visiblePhoto = filterPhotoConfidentielle(
    photo,
    configurations[photo.id_personne],
    auth,
  );
  if (!visiblePhoto) return null;

  return {
    id: visiblePhoto.id,
    id_personne: visiblePhoto.id_personne,
    url_photo: await createSignedStorageUrl(
      "photos_personne",
      visiblePhoto.chemin_photo,
    ),
  };
}

export async function getAllPhotosPersonneForReader(auth = null) {
  const visiblePhotos = await filterPhotosConfidentielles(
    await getAllPhotosPersonne(),
    auth,
  );
  const signedUrls = await createSignedStorageUrls(
    "photos_personne",
    visiblePhotos.map((photo) => photo.chemin_photo),
  );

  return visiblePhotos.map((photo) => ({
    id: photo.id,
    id_personne: photo.id_personne,
    url_photo: signedUrls.get(photo.chemin_photo),
  }));
}

export async function getPhotoPersonneById(id) {
  const result = await database.query(
    "SELECT * FROM photos_personne WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapPhotoRow(result.rows[0]) : null;
}

// undefined signifie que la photo n'existe pas ; null signifie qu'elle existe
// mais qu'elle n'est pas visible par le lecteur.
export async function getPhotoPersonneByIdForReader(id, auth = null) {
  const photo = await getPhotoPersonneById(id);
  return photo ? filterPhotoForReader(photo, auth) : undefined;
}

export async function getPhotoByPersonne(idPersonne) {
  const result = await database.query(
    "SELECT * FROM photos_personne WHERE id_personne = $1",
    [idPersonne],
  );
  return result.rows[0] ? mapPhotoRow(result.rows[0]) : null;
}

export async function getPhotoByPersonneForReader(idPersonne, auth = null) {
  const photo = await getPhotoByPersonne(idPersonne);
  return photo ? filterPhotoForReader(photo, auth) : undefined;
}

export async function createPhotoPersonne(photo, auth) {
  await assertCanManagePersonne(photo.id_personne, auth);
  await validateUniquePersonPhoto(photo.id_personne);
  await validateUniquePhotoPath(photo.chemin_photo);

  try {
    const result = await database.query(
      `INSERT INTO photos_personne (id_personne, chemin_photo)
      VALUES ($1, $2)
      RETURNING *`,
      [photo.id_personne, photo.chemin_photo],
    );
    return mapPhotoRow(result.rows[0]);
  } catch (error) {
    normalizeUniqueError(error);
  }
}

async function uploadStorage(path, image) {
  return uploadStorageObject("photos_personne", path, image, "image/webp");
}

async function deleteStorage(path, { allowNotFound = false } = {}) {
  return deleteStorageObject("photos_personne", path, { allowNotFound });
}

export async function uploadPhotoPersonne(idPersonne, file, auth) {
  await assertCanManagePersonne(idPersonne, auth);
  await validateUniquePersonPhoto(idPersonne);

  const image = await processImage(file);
  const cheminPhoto = `personnes/${idPersonne}/${crypto.randomUUID()}.webp`;
  let uploadedPath = null;
  let photo = null;

  try {
    await uploadStorage(cheminPhoto, image);
    uploadedPath = cheminPhoto;
    photo = await createPhotoPersonne(
      new PhotoPersonne({ id_personne: idPersonne, chemin_photo: cheminPhoto }),
      auth,
    );
  } catch (error) {
    if (uploadedPath) {
      try {
        await deleteStorage(uploadedPath);
      } catch {
        console.error("Impossible de nettoyer la photo Storage après échec DB");
      }
    }
    throw error;
  }

  return {
    photo,
    url_photo: await createSignedStorageUrl("photos_personne", cheminPhoto),
  };
}

export async function replaceUploadedPhotoPersonne(idPersonne, file, auth) {
  await assertCanManagePersonne(idPersonne, auth);

  const existing = await getPhotoByPersonne(idPersonne);
  if (!existing) {
    throw businessError(
      "Cette personne ne possède pas de photo",
      "PERSON_PHOTO_NOT_FOUND",
    );
  }

  const image = await processImage(file);
  const nouveauChemin = `personnes/${idPersonne}/${crypto.randomUUID()}.webp`;
  let uploadedPath = null;
  let photo = null;

  try {
    await uploadStorage(nouveauChemin, image);
    uploadedPath = nouveauChemin;

    const result = await database.query(
      `UPDATE photos_personne
      SET chemin_photo = $1
      WHERE id = $2 AND chemin_photo = $3
      RETURNING *`,
      [nouveauChemin, existing.id, existing.chemin_photo],
    );

    if (!result.rows[0]) {
      throw businessError(
        "La photo a été modifiée par une autre requête",
        "PHOTO_REPLACEMENT_CONFLICT",
      );
    }

    photo = mapPhotoRow(result.rows[0]);

    try {
      await deleteStorage(existing.chemin_photo);
    } catch {
      console.error("Impossible de nettoyer l'ancienne photo Storage");
    }

  } catch (error) {
    if (uploadedPath && !photo) {
      try {
        await deleteStorage(uploadedPath);
      } catch {
        console.error("Impossible de nettoyer la nouvelle photo Storage après échec DB");
      }
    }
    throw error;
  }

  return {
    photo,
    url_photo: await createSignedStorageUrl("photos_personne", nouveauChemin),
  };
}

export async function updatePhotoPersonne(id, cheminPhoto, auth) {
  const existing = await getPhotoPersonneById(id);
  if (!existing) {
    return null;
  }

  await assertCanManagePersonne(existing.id_personne, auth);

  const photo = new PhotoPersonne({
    id: existing.id,
    id_personne: existing.id_personne,
    chemin_photo: cheminPhoto,
  });
  await validateUniquePhotoPath(photo.chemin_photo, id);

  try {
    const result = await database.query(
      `UPDATE photos_personne
      SET chemin_photo = $1
      WHERE id = $2
      RETURNING *`,
      [photo.chemin_photo, id],
    );
    return mapPhotoRow(result.rows[0]);
  } catch (error) {
    normalizeUniqueError(error);
  }
}

export async function deletePhotoPersonne(id, auth) {
  const photo = await getPhotoPersonneById(id);
  if (!photo) {
    return null;
  }

  await assertCanManagePersonne(photo.id_personne, auth);

  // Le fichier est supprimé avant la référence SQL afin qu'une erreur Storage
  // laisse la ligne disponible pour une nouvelle tentative de suppression.
  await deleteStorage(photo.chemin_photo, { allowNotFound: true });

  const result = await database.query(
    `DELETE FROM photos_personne
    WHERE id = $1 AND chemin_photo = $2
    RETURNING *`,
    [photo.id, photo.chemin_photo],
  );

  if (!result.rows[0]) {
    throw businessError(
      "La photo a été modifiée pendant la suppression",
      "PHOTO_DELETE_CONFLICT",
    );
  }

  return mapPhotoRow(result.rows[0]);
}
