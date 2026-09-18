import { getRequestContext } from "../config/requestContext.js";

export const SIGNED_URL_EXPIRES_IN = 300;

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

function storageSigningUrl(url, bucket, path = null) {
  const baseUrl = `${url.replace(/\/$/, "")}/storage/v1/object/sign/${encodeURIComponent(bucket)}`;
  return path === null ? baseUrl : `${baseUrl}/${encodedObjectPath(path)}`;
}

function storageHeaders(secret, contentType = null) {
  return {
    authorization: `Bearer ${secret}`,
    apikey: secret,
    ...(contentType ? { "content-type": contentType } : {}),
  };
}

function signedUrlFromResponse(url, payload) {
  const signedUrl = payload?.signedURL ?? payload?.signedUrl;
  if (typeof signedUrl !== "string" || !signedUrl) {
    throw storageError(
      "URL signée Storage invalide",
      "STORAGE_SIGN_URL_FAILED",
    );
  }

  if (/^https?:\/\//i.test(signedUrl)) return signedUrl;
  return `${url.replace(/\/$/, "")}/storage/v1/${signedUrl.replace(/^\//, "")}`;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    throw storageError(
      "Réponse Storage invalide",
      "STORAGE_SIGN_URL_FAILED",
    );
  }
}

export async function createSignedStorageUrl(
  bucket,
  path,
  expiresIn = SIGNED_URL_EXPIRES_IN,
) {
  const { url, secret } = getStorageConfig();
  if (!url || !secret) {
    throw storageError(
      "La configuration Storage est indisponible",
      "STORAGE_UNAVAILABLE",
    );
  }

  const response = await fetch(storageSigningUrl(url, bucket, path), {
    method: "POST",
    headers: storageHeaders(secret, "application/json"),
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) {
    throw storageError(
      "Échec de génération de l'URL signée",
      "STORAGE_SIGN_URL_FAILED",
    );
  }

  return signedUrlFromResponse(url, await responseJson(response));
}

export async function createSignedStorageUrls(
  bucket,
  paths,
  expiresIn = SIGNED_URL_EXPIRES_IN,
) {
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) return new Map();

  const { url, secret } = getStorageConfig();
  if (!url || !secret) {
    throw storageError(
      "La configuration Storage est indisponible",
      "STORAGE_UNAVAILABLE",
    );
  }

  const response = await fetch(storageSigningUrl(url, bucket), {
    method: "POST",
    headers: storageHeaders(secret, "application/json"),
    body: JSON.stringify({ expiresIn, paths: uniquePaths }),
  });
  if (!response.ok) {
    throw storageError(
      "Échec de génération des URLs signées",
      "STORAGE_SIGN_URL_FAILED",
    );
  }

  const payload = await responseJson(response);
  if (!Array.isArray(payload)) {
    throw storageError(
      "Réponse Storage invalide",
      "STORAGE_SIGN_URL_FAILED",
    );
  }

  const signedUrls = new Map();
  for (const item of payload) {
    if (item?.error || typeof item?.path !== "string") {
      throw storageError(
        "Échec de génération des URLs signées",
        "STORAGE_SIGN_URL_FAILED",
      );
    }
    signedUrls.set(item.path, signedUrlFromResponse(url, item));
  }

  if (uniquePaths.some((path) => !signedUrls.has(path))) {
    throw storageError(
      "Réponse Storage incomplète",
      "STORAGE_SIGN_URL_FAILED",
    );
  }

  return signedUrls;
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
      ...storageHeaders(secret, contentType),
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
    headers: storageHeaders(secret),
  });

  if (!response.ok && !(allowNotFound && response.status === 404)) {
    throw storageError(
      "Échec de la suppression de la photo Storage",
      "STORAGE_DELETE_FAILED",
    );
  }
}
