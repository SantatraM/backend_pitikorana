import express from "express";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { informationNetworkLimit, informationSameOrigin } from "../middlewares/demandeInformationProtection.middleware.js";
import { prepare, create, list, detail, stats, changeStatus, sendInformationError } from "../controllers/demandeInformation.controller.js";

const router = express.Router();
const json = express.json({ limit: "16kb", strict: true });
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); res.vary("Cookie"); next(); });
router.get("/preparation", informationNetworkLimit("preparation", 30), prepare);
router.post("/", informationSameOrigin, informationNetworkLimit("submission", 10), json, optionalAuth, create);
router.get("/statistiques", requireAuth, requireRole("ADMIN", "PASTEUR"), stats);
router.get("/", requireAuth, requireRole("ADMIN", "PASTEUR"), list);
router.get("/:id", requireAuth, requireRole("ADMIN", "PASTEUR"), detail);
router.patch("/:id/statut", requireAuth, requireRole("ADMIN", "PASTEUR"), informationSameOrigin, json, changeStatus);
router.use((error, _req, res, _next) => sendInformationError(res, error));
export default router;
