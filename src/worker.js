import { handleAsNodeRequest } from "cloudflare:node";
import { Client } from "pg";
import { runWithDatabaseClient } from "./config/db.js";
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

      return await runWithDatabaseClient(client, () =>
        handleAsNodeRequest(port, request),
      );
    } finally {
      await client.end();
    }
  },
};
