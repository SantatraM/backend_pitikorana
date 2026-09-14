import express from "express";
import {
  all,
  one,
  element,
  descendants,
  add,
  edit,
  remove,
} from "../controllers/personne.controller.js";
const r = express.Router();
r.get("/element/:id_element/descendants", descendants);
r.get("/element/:id_element", element);
r.get("/:id", one);
r.get("/", all);
r.post("/", add);
r.put("/:id", edit);
r.delete("/:id", remove);
export default r;
