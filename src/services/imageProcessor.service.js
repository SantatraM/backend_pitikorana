import { getRequestContext } from "../config/requestContext.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function processImage(file) {
  if (!file) throw businessError("La photo est obligatoire", "PHOTO_REQUIRED");
  if (!ALLOWED_TYPES.has(file.type)) {
    throw businessError("Le type de fichier image est interdit", "PHOTO_TYPE_INVALID");
  }
  if (file.size > MAX_SIZE) {
    throw businessError("La photo ne doit pas dépasser 5 MiB", "PHOTO_TOO_LARGE");
  }

  const images = getRequestContext()?.env?.IMAGES;
  if (!images) {
    throw businessError(
      "L'upload d'image doit être exécuté via Wrangler avec Cloudflare Images",
      "IMAGE_PROCESSOR_UNAVAILABLE",
    );
  }

  try {
    const response = (
      await images
        .input(file.stream())
        .transform({ width: 1200, height: 1200, fit: "scale-down" })
        .output({ format: "image/webp", quality: 80 })
    ).response();

    return new Uint8Array(await response.arrayBuffer());
  } catch {
    throw businessError("L'image est invalide ou corrompue", "PHOTO_INVALID");
  }
}
