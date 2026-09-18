import express from "express";
import {
  getStatutCompteMembre,
  getStatutsCompteMembre,
} from "../controllers/statutCompteMembre.controller.js";

const router = express.Router();

router.get("/:id", getStatutCompteMembre);
router.get("/", getStatutsCompteMembre);

export default router;
