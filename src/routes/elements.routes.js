import express from "express";
import {
  addElement,
  editElement,
  getElement,
  getElements,
  getElementsParent,
  getElementsParentType,
  getElementsType,
  removeElement,
} from "../controllers/element.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/type/:id_type_element", getElementsType);
router.get("/parent/:id_parent/type/:id_type_element", getElementsParentType);
router.get("/parent/:id_parent", getElementsParent);
router.get("/:id", getElement);
router.get("/", getElements);
router.post("/", requireAuth, requireRole("ADMIN", "MEMBRE"), addElement);
router.put("/:id", requireAuth, requireRole("ADMIN"), editElement);
router.delete("/:id", requireAuth, requireRole("ADMIN"), removeElement);

export default router;
