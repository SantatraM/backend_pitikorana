import express from "express";
import {
    getPays,
    getPaysId,
    addPays,
    editPays,
    removePays,
} from "../controllers/pays.controller.js";

const router = express.Router();

router.get("/", getPays);
router.get("/:id", getPaysId);
router.post("/", addPays);
router.put("/:id", editPays);
router.delete("/:id", removePays);

export default router;
