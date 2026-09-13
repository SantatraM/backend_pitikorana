import express from "express";
import cors from "cors";

import paysRoutes from "./routes/pays.routes.js";
import languesRoutes from "./routes/langues.routes.js";
import regionRoutes from "./routes/region.routes.js";
import villeRoutes from "./routes/villes.routes.js";

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

export default app;
