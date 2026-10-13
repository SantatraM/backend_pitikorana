import express from "express";
import {
  getTetikasa,
  updateTetikasa,
  updateTetikasaContent,
} from "../controllers/tetikasa.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/:id", requireAuth, getTetikasa);
router.put("/:id", requireAuth, requireRole("ADMIN", "PASTEUR"), updateTetikasa);
router.put("/:id/contenu", requireAuth, requireRole("ADMIN", "PASTEUR"), updateTetikasaContent);

export default router;
