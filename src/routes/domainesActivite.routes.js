import express from "express";
import {
  addDomaineActivite,
  editDomaineActivite,
  getDomaineActivite,
  getDomainesActivite,
  getDomainesActiviteLangue,
  removeDomaineActivite,
} from "../controllers/domaineActivite.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/langue/:code", getDomainesActiviteLangue);
router.get("/:id", getDomaineActivite);
router.get("/", getDomainesActivite);
router.post("/", requireAuth, requireRole("ADMIN"), addDomaineActivite);
router.put("/:id", requireAuth, requireRole("ADMIN"), editDomaineActivite);
router.delete("/:id", requireAuth, requireRole("ADMIN"), removeDomaineActivite);

export default router;
