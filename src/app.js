import express from "express";
import cors from "cors";

import paysRoutes from "./routes/pays.routes.js";
import languesRoutes from "./routes/langues.routes.js";
import regionRoutes from "./routes/region.routes.js";
import villeRoutes from "./routes/villes.routes.js";
import liensFalimanjakaRoutes from "./routes/liensFalimanjaka.routes.js";
import typesElementRoutes from "./routes/typesElement.routes.js";
import elementsRoutes from "./routes/elements.routes.js";
import sexesRoutes from "./routes/sexes.routes.js";
import statutsRoutes from "./routes/statuts.routes.js";
import personnesRoutes from "./routes/personnes.routes.js";
import contactsPersonneRoutes from "./routes/contactsPersonne.routes.js";
import typesRelationRoutes from "./routes/typesRelation.routes.js";
import relationsPersonneRoutes from "./routes/relationsPersonne.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend Pitikorana opérationnel",
  });
});

app.use("/api/pays", paysRoutes);
app.use("/api/langues", languesRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/villes", villeRoutes);
app.use("/api/liens-falimanjaka", liensFalimanjakaRoutes);
app.use("/api/types-element", typesElementRoutes);
app.use("/api/elements", elementsRoutes);
app.use("/api/sexes", sexesRoutes);
app.use("/api/statuts", statutsRoutes);
app.use("/api/personnes", personnesRoutes);
app.use("/api/contacts-personne", contactsPersonneRoutes);
app.use("/api/types-relation", typesRelationRoutes);
app.use("/api/relations-personne", relationsPersonneRoutes);

export default app;
