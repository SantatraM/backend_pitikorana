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

const router = express.Router();

router.get("/langue/:code", getActivitesLangue);
router.get("/domaine/:id_domaine/langue/:code", getActivitesDomaineLangue);
router.get("/domaine/:id_domaine", getActivitesDomaine);
router.get("/:id", getActivite);
router.get("/", getActivites);
router.post("/", addActivite);
router.put("/:id", editActivite);
router.delete("/:id", removeActivite);

export default router;
