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

const database = {
  query(sql, params) {
    const client = databaseClientStorage.getStore();

    if (client) {
      return client.query(sql, params);
    }

    return getLocalPool().query(sql, params);
  },
};

export default database;
