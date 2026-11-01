import express from "express";
import {
  createFandraisanAnjara,
  searchFandraisanAnjaraContributors,
  cancelFandraisanAnjara,
  getFandraisanAnjara,
  getFandraisanAnjaraNonDetermineDetail,
  getFandraisanAnjaraParRazambe,
  getFandraisanAnjaraRazambeDetail,
  getFandraisanAnjaraStatistiques,
  getFandraisanAnjaraHistorique,
  listFandraisanAnjara,
  updateFandraisanAnjara,
} from "../controllers/fandraisanAnjara.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireBusinessAdmin } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/", requireAuth, listFandraisanAnjara);
router.post("/", requireAuth, requireBusinessAdmin, createFandraisanAnjara);
router.get("/statistiques", requireAuth, getFandraisanAnjaraStatistiques);
router.get("/razambe", requireAuth, getFandraisanAnjaraParRazambe);
router.get("/razambe/non-determine", requireAuth, getFandraisanAnjaraNonDetermineDetail);
router.get("/razambe/:id", requireAuth, getFandraisanAnjaraRazambeDetail);
router.get("/contributeurs/selection", requireAuth, requireBusinessAdmin, searchFandraisanAnjaraContributors);
router.get("/:id/historique", requireAuth, requireBusinessAdmin, getFandraisanAnjaraHistorique);
router.put("/:id", requireAuth, requireBusinessAdmin, updateFandraisanAnjara);
router.post("/:id/annuler", requireAuth, requireBusinessAdmin, cancelFandraisanAnjara);
router.get("/:id", requireAuth, getFandraisanAnjara);

export default router;
