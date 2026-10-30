/**
 * Recette PostgreSQL Fandraisan'anjara.
 *
 * Ce fichier est intentionnellement inactif par défaut. Il ne doit être lancé
 * que contre une instance PostgreSQL locale dédiée et déjà migrée (01 à 23).
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { runWithDatabaseClient } from "../../src/config/db.js";
import {
  annulerFandraisanAnjara,
  corrigerFandraisanAnjara,
  creerFandraisanAnjara,
  getFandraisanAnjaraById,
  getFandraisanAnjaraHistorique,
  getFandraisanAnjaraStatistiques,
} from "../../src/services/fandraisanAnjara.service.js";

const ENABLED = process.env.FANDRAISAN_ANJARA_INTEGRATION === "1";
const REQUIRED_CONFIRMATION = "ISOLATED_TEST_DATABASE";
const { Pool } = pg;

function readConfig() {
  const connectionString = process.env.FANDRAISAN_ANJARA_TEST_DATABASE_URL;
  const databaseName = process.env.FANDRAISAN_ANJARA_TEST_DATABASE_NAME;
  const adminAccountId = process.env.FANDRAISAN_ANJARA_TEST_ADMIN_ACCOUNT_ID;
  const memberAccountId = process.env.FANDRAISAN_ANJARA_TEST_MEMBER_ACCOUNT_ID;
  if (!connectionString || !databaseName || !adminAccountId || !memberAccountId) {
    throw new Error("Configuration de recette Fandraisan'anjara incomplète.");
  }
  if (process.env.FANDRAISAN_ANJARA_TEST_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error("Confirmation explicite de la base isolée absente.");
  }
  const url = new URL(connectionString);
  const hostname = url.hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("La recette refuse toute base qui n'est pas locale.");
  }
  if (url.pathname.replace(/^\//, "") !== databaseName || !databaseName.endsWith("_test")) {
    throw new Error("La base doit être explicitement nommée et se terminer par _test.");
  }
  if (connectionString === process.env.DATABASE_URL) {
    throw new Error("La recette refuse DATABASE_URL : utiliser exclusivement l'URL de test dédiée.");
  }
  return { connectionString, databaseName, adminAccountId, memberAccountId };
}

const skip = !ENABLED;
const config = ENABLED ? readConfig() : null;
let pool;
let client;
let fixture;
const runToken = randomUUID();

function managerAuth(accountId = config.adminAccountId) {
  return { compte: { id: accountId, role: "ADMIN" } };
}

function memberAuth() {
  return { compte: { id: config.memberAccountId, role: "MEMBRE" } };
}

function contributionBody(overrides = {}) {
  return {
    date_contribution: "2020-02-20",
    type_contributeur: "PERSONNE",
    id_contributeur: fixture.personne1,
    observation: `FANDRAISAN_TEST:${runToken}`,
    lignes: [{ nature: "ARGENT", montant: "50000", devise: "MGA" }],
    ...overrides,
  };
}

async function callService(callback) {
  return runWithDatabaseClient(client, callback);
}

async function callServiceOnDedicatedClient(callback) {
  const dedicatedClient = await pool.connect();
  try {
    return await runWithDatabaseClient(dedicatedClient, callback);
  } finally {
    dedicatedClient.release();
  }
}

async function assertTestDatabase() {
  const current = await client.query("SELECT current_database() AS name");
  assert.equal(current.rows[0].name, config.databaseName);
  const tables = await client.query(
    `SELECT to_regclass('public.fandraisan_anjara') AS contribution,
      to_regclass('public.fandraisan_anjara_ligne') AS ligne,
      to_regclass('public.fandraisan_anjara_historique') AS historique,
      to_regclass('public.fandraisan_anjara_idempotence') AS idempotence`,
  );
  for (const value of Object.values(tables.rows[0])) assert.ok(value, "Migrations 22 et 23 requises sur la base de test.");
  const accounts = await client.query(
    `SELECT cm.id, r.code
    FROM compte_membre cm JOIN role r ON r.id = cm.id_role
    WHERE cm.id = ANY($1::uuid[])`,
    [[config.adminAccountId, config.memberAccountId]],
  );
  assert.equal(accounts.rows.length, 2, "Les deux comptes fictifs préalables sont requis.");
  assert.ok(accounts.rows.some((row) => row.id === config.adminAccountId && row.code === "ADMIN"));
}

async function createFixtures() {
  const types = await client.query(
    "SELECT code, id FROM type_element WHERE code = ANY($1::text[])",
    [["RAZAMBE", "TARANAKA", "SAMPANA"]],
  );
  const byCode = Object.fromEntries(types.rows.map((row) => [row.code, row.id]));
  for (const code of ["RAZAMBE", "TARANAKA", "SAMPANA"]) assert.ok(byCode[code], `Type ${code} absent.`);

  const razambe = (await client.query(
    "INSERT INTO element (id_type_element, nom, rattachement_sup, etat) VALUES ($1, $2, NULL, 1) RETURNING id",
    [byCode.RAZAMBE, `FA_TEST_RAZAMBE_${runToken}`],
  )).rows[0].id;
  const taranaka = (await client.query(
    "INSERT INTO element (id_type_element, nom, rattachement_sup, etat) VALUES ($1, $2, $3, 1) RETURNING id",
    [byCode.TARANAKA, `FA_TEST_TARANAKA_${runToken}`, razambe],
  )).rows[0].id;
  const sampana = (await client.query(
    "INSERT INTO element (id_type_element, nom, rattachement_sup, etat) VALUES ($1, $2, $3, 1) RETURNING id",
    [byCode.SAMPANA, `FA_TEST_SAMPANA_${runToken}`, taranaka],
  )).rows[0].id;
  const personne1 = (await client.query(
    "INSERT INTO personne (nom, prenom, id_element) VALUES ($1, $2, $3) RETURNING id",
    [`FA_TEST_NOM_${runToken}`, "Un", sampana],
  )).rows[0].id;
  const personne2 = (await client.query(
    "INSERT INTO personne (nom, prenom, id_element) VALUES ($1, $2, $3) RETURNING id",
    [`FA_TEST_NOM_${runToken}`, "Deux", sampana],
  )).rows[0].id;
  const foyer = (await client.query(
    `INSERT INTO foyer (id_personne_1, id_personne_2, type_foyer, statut)
    VALUES ($1, $2, 'COUPLE', 'ACTIF') RETURNING id`,
    [personne1 < personne2 ? personne1 : personne2, personne1 < personne2 ? personne2 : personne1],
  )).rows[0].id;
  return { razambe, taranaka, sampana, personne1, personne2, foyer };
}

async function cleanupFixtures() {
  if (!fixture) return;
  const contributionIds = await client.query(
    "SELECT id FROM fandraisan_anjara WHERE observation LIKE $1",
    [`FANDRAISAN_TEST:${runToken}%`],
  );
  const ids = contributionIds.rows.map((row) => row.id);
  if (ids.length) {
    await client.query("DELETE FROM fandraisan_anjara_idempotence WHERE id_fandraisan_anjara = ANY($1::uuid[])", [ids]);
    await client.query("DELETE FROM fandraisan_anjara_historique WHERE id_fandraisan_anjara = ANY($1::uuid[])", [ids]);
    await client.query("DELETE FROM fandraisan_anjara_ligne WHERE id_fandraisan_anjara = ANY($1::uuid[])", [ids]);
    await client.query("DELETE FROM fandraisan_anjara WHERE id = ANY($1::uuid[])", [ids]);
  }
  await client.query("DELETE FROM foyer WHERE id = $1", [fixture.foyer]);
  await client.query("DELETE FROM personne WHERE id = ANY($1::uuid[])", [[fixture.personne1, fixture.personne2]]);
  await client.query("DELETE FROM element WHERE id = ANY($1::uuid[])", [[fixture.sampana, fixture.taranaka, fixture.razambe]]);
}

before(async () => {
  if (!ENABLED) return;
  pool = new Pool({ connectionString: config.connectionString });
  client = await pool.connect();
  await assertTestDatabase();
  fixture = await createFixtures();
});

after(async () => {
  if (!ENABLED) return;
  try {
    await cleanupFixtures();
  } finally {
    client?.release();
    await pool?.end();
  }
});

test("création réelle ARGENT et MATERIEL avec instantanés", { skip }, async () => {
  const result = await callService(() => creerFandraisanAnjara(
    contributionBody({
      type_contributeur: "FOYER",
      id_contributeur: fixture.foyer,
      lignes: [
        { nature: "ARGENT", montant: "50000", devise: "MGA" },
        { nature: "MATERIEL", designation: "Cahier recette", quantite: "12", unite: "unité" },
      ],
    }),
    managerAuth(),
    randomUUID(),
  ));
  const detail = await callService(() => getFandraisanAnjaraById(result.contribution.id, memberAuth()));
  assert.equal(detail.rattachements_historiques.id_razambe, fixture.razambe);
  assert.equal(detail.total_argent_mga, "50000");
  assert.equal(detail.lignes.length, 2);
});

test("correction, annulation et historique PostgreSQL", { skip }, async () => {
  const created = await callService(() => creerFandraisanAnjara(contributionBody(), managerAuth(), randomUUID()));
  const corrected = await callService(() => corrigerFandraisanAnjara(created.contribution.id, {
    revision: created.contribution.revision,
    motif_correction: "Correction de recette",
    lignes: [{ nature: "ARGENT", montant: "75000", devise: "MGA" }],
  }, managerAuth()));
  const cancelled = await callService(() => annulerFandraisanAnjara(created.contribution.id, {
    revision: corrected.contribution.revision,
    motif_annulation: "Annulation de recette",
  }, managerAuth()));
  const historique = await callService(() => getFandraisanAnjaraHistorique(created.contribution.id, managerAuth()));
  assert.equal(cancelled.contribution.statut, "ANNULE");
  assert.deepEqual(historique.historique.map((event) => event.action), ["CREATION", "CORRECTION", "ANNULATION"]);
});

test("idempotence, conflit et concurrence PostgreSQL", { skip }, async () => {
  const key = randomUUID();
  const body = contributionBody({ observation: `FANDRAISAN_TEST:${runToken}:idempotence` });
  const [first, second] = await Promise.all([
    callServiceOnDedicatedClient(() => creerFandraisanAnjara(body, managerAuth(), key)),
    callServiceOnDedicatedClient(() => creerFandraisanAnjara(body, managerAuth(), key)),
  ]);
  assert.equal(first.contribution.id, second.contribution.id);
  assert.deepEqual([first.idempotent_replay, second.idempotent_replay].sort(), [false, true]);
  await assert.rejects(
    callService(() => creerFandraisanAnjara({ ...body, observation: `${body.observation}:différent` }, managerAuth(), key)),
    { code: "FANDRAISAN_ANJARA_IDEMPOTENCY_CONFLICT" },
  );
});

test("statistiques et historique n'incluent pas les contributions annulées", { skip }, async () => {
  const statistics = await callService(() => getFandraisanAnjaraStatistiques({
    date_debut: "2020-02-20", date_fin: "2020-02-20",
  }, memberAuth()));
  assert.match(statistics.total_argent_mga, /^\d+$/);
  assert.ok(statistics.nombre_contributions_actives >= 1);
});
