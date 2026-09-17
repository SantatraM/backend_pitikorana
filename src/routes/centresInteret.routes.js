import express from "express";
import {
  addCentreInteret,
  editCentreInteret,
  getCentreInteret,
  getCentresInteret,
  getCentresInteretLangue,
  removeCentreInteret,
} from "../controllers/centreInteret.controller.js";

const router = express.Router();

router.get("/langue/:code", getCentresInteretLangue);
router.get("/:id", getCentreInteret);
router.get("/", getCentresInteret);
router.post("/", addCentreInteret);
router.put("/:id", editCentreInteret);
router.delete("/:id", removeCentreInteret);

export default router;
