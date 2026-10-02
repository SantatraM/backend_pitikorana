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

  const imageProcessor = getRequestContext()?.imageProcessor;
  if (typeof imageProcessor !== "function") {
    throw businessError(
      "Le processeur d'image est indisponible dans cet environnement",
      "IMAGE_PROCESSOR_UNAVAILABLE",
    );
  }

  try {
    const image = await imageProcessor(file);
    return image instanceof Uint8Array ? image : new Uint8Array(image);
  } catch (error) {
    if (error?.code) throw error;
    throw businessError("L'image est invalide ou corrompue", "PHOTO_INVALID");
  }
}
