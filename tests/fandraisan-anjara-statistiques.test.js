import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import {
  getFandraisanAnjaraDetailRazambe,
  getFandraisanAnjaraParRazambe,
  getFandraisanAnjaraStatistiques,
} from "../src/services/fandraisanAnjara.service.js";
import {
  getFandraisanAnjaraParRazambe as getFandraisanAnjaraParRazambeController,
  getFandraisanAnjaraStatistiques as getFandraisanAnjaraStatistiquesController,
} from "../src/controllers/fandraisanAnjara.controller.js";
import router from "../src/routes/fandraisanAnjara.routes.js";

const razambeId = "11111111-1111-4111-8111-111111111111";
const contributionA = "22222222-2222-4222-8222-222222222222";
const contributionB = "33333333-3333-4333-8333-333333333333";
const personId = "44444444-4444-4444-8444-444444444444";
const foyerId = "55555555-5555-4555-8555-555555555555";
const accountId = "66666666-6666-4666-8666-666666666666";
const auth = (role = "MEMBRE") => ({ compte: { id: accountId, role } });

function contribution(id, overrides = {}) {
  return {
    id,
    date_contribution: "2026-10-20",
    type_contributeur: "PERSONNE",
    id_element_contributeur: null,
    id_foyer_contributeur: null,
    id_personne_contributeur: personId,
    contributeur_libelle_snapshot: "Rabe Jean",
    id_razambe_snapshot: razambeId,
    id_taranaka_snapshot: "77777777-7777-4777-8777-777777777777",
    id_sampana_snapshot: null,
    resolution_razambe: "RESOLU",
    observation: null,
    statut: "ACTIF",
    revision: 1,
    ...overrides,
  };
}

function mockDb({ dashboard = null, materials = [], groups = [], contributions = [], lines = [] } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT\n      COUNT(*)::integer AS nombre_contributions_actives")) return { rows: [dashboard ?? {
        nombre_contributions_actives: 0,
        nombre_contributeurs_distincts: 0,
        nombre_razambe_representes: 0,
        nombre_contributions_non_determinees: 0,
        total_argent_mga: "0",
      }] };
      if (sql.startsWith("SELECT l.designation, l.unite, SUM(l.quantite)::text AS quantite")) return { rows: materials };
      if (sql.startsWith("WITH filtered AS")) return { rows: groups };
      if (sql.includes("FROM fandraisan_anjara f") && sql.includes("ORDER BY f.date_contribution DESC")) return { rows: contributions };
      if (sql.includes("WHERE id_fandraisan_anjara = ANY")) return { rows: lines };
      throw new Error(`Requête inattendue : ${sql}`);
    },
  };
}

const runStats = (db, query = {}, currentAuth = auth()) => runWithDatabaseClient(db, () => getFandraisanAnjaraStatistiques(query, currentAuth));
const runGroups = (db, query = {}, currentAuth = auth()) => runWithDatabaseClient(db, () => getFandraisanAnjaraParRazambe(query, currentAuth));
const runDetail = (db, id = razambeId, query = {}, currentAuth = auth(), options = {}) => runWithDatabaseClient(db, () => getFandraisanAnjaraDetailRazambe(id, query, currentAuth, options));

test("tableau de bord vide", async () => {
  const result = await runStats(mockDb());
  assert.deepEqual(result, {
    total_argent_mga: "0",
    nombre_contributions_actives: 0,
    nombre_contributeurs_distincts: 0,
    nombre_razambe_representes: 0,
    nombre_contributions_non_determinees: 0,
    materiels: [],
  });
});

test("tableau de bord conserve les totaux exacts et les contributeurs canoniques", async () => {
  const db = mockDb({
    dashboard: {
      nombre_contributions_actives: 4,
      nombre_contributeurs_distincts: 2,
      nombre_razambe_representes: 1,
      nombre_contributions_non_determinees: 1,
      total_argent_mga: "107000",
    },
    materials: [{ designation: "Cahier", unite: "unité", quantite: "24" }],
  });
  const result = await runStats(db, { date_debut: "2026-10-01", date_fin: "2026-10-31" });
  assert.equal(result.total_argent_mga, "107000");
  assert.equal(result.nombre_contributeurs_distincts, 2); // PERSONNE et FOYER restent distincts.
  assert.deepEqual(result.materiels, [{ designation: "Cahier", unite: "unité", quantite: "24" }]);
  assert.deepEqual(db.calls[0].params, ["2026-10-01", "2026-10-31"]);
  assert.ok(!db.calls[0].sql.includes("fandraisan_anjara_historique"));
  assert.ok(!db.calls[0].sql.includes("don_"));
});

test("répartition par Razambe sépare le groupe NON_DETERMINE", async () => {
  const db = mockDb({ groups: [
    {
      id_razambe_snapshot: razambeId,
      resolution_razambe: "RESOLU",
      nom_razambe_actuel: "Razambe A",
      nombre_contributions: 3,
      nombre_contributeurs_distincts: 2,
      total_argent_mga: "57000",
      materiels: [{ designation: "Cahier", unite: "unité", quantite: "12" }],
    },
    {
      id_razambe_snapshot: null,
      resolution_razambe: "NON_DETERMINE",
      nom_razambe_actuel: null,
      nombre_contributions: 1,
      nombre_contributeurs_distincts: 1,
      total_argent_mga: "5000",
      materiels: [],
    },
  ] });
  const result = await runGroups(db);
  assert.equal(result.razambe.length, 1);
  assert.equal(result.razambe[0].nom_razambe_actuel, "Razambe A");
  assert.equal(result.non_determine.total_argent_mga, "5000");
  assert.match(db.calls[0].sql, /LEFT JOIN element e/);
  assert.ok(!db.calls[0].sql.includes("fandraisan_anjara_historique"));
});

test("détail Razambe repose sur les instantanés, regroupe par date et évite le double comptage", async () => {
  const first = contribution(contributionA, {
    type_contributeur: "RAZAMBE",
    id_element_contributeur: razambeId,
    id_personne_contributeur: null,
    contributeur_libelle_snapshot: "Razambe A",
  });
  const second = contribution(contributionB, {
    type_contributeur: "FOYER",
    id_personne_contributeur: null,
    id_foyer_contributeur: foyerId,
    contributeur_libelle_snapshot: "Rabe Jean / Rasoa Marie",
  });
  const db = mockDb({
    contributions: [first, second],
    lines: [
      { id_fandraisan_anjara: contributionA, nature: "ARGENT", montant: "50000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 1 },
      { id_fandraisan_anjara: contributionA, nature: "MATERIEL", montant: null, devise: null, designation: "Cahier", quantite: "12", unite: "unité", observation: null, ordre: 2 },
      { id_fandraisan_anjara: contributionB, nature: "ARGENT", montant: "7000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 1 },
      { id_fandraisan_anjara: contributionB, nature: "MATERIEL", montant: null, devise: null, designation: "Cahier", quantite: "12", unite: "unité", observation: null, ordre: 2 },
    ],
  });
  const result = await runDetail(db);
  assert.equal(result.groupe, "RAZAMBE");
  assert.equal(result.total_argent_mga, "57000");
  assert.equal(result.contributions_par_date.length, 1);
  assert.equal(result.contributions_par_date[0].contributions.length, 2);
  assert.deepEqual(result.materiels, [{ designation: "Cahier", unite: "unité", quantite: "24" }]);
  assert.equal(result.contributions_par_date[0].contributions[0].contributeur.type, "RAZAMBE");
  assert.equal(result.contributions_par_date[0].contributions[1].contributeur.type, "FOYER");
  assert.ok(!JSON.stringify(result).includes("id_compte_createur"));
  assert.ok(!db.calls[0].sql.includes("FROM element"));
});

test("détail NON_DETERMINE est explicite", async () => {
  const db = mockDb({ contributions: [contribution(contributionA, { id_razambe_snapshot: null, resolution_razambe: "NON_DETERMINE" })], lines: [] });
  const result = await runDetail(db, null, {}, auth(), { nonDetermine: true });
  assert.equal(result.groupe, "NON_DETERMINE");
  assert.equal(result.id_razambe, null);
  assert.match(db.calls[0].sql, /f\.resolution_razambe = 'NON_DETERMINE'/);
});

test("validation de dates, UUID et authentification", async () => {
  for (const query of [{ date_debut: "2026-11-01", date_fin: "2026-10-01" }, { page: "1" }]) {
    await assert.rejects(runStats(mockDb(), query), { code: "FANDRAISAN_ANJARA_INVALID" });
  }
  await assert.rejects(runDetail(mockDb(), "invalide"), { code: "FANDRAISAN_ANJARA_INVALID" });
  await assert.rejects(runStats(mockDb(), {}, null), { code: "AUTH_REQUIRED" });
  await assert.doesNotReject(runGroups(mockDb(), {}, auth("MEMBRE")));
});

test("routes spécifiques précèdent la route générique et restent consultables par MEMBRE", async () => {
  const routeNames = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.deepEqual(routeNames, ["/", "/", "/statistiques", "/razambe", "/razambe/non-determine", "/razambe/:id", "/:id/historique", "/:id", "/:id/annuler", "/:id"]);
  const statsRoute = router.stack.find((layer) => layer.route?.path === "/statistiques").route;
  const razambeRoute = router.stack.find((layer) => layer.route?.path === "/razambe").route;
  assert.equal(statsRoute.stack.at(-1).handle, getFandraisanAnjaraStatistiquesController);
  assert.equal(razambeRoute.stack.at(-1).handle, getFandraisanAnjaraParRazambeController);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const unauthenticated = response();
  await statsRoute.stack[0].handle({ headers: {} }, unauthenticated, () => assert.fail("authentification contournée"));
  assert.equal(unauthenticated.statusCode, 401);
});
