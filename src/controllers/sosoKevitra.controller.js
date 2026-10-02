import {
  createBrouillonSosoKevitra,
  demanderCorrectionSosoKevitra,
  deleteBrouillonSosoKevitra,
  getCategoriesContribution,
  getMesPropositionsSosoKevitra,
  getMesBrouillonsSosoKevitra,
  getSosoKevitraAVerifier,
  getSosoKevitraById,
  getSosoKevitraPublics,
  getStatutsSosoKevitra,
  nonPublierSosoKevitra,
  publierSosoKevitra,
  soumettreSosoKevitra,
  updateBrouillonSosoKevitra,
} from "../services/sosoKevitra.service.js";
import {
  deleteSosoKevitraPhoto,
  reorderSosoKevitraPhotos,
  uploadSosoKevitraPhotos,
} from "../services/sosoKevitraPhoto.service.js";
import {
  addSoutienSosoKevitra,
  removeSoutienSosoKevitra,
} from "../services/sosoKevitraSoutien.service.js";
import {
  createContribution,
  listContributions,
  masquerContribution,
  restaurerContribution,
  updateContribution,
  withdrawContribution,
  uploadContributionPhotos,
  deleteContributionPhoto,
  reorderContributionPhotos,
} from "../services/sosoKevitraContribution.service.js";
import { prolongerConsultation } from "../services/sosoKevitraProlongation.service.js";
import { prendreDecisionFinale } from "../services/sosoKevitraDecision.service.js";
import { getRequestContext } from "../config/requestContext.js";
import { normalizeMemoryPhotoFile } from "../services/photoUploadInput.service.js";

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

function handleError(error, res) {
  if (error.code === "LANG_INVALID") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (["AUTH_REQUIRED"].includes(error.code)) {
    return res.status(401).json({ success: false, message: error.message });
  }
  if (["SOSO_KEVITRA_ADMIN_FORBIDDEN"].includes(error.code)) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (["SOSO_KEVITRA_PHOTO_FORBIDDEN"].includes(error.code)) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (["SOSO_KEVITRA_PHOTO_LIMIT"].includes(error.code)) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (
    ["PHOTO_REQUIRED", "PHOTO_TYPE_INVALID", "PHOTO_INVALID"].includes(
      error.code,
    )
  ) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (["PHOTO_TOO_LARGE"].includes(error.code)) {
    return res.status(413).json({ success: false, message: error.message });
  }
  if (["IMAGE_PROCESSOR_UNAVAILABLE"].includes(error.code)) {
    return res.status(501).json({ success: false, message: error.message });
  }
  if (["SOSO_KEVITRA_PHOTO_DELETE_CONFLICT"].includes(error.code)) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (
    [
      "SOSO_KEVITRA_CONSULTATION_CLOSED",
      "SOSO_KEVITRA_AUTHOR_SUPPORT_FORBIDDEN",
    ].includes(error.code)
  ) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (["SOSO_KEVITRA_ALREADY_SUPPORTED"].includes(error.code)) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (["SOSO_KEVITRA_SUPPORT_NOT_FOUND"].includes(error.code)) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (["CONTRIBUTION_FORBIDDEN", "CONSULTATION_CLOSED"].includes(error.code)) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (
    ["CONTRIBUTION_INVALID", "CONTRIBUTION_CATEGORY_INVALID"].includes(
      error.code,
    )
  ) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (
    ["CONTRIBUTION_PHOTO_LIMIT", "CONTRIBUTION_PHOTO_INVALID"].includes(
      error.code,
    )
  ) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (["CONTRIBUTION_STATE_INVALID"].includes(error.code)) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (["WORKFLOW_TRANSITION_INVALID"].includes(error.code)) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (["SUBMISSION_INVALID"].includes(error.code)) {
    return res.status(400).json({
      success: false,
      message: error.message,
      details: error.details ?? [],
    });
  }
  if (["SOSO_KEVITRA_STATUS_NOT_FOUND"].includes(error.code)) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Configuration Soso-kevitra indisponible",
      });
  }
  if (error.code) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
  return res.status(400).json({ success: false, message: error.message });
}

export async function getStatuts(req, res) {
  try {
    return res.json({
      success: true,
      data: await getStatutsSosoKevitra(req.query.lang ?? "fr"),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getCategories(req, res) {
  try {
    return res.json({
      success: true,
      data: await getCategoriesContribution(req.query.lang ?? "fr"),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getPublics(req, res) {
  try {
    return res.json({
      success: true,
      data: await getSosoKevitraPublics(req.auth, req.query.lang ?? "fr"),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createBrouillon(req, res) {
  try {
    const brouillon = await createBrouillonSosoKevitra(
      req.body,
      req.auth,
      req.query.lang ?? "fr",
    );
    return res.status(201).json({
      success: true,
      message: "Brouillon Soso-kevitra créé avec succès",
      data: brouillon,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getBrouillon(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const brouillon = await getSosoKevitraById(
      req.params.id,
      req.auth,
      req.query.lang ?? "fr",
    );
    if (!brouillon) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    return res.json({ success: true, data: brouillon });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getMesPropositions(req, res) {
  try {
    return res.json({
      success: true,
      data: await getMesPropositionsSosoKevitra(
        req.auth,
        req.query.lang ?? "fr",
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getAdminAVerifier(req, res) {
  try {
    return res.json({
      success: true,
      data: await getSosoKevitraAVerifier(req.auth, req.query.lang ?? "fr"),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getMesBrouillons(req, res) {
  try {
    return res.json({
      success: true,
      data: await getMesBrouillonsSosoKevitra(req.auth, req.query.lang ?? "fr"),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function editBrouillon(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const brouillon = await updateBrouillonSosoKevitra(
      req.params.id,
      req.body,
      req.auth,
      req.query.lang ?? "fr",
    );
    if (!brouillon) {
      return res
        .status(404)
        .json({ success: false, message: "Brouillon introuvable" });
    }
    return res.json({
      success: true,
      message: "Brouillon Soso-kevitra modifié avec succès",
      data: brouillon,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function removeBrouillon(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const brouillon = await deleteBrouillonSosoKevitra(req.params.id, req.auth);
    if (!brouillon) {
      return res
        .status(404)
        .json({ success: false, message: "Brouillon introuvable" });
    }
    return res.json({
      success: true,
      message: "Brouillon Soso-kevitra supprimé avec succès",
      data: brouillon,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function transition(req, res, operation, message) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const sosoKevitra = await operation(
      req.params.id,
      req.body,
      req.auth,
      req.query.lang ?? "fr",
    );
    if (!sosoKevitra) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    return res.json({ success: true, message, data: sosoKevitra });
  } catch (error) {
    return handleError(error, res);
  }
}

export function soumettre(req, res) {
  return transition(
    req,
    res,
    (id, _body, auth, lang) => soumettreSosoKevitra(id, auth, lang),
    "Soso-kevitra soumis avec succès",
  );
}

export function demanderCorrection(req, res) {
  return transition(
    req,
    res,
    demanderCorrectionSosoKevitra,
    "Correction demandée avec succès",
  );
}

export function nonPublier(req, res) {
  return transition(req, res, nonPublierSosoKevitra, "Soso-kevitra non publié");
}

export function publier(req, res) {
  return transition(
    req,
    res,
    publierSosoKevitra,
    "Soso-kevitra publié avec succès",
  );
}

function getUploadedPhotos(req) {
  const context = getRequestContext();
  if (context?.uploadFormDataError) {
    throw new Error("Formulaire multipart invalide");
  }
  if (Array.isArray(context?.uploadFiles)) return context.uploadFiles;
  const memoryFiles = Array.isArray(req.files?.photos) ? req.files.photos : [];
  return memoryFiles.map(normalizeMemoryPhotoFile).filter(Boolean);
}

export async function uploadPhotos(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const files = getUploadedPhotos(req);
    const photos = await uploadSosoKevitraPhotos(
      req.params.id,
      files,
      req.auth,
    );
    if (!photos) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    return res.status(201).json({
      success: true,
      message: "Photos ajoutées avec succès",
      data: photos,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function removePhoto(req, res) {
  if (!isUuid(req.params.id) || !isUuid(req.params.photoId))
    return invalidId(res);
  try {
    const photo = await deleteSosoKevitraPhoto(
      req.params.id,
      req.params.photoId,
      req.auth,
    );
    if (photo === null) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    if (photo === undefined) {
      return res
        .status(404)
        .json({ success: false, message: "Photo introuvable" });
    }
    return res.json({
      success: true,
      message: "Photo supprimée avec succès",
      data: photo,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function reorderPhotos(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  if (
    !Array.isArray(req.body?.photo_ids) ||
    req.body.photo_ids.some((id) => !isUuid(id))
  ) {
    return res
      .status(400)
      .json({ success: false, message: "La liste des photos est invalide" });
  }
  try {
    const photos = await reorderSosoKevitraPhotos(
      req.params.id,
      req.body?.photo_ids,
      req.auth,
    );
    if (!photos) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    return res.json({
      success: true,
      message: "Ordre des photos mis à jour",
      data: photos,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function addSoutien(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const soutien = await addSoutienSosoKevitra(req.params.id, req.auth);
    if (!soutien) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    return res
      .status(201)
      .json({
        success: true,
        message: "Soutien ajouté avec succès",
        data: soutien,
      });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function removeSoutien(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const soutien = await removeSoutienSosoKevitra(req.params.id, req.auth);
    if (!soutien) {
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    }
    return res.json({
      success: true,
      message: "Soutien retiré avec succès",
      data: soutien,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getContributions(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    return res.json({
      success: true,
      data: await listContributions(
        req.params.id,
        req.auth,
        req.query.lang ?? "fr",
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}
async function contributionWrite(req, res, operation, message) {
  if (!isUuid(req.params.id) || !isUuid(req.params.contributionId))
    return invalidId(res);
  try {
    const data = await operation(
      req.params.id,
      req.params.contributionId,
      req.body,
      req.auth,
      req.query.lang ?? "fr",
    );
    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "Contribution introuvable" });
    return res.json({ success: true, message, data });
  } catch (error) {
    return handleError(error, res);
  }
}
export async function addContribution(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const data = await createContribution(
      req.params.id,
      req.body,
      req.auth,
      req.query.lang ?? "fr",
    );
    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "Soso-kevitra introuvable" });
    return res
      .status(201)
      .json({ success: true, message: "Contribution créée avec succès", data });
  } catch (error) {
    return handleError(error, res);
  }
}
export const editContribution = (req, res) =>
  contributionWrite(
    req,
    res,
    updateContribution,
    "Contribution modifiée avec succès",
  );
export const removeContribution = (req, res) =>
  contributionWrite(
    req,
    res,
    (id, cid, _body, auth) => withdrawContribution(id, cid, auth),
    "Contribution retirée avec succès",
  );
export const masquer = (req, res) =>
  contributionWrite(
    req,
    res,
    masquerContribution,
    "Contribution masquée avec succès",
  );
export const restaurer = (req, res) =>
  contributionWrite(
    req,
    res,
    restaurerContribution,
    "Contribution restaurée avec succès",
  );

function contributionFiles(req) {
  const context = getRequestContext();
  if (context?.uploadFormDataError)
    throw new Error("Formulaire multipart invalide");
  if (Array.isArray(context?.uploadFiles)) return context.uploadFiles;
  return (req.files?.photos ?? [])
    .map(normalizeMemoryPhotoFile)
    .filter(Boolean);
}
async function contributionPhotoWrite(req, res, op, message) {
  if (!isUuid(req.params.id) || !isUuid(req.params.contributionId))
    return invalidId(res);
  try {
    const data = await op();
    if (data === null)
      return res
        .status(404)
        .json({ success: false, message: "Contribution introuvable" });
    if (data === undefined)
      return res
        .status(404)
        .json({ success: false, message: "Photo introuvable" });
    return res.status(201).json({ success: true, message, data });
  } catch (error) {
    return handleError(error, res);
  }
}
export const addContributionPhotos = (req, res) =>
  contributionPhotoWrite(
    req,
    res,
    () =>
      uploadContributionPhotos(
        req.params.id,
        req.params.contributionId,
        contributionFiles(req),
        req.auth,
      ),
    "Photos ajoutées avec succès",
  );
export const removeContributionPhoto = (req, res) => {
  if (!isUuid(req.params.photoId)) return invalidId(res);
  return contributionPhotoWrite(
    req,
    res,
    () =>
      deleteContributionPhoto(
        req.params.id,
        req.params.contributionId,
        req.params.photoId,
        req.auth,
      ),
    "Photo supprimée avec succès",
  );
};
export const reorderContributionPhotosHandler = (req, res) =>
  contributionPhotoWrite(
    req,
    res,
    () =>
      reorderContributionPhotos(
        req.params.id,
        req.params.contributionId,
        req.body?.photo_ids,
        req.auth,
      ),
    "Ordre des photos mis à jour",
  );

export async function prolonger(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const data = await prolongerConsultation(
      req.params.id,
      req.body?.nouvelle_date_fin_consultation,
      req.body?.raison,
      req.auth?.personne,
    );
    return res.json({ success: true, message: "Consultation prolongée avec succès", data });
  } catch (error) {
    if (error.code === "SOSO_KEVITRA_NOT_FOUND") return res.status(404).json({ success: false, message: error.message });
    if (["PROLONGATION_INVALID", "PROLONGATION_STATE_INVALID", "PROLONGATION_DECISION_EXISTS"].includes(error.code)) return res.status(400).json({ success: false, message: error.message });
    if (error.code === "AUTH_REQUIRED") return res.status(401).json({ success: false, message: error.message });
    if (error.code === "SOSO_KEVITRA_STATUS_NOT_FOUND") return res.status(500).json({ success: false, message: "Configuration Soso-kevitra indisponible" });
    return handleError(error, res);
  }
}

export async function prendreDecision(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  try {
    const data = await prendreDecisionFinale(
      req.params.id,
      req.body?.decision,
      req.body?.observation,
      req.auth?.personne,
    );
    return res.json({ success: true, message: "Décision finale enregistrée avec succès", data });
  } catch (error) {
    if (error.code === "SOSO_KEVITRA_NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.code === "DECISION_ALREADY_EXISTS") {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (["DECISION_INVALID", "DECISION_STATE_INVALID", "DECISION_CONSULTATION_OPEN"].includes(error.code)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === "AUTH_REQUIRED") {
      return res.status(401).json({ success: false, message: error.message });
    }
    if (error.code === "SOSO_KEVITRA_STATUS_NOT_FOUND") {
      return res.status(500).json({ success: false, message: "Configuration Soso-kevitra indisponible" });
    }
    return handleError(error, res);
  }
}
