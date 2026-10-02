import { handleAsNodeRequest } from "cloudflare:node";
import { Client } from "pg";
import { runWithDatabaseClient } from "./config/db.js";
import { runWithRequestContext } from "./config/requestContext.js";
import { normalizeWebPhotoFile } from "./services/photoUploadInput.service.js";
import { processImageWithCloudflare } from "./runtime/worker/imageProcessor.worker.js";
import app from "./app.js";

const port = 3000;
app.listen(port);

export default {
  async fetch(request, env) {
    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
    });

    try {
      await client.connect();

      let uploadFormData = null;
      let uploadFormDataError = null;
      let uploadFile = null;
      let uploadFiles = [];
      let expressRequest = request;
      const pathname = new URL(request.url).pathname;
      const isPersonPhotoUpload =
        (request.method === "POST" || request.method === "PUT") &&
        /^\/api\/photos-personne\/upload\/[^/]+$/.test(pathname);
      const isTemporaryDemandePhotoUpload =
        request.method === "POST" &&
        pathname === "/api/demandes-inscription/photo-temporaire";
      const isSosoKevitraPhotoUpload =
        request.method === "POST" &&
        /^\/api\/soso-kevitra\/[^/]+\/(?:photos|contributions\/[^/]+\/photos)$/.test(pathname);

      if (isPersonPhotoUpload || isTemporaryDemandePhotoUpload || isSosoKevitraPhotoUpload) {
        try {
          uploadFormData = await request.formData();
          if (isPersonPhotoUpload || isTemporaryDemandePhotoUpload) {
            uploadFile = normalizeWebPhotoFile(uploadFormData.get("photo"));
          } else {
            uploadFiles = uploadFormData
              .getAll("photos")
              .map(normalizeWebPhotoFile)
              .filter(Boolean);
          }
          expressRequest = new Request(request.url, {
            method: request.method,
          });
        } catch {
          uploadFormDataError = true;
        }
      }

      return await runWithRequestContext(
        {
          env,
          uploadFormData,
          uploadFormDataError,
          uploadReady: uploadFormData !== null && !uploadFormDataError,
          uploadFile,
          uploadFiles,
          imageProcessor: env.IMAGES
            ? (input) => processImageWithCloudflare(input, env.IMAGES)
            : null,
        },
        () =>
          runWithDatabaseClient(client, () =>
            handleAsNodeRequest(port, expressRequest),
          ),
      );
    } finally {
      await client.end();
    }
  },
};
