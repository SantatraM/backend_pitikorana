import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

const { Pool } = pg;

let localPool;
const databaseClientStorage = new AsyncLocalStorage();

function createPool(connectionString, options = {}) {
  return new Pool({
    connectionString,
    ...options,
  });
}

function getLocalPool() {
  if (!localPool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("La variable DATABASE_URL est requise");
    }

    localPool = createPool(connectionString, {
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  return localPool;
}

export function runWithDatabaseClient(client, callback) {
  return databaseClientStorage.run(client, callback);
}

async function executeTransaction(client, callback) {
  await client.query("BEGIN");

  try {
    const result = await callback();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const database = {
  query(sql, params) {
    const client = databaseClientStorage.getStore();

    if (client) {
      return client.query(sql, params);
    }

    return getLocalPool().query(sql, params);
  },

  async transaction(callback) {
    const workerClient = databaseClientStorage.getStore();

    if (workerClient) {
      return executeTransaction(workerClient, callback);
    }

    const localClient = await getLocalPool().connect();

    try {
      return await runWithDatabaseClient(localClient, () =>
        executeTransaction(localClient, callback),
      );
    } finally {
      localClient.release();
    }
  },
};

export default database;
