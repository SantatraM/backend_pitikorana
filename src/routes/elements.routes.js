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

const router = express.Router();

router.get("/type/:id_type_element", getElementsType);
router.get("/parent/:id_parent/type/:id_type_element", getElementsParentType);
router.get("/parent/:id_parent", getElementsParent);
router.get("/:id", getElement);
router.get("/", getElements);
router.post("/", addElement);
router.put("/:id", editElement);
router.delete("/:id", removeElement);

export default router;
