import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import {
  getFandraisanAnjaraById,
  getFandraisanAnjaraList,
} from "../src/services/fandraisanAnjara.service.js";
import {
  getFandraisanAnjara,
  listFandraisanAnjara,
} from "../src/controllers/fandraisanAnjara.controller.js";
import router from "../src/routes/fandraisanAnjara.routes.js";

const contributionId = "11111111-1111-4111-8111-111111111111";
const personId = "22222222-2222-4222-8222-222222222222";
const razambeId = "33333333-3333-4333-8333-333333333333";
const accountId = "44444444-4444-4444-8444-444444444444";
const auth = (role = "MEMBRE") => ({ compte: { id: accountId, role } });

function header(overrides = {}) {
  return {
    id: contributionId,
    date_contribution: "2026-10-20",
    type_contributeur: "PERSONNE",
    id_element_contributeur: null,
    id_foyer_contributeur: null,
    id_personne_contributeur: personId,
    contributeur_libelle_snapshot: "Rabe Jean",
    id_razambe_snapshot: razambeId,
    id_taranaka_snapshot: null,
    id_sampana_snapshot: null,
    resolution_razambe: "RESOLU",
    observation: "Observation publique",
    statut: "ACTIF",
    revision: 1,
    total_argent_mga: "57000",
    materiels: [{ designation: "Cahier", unite: "unité", quantite: "12" }],
    ...overrides,
  };
}

function mockDb({ rows = [header()], total = 1, detail = header(), lines = [], missing = false } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT COUNT(*)::integer AS total FROM fandraisan_anjara")) return { rows: [{ total }] };
      if (sql.includes("FROM fandraisan_anjara f") && sql.includes("LIMIT $")) return { rows };
      if (sql.includes("FROM fandraisan_anjara f") && sql.includes("WHERE f.id = $1")) return { rows: missing ? [] : [detail] };
      if (sql.includes("FROM fandraisan_anjara_ligne")) return { rows: lines };
      throw new Error(`Requête inattendue : ${sql}`);
    },
  };
}

const runList = (db, query = {}, role = "MEMBRE") => runWithDatabaseClient(db, () => getFandraisanAnjaraList(query, auth(role)));
const runDetail = (db, id = contributionId, role = "MEMBRE") => runWithDatabaseClient(db, () => getFandraisanAnjaraById(id, auth(role)));

test("liste vide et pagination ne divulguent aucune donnée interne", async () => {
  const db = mockDb({ rows: [], total: 0 });
  const result = await runList(db);
  assert.deepEqual(result, { contributions: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } });
  assert.deepEqual(db.calls[0].params, []);
  assert.deepEqual(db.calls[1].params, [20, 0]);
});

test("liste paginée applique les filtres sans double comptage", async () => {
  const db = mockDb({ rows: [header(), header({ id: "55555555-5555-4555-8555-555555555555" })], total: 3 });
  const result = await runList(db, {
    date_debut: "2026-10-01",
    date_fin: "2026-10-31",
    id_razambe: razambeId,
    statut: "ACTIF",
    page: "2",
    limit: "2",
  });
  assert.deepEqual(result.pagination, { page: 2, limit: 2, total: 3, total_pages: 2 });
  assert.equal(result.contributions[0].total_argent_mga, "57000");
  assert.deepEqual(result.contributions[0].materiels, [{ designation: "Cahier", unite: "unité", quantite: "12" }]);
  assert.deepEqual(db.calls[0].params, ["2026-10-01", "2026-10-31", razambeId, "ACTIF"]);
  assert.deepEqual(db.calls[1].params, ["2026-10-01", "2026-10-31", razambeId, "ACTIF", 2, 2]);
  assert.ok(!db.calls[1].sql.includes("fandraisan_anjara_historique"));
});

test("filtre NON_DETERMINE est explicite et distinct de l'absence de filtre", async () => {
  const db = mockDb({ rows: [header({ id_razambe_snapshot: null, resolution_razambe: "NON_DETERMINE" })] });
  const result = await runList(db, { non_determine: "true" });
  assert.equal(result.contributions[0].rattachements_historiques.resolution_razambe, "NON_DETERMINE");
  assert.match(db.calls[0].sql, /f\.resolution_razambe = 'NON_DETERMINE'/);
  assert.deepEqual(db.calls[0].params, []);
  await assert.rejects(runList(mockDb(), { non_determine: "true", id_razambe: razambeId }), { code: "FANDRAISAN_ANJARA_INVALID" });
});

test("statut annulé est consultable et détail conserve les lignes ordonnées", async () => {
  const db = mockDb({
    detail: header({ statut: "ANNULE", total_argent_mga: undefined, materiels: undefined }),
    lines: [
      { nature: "ARGENT", montant: "50000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 1 },
      { nature: "MATERIEL", montant: null, devise: null, designation: "Cahier", quantite: "12", unite: "unité", observation: "Neuf", ordre: 2 },
      { nature: "ARGENT", montant: "7000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 3 },
    ],
  });
  const detail = await runDetail(db);
  assert.equal(detail.statut, "ANNULE");
  assert.equal(detail.total_argent_mga, "57000");
  assert.deepEqual(detail.lignes.map((ligne) => ligne.ordre), [1, 2, 3]);
  assert.equal(Object.hasOwn(detail, "historique"), false);
  assert.equal(Object.hasOwn(detail, "id_compte_createur"), false);
  assert.ok(!db.calls.some((call) => call.sql.includes("fandraisan_anjara_historique")));
});

test("validation des UUID, période et pagination", async () => {
  await assert.rejects(runDetail(mockDb(), "invalide"), { code: "FANDRAISAN_ANJARA_INVALID" });
  for (const query of [
    { date_debut: "2026-11-01", date_fin: "2026-10-01" },
    { id_razambe: "invalide" },
    { statut: "INCONNU" },
    { page: "0" },
    { limit: "101" },
  ]) {
    await assert.rejects(runList(mockDb(), query), { code: "FANDRAISAN_ANJARA_INVALID" });
  }
});

test("inexistence et authentification sont traitées sans élargir les droits", async () => {
  await assert.rejects(runDetail(mockDb({ missing: true })), { code: "FANDRAISAN_ANJARA_NOT_FOUND" });
  await assert.rejects(
    runWithDatabaseClient(mockDb(), () => getFandraisanAnjaraList({}, null)),
    { code: "AUTH_REQUIRED" },
  );
  await assert.doesNotReject(runList(mockDb(), {}, "MEMBRE"));
});

test("routes GET : authentification requise, MEMBRE autorisé et contrôleurs sûrs", async () => {
  const listRoute = router.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.get).route;
  const detailRoute = router.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.get).route;
  assert.equal(listRoute.stack.at(-1).handle, listFandraisanAnjara);
  assert.equal(detailRoute.stack.at(-1).handle, getFandraisanAnjara);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const unauthenticated = response();
  await listRoute.stack[0].handle({ headers: {} }, unauthenticated, () => assert.fail("authentification contournée"));
  assert.equal(unauthenticated.statusCode, 401);
  const db = mockDb(); const res = response();
  await runWithDatabaseClient(db, () => listFandraisanAnjara({ query: {}, auth: auth("MEMBRE") }, res));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  const invalid = response();
  await getFandraisanAnjara({ params: { id: "invalide" }, auth: auth() }, invalid);
  assert.equal(invalid.statusCode, 400);
});
