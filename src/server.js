import "dotenv/config";
import { createApp } from "./app.js";
import { processImageWithSharp } from "./runtime/node/imageProcessor.node.js";
import { createPhotoUploadMiddleware } from "./runtime/node/photoUpload.middleware.js";

const app = createApp({
  photoUploadMiddleware: createPhotoUploadMiddleware(),
  requestContext: { imageProcessor: processImageWithSharp },
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
