import express from "express";
import {
  addDomaineActivite,
  editDomaineActivite,
  getDomaineActivite,
  getDomainesActivite,
  getDomainesActiviteLangue,
  removeDomaineActivite,
} from "../controllers/domaineActivite.controller.js";

const router = express.Router();

router.get("/langue/:code", getDomainesActiviteLangue);
router.get("/:id", getDomaineActivite);
router.get("/", getDomainesActivite);
router.post("/", addDomaineActivite);
router.put("/:id", editDomaineActivite);
router.delete("/:id", removeDomaineActivite);

export default router;
