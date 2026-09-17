import { getRequestContext } from "../config/requestContext.js";

function storageError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getStorageConfig() {
  const env = getRequestContext()?.env;
  return {
    url: env?.SUPABASE_URL ?? process.env.SUPABASE_URL,
    secret: env?.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY,
  };
}

function encodedObjectPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function storageObjectUrl(url, bucket, path) {
  return `${url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${encodedObjectPath(path)}`;
}

export function publicStorageUrl(bucket, path) {
  const { url } = getStorageConfig();
  if (!url) return null;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encodedObjectPath(path)}`;
}

export async function uploadStorageObject(bucket, path, body, contentType) {
  const { url, secret } = getStorageConfig();
  if (!url || !secret) {
    throw storageError(
      "La configuration Storage est indisponible",
      "STORAGE_UNAVAILABLE",
    );
  }

  const response = await fetch(storageObjectUrl(url, bucket, path), {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      apikey: secret,
      "content-type": contentType,
      "x-upsert": "false",
    },
    body,
  });

  if (!response.ok) {
    throw storageError("Échec de l'envoi de la photo", "STORAGE_UPLOAD_FAILED");
  }
}

export async function deleteStorageObject(
  bucket,
  path,
  { allowNotFound = false } = {},
) {
  const { url, secret } = getStorageConfig();
  if (!url || !secret) {
    throw storageError(
      "La configuration Storage est indisponible",
      "STORAGE_UNAVAILABLE",
    );
  }

  const response = await fetch(storageObjectUrl(url, bucket, path), {
    method: "DELETE",
    headers: { authorization: `Bearer ${secret}`, apikey: secret },
  });

  if (!response.ok && !(allowNotFound && response.status === 404)) {
    throw storageError(
      "Échec de la suppression de la photo Storage",
      "STORAGE_DELETE_FAILED",
    );
  }
}
