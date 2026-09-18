import express from "express";
import {
  addCentreInteret,
  editCentreInteret,
  getCentreInteret,
  getCentresInteret,
  getCentresInteretLangue,
  removeCentreInteret,
} from "../controllers/centreInteret.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/langue/:code", getCentresInteretLangue);
router.get("/:id", getCentreInteret);
router.get("/", getCentresInteret);
router.post("/", requireAuth, requireRole("ADMIN"), addCentreInteret);
router.put("/:id", requireAuth, requireRole("ADMIN"), editCentreInteret);
router.delete("/:id", requireAuth, requireRole("ADMIN"), removeCentreInteret);

export default router;
