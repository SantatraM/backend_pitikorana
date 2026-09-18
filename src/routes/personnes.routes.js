import express from "express";
import {
  all,
  one,
  profil,
  element,
  descendants,
  getConfidentialite,
  updateConfidentialite,
  add,
  edit,
  remove,
} from "../controllers/personne.controller.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
const r = express.Router();
r.get("/element/:id_element/descendants", optionalAuth, descendants);
r.get("/element/:id_element", optionalAuth, element);
r.get("/:id/profil", optionalAuth, profil);
r.get("/:id/confidentialite", requireAuth, getConfidentialite);
r.put("/:id/confidentialite", requireAuth, updateConfidentialite);
r.get("/:id", optionalAuth, one);
r.get("/", optionalAuth, all);
r.post("/", requireAuth, add);
r.put("/:id", requireAuth, edit);
r.delete("/:id", requireAuth, requireRole("ADMIN"), remove);
export default r;
