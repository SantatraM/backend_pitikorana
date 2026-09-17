import { handleAsNodeRequest } from "cloudflare:node";
import { Client } from "pg";
import { runWithDatabaseClient } from "./config/db.js";
import { runWithRequestContext } from "./config/requestContext.js";
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
      let expressRequest = request;

      if (
        (request.method === "POST" || request.method === "PUT") &&
        /^\/api\/photos-personne\/upload\/[^/]+$/.test(
          new URL(request.url).pathname,
        )
      ) {
        try {
          uploadFormData = await request.formData();
          expressRequest = new Request(request.url, {
            method: request.method,
          });
        } catch {
          uploadFormDataError = true;
        }
      }

      return await runWithRequestContext(
        { env, uploadFormData, uploadFormDataError },
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
