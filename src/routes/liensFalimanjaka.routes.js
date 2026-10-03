import express from "express";
import {
  addLien,
  editLien,
  getLien,
  getLiens,
  getLiensLangue,
  removeLien,
} from "../controllers/lienAvecFalimanjaka.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/", getLiens);
router.get("/langue/:code", getLiensLangue);
router.get("/:id", getLien);
router.post("/", requireAuth, requireRole("ADMIN"), addLien);
router.put("/:id", requireAuth, requireRole("ADMIN"), editLien);
router.delete("/:id", requireAuth, requireRole("ADMIN"), removeLien);

export default router;

