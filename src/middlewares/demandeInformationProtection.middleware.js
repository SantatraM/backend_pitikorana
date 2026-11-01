import { assertInformationOrigin, consumeInformationQuota, informationNetwork } from "../services/demandeInformationProtection.service.js";
import { sendInformationError } from "../controllers/demandeInformation.controller.js";

export function informationSameOrigin(req, res, next) {
  try { assertInformationOrigin(req); return next(); } catch (error) { return sendInformationError(res, error); }
}
export const informationNetworkLimit = (action, limit) => async (req, res, next) => {
  try {
    await consumeInformationQuota(action, informationNetwork(req), limit, 900);
    return next();
  } catch (error) { return sendInformationError(res, error); }
};
