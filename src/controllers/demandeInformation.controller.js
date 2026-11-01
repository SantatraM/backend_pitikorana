import { createInformation, listInformation, getInformation, informationStats, updateInformationStatus } from "../services/demandeInformation.service.js";
import { prepareInformationForm } from "../services/demandeInformationProtection.service.js";

export function sendInformationError(res, error) {
  const parse = error.type === "entity.parse.failed";
  const large = error.type === "entity.too.large";
  const known = typeof error.code === "string" && (error.code.startsWith("INFORMATION_") || error.code === "AUTH_REQUIRED");
  const status = large ? 413 : parse ? 400 : known ? error.status ?? 400 : 503;
  const code = error.code === "42P01" ? "INFORMATION_SCHEMA_REQUIRED" : large ? "INFORMATION_TOO_LARGE" : parse ? "INFORMATION_INVALID" : known ? error.code : "INFORMATION_UNAVAILABLE";
  if (status === 429) res.set("Retry-After", String(error.retryAfter ?? 60));
  // Never log request bodies, contact details, SQL parameters or token contents.
  return res.status(status).json({ success: false, code, message: "La demande ne peut pas être traitée pour le moment." });
}
const handler = (work, status = 200) => async (req, res) => {
  try { return res.status(status).json({ success: true, data: await work(req) }); }
  catch (error) { return sendInformationError(res, error); }
};
export const prepare = handler(() => prepareInformationForm());
export const create = handler(req => createInformation(req.body, req.auth, req.get("Idempotency-Key")), 201);
export const list = handler(req => listInformation(req.query, req.auth));
export const detail = handler(req => getInformation(req.params.id, req.auth));
export const stats = handler(req => informationStats(req.auth));
export const changeStatus = handler(req => updateInformationStatus(req.params.id, req.body, req.auth));
