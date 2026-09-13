import express from "express";
import {
  addLien,
  editLien,
  getLien,
  getLiens,
  getLiensLangue,
  removeLien,
} from "../controllers/lienAvecFalimanjaka.controller.js";

const router = express.Router();

router.get("/", getLiens);
router.get("/langue/:code", getLiensLangue);
router.get("/:id", getLien);
router.post("/", addLien);
router.put("/:id", editLien);
router.delete("/:id", removeLien);

export default router;
