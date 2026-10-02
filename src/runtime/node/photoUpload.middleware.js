import multer from "multer";
import { getRequestContext, runWithRequestContext } from "../../config/requestContext.js";
import { normalizeMemoryPhotoFile } from "../../services/photoUploadInput.service.js";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function uploadError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sendUploadError(error, res) {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "La photo ne doit pas dépasser 5 MiB",
    });
  }

  if (error?.code === "PHOTO_TYPE_INVALID") {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: "Formulaire multipart invalide",
    });
  }

  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export function createPhotoUploadMiddleware() {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_SIZE, files: 10 },
    fileFilter(_req, file, callback) {
      if (!ALLOWED_TYPES.has(file.mimetype)) {
        callback(
          uploadError("Le type de fichier image est interdit", "PHOTO_TYPE_INVALID"),
        );
        return;
      }
      callback(null, true);
    },
  });

  return function parsePhotoUpload(req, res, next) {
    upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "photos", maxCount: 10 },
    ])(req, res, (error) => {
      if (error) {
        sendUploadError(error, res);
        return;
      }

      const currentContext = getRequestContext() ?? {};
      const uploadFile = normalizeMemoryPhotoFile(req.files?.photo?.[0]);
      const uploadFiles = (req.files?.photos ?? [])
        .map(normalizeMemoryPhotoFile)
        .filter(Boolean);
      runWithRequestContext(
        { ...currentContext, uploadReady: true, uploadFile, uploadFiles },
        next,
      );
    });
  };
}
