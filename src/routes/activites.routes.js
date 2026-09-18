import express from "express";
import {
  addActivite,
  editActivite,
  getActivite,
  getActivites,
  getActivitesDomaine,
  getActivitesDomaineLangue,
  getActivitesLangue,
  removeActivite,
} from "../controllers/activite.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/langue/:code", getActivitesLangue);
router.get("/domaine/:id_domaine/langue/:code", getActivitesDomaineLangue);
router.get("/domaine/:id_domaine", getActivitesDomaine);
router.get("/:id", getActivite);
router.get("/", getActivites);
router.post("/", requireAuth, requireRole("ADMIN"), addActivite);
router.put("/:id", requireAuth, requireRole("ADMIN"), editActivite);
router.delete("/:id", requireAuth, requireRole("ADMIN"), removeActivite);

export default router;
