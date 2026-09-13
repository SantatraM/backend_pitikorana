import express from "express";

import {
  getRegions,
  getRegion,
  addRegion,
  editRegion,
  removeRegion,
} from "../controllers/region.controller.js";

const router = express.Router();

router.get("/", getRegions);

router.get("/:id", getRegion);

router.post("/", addRegion);

router.put("/:id", editRegion);

router.delete("/:id", removeRegion);

export default router;
