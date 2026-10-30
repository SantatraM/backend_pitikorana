import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import {
  annulerFandraisanAnjara,
  corrigerFandraisanAnjara,
  getFandraisanAnjaraHistorique,
} from "../src/services/fandraisanAnjara.service.js";
import {
  cancelFandraisanAnjara,
  getFandraisanAnjaraHistorique as getFandraisanAnjaraHistoriqueController,
  updateFandraisanAnjara,
} from "../src/controllers/fandraisanAnjara.controller.js";
import router from "../src/routes/fandraisanAnjara.routes.js";

const contributionId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const personId = "33333333-3333-4333-8333-333333333333";
const otherPersonId = "44444444-4444-4444-8444-444444444444";
const razambeId = "55555555-5555-4555-8555-555555555555";
const otherRazambeId = "66666666-6666-4666-8666-666666666666";
const auth = (role = "ADMIN") => ({ compte: { id: accountId, role } });

function initialHeader(overrides = {}) {
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
    observation: "Initiale",
    statut: "ACTIF",
    revision: 1,
    id_compte_modificateur: null,
    id_compte_annulateur: null,
    date_annulation: null,
    motif_annulation: null,
    ...overrides,
  };
}

function initialLines() {
  return [{ nature: "ARGENT", montant: "50000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 1 }];
}

function mockDb({ header = initialHeader(), lines = initialLines(), failAt = null, historyRows = null } = {}) {
  const state = { header: structuredClone(header), lines: structuredClone(lines), history: [] };
  const calls = [];
  let snapshot;
  return {
    state,
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql === "BEGIN") { snapshot = structuredClone(state); return { rows: [] }; }
      if (sql === "COMMIT") return { rows: [] };
      if (sql === "ROLLBACK") { Object.assign(state, snapshot); return { rows: [] }; }
      if (failAt && sql.includes(failAt)) throw new Error("échec simulé");
      if (sql.includes("FROM fandraisan_anjara f") && sql.includes("FOR UPDATE")) return { rows: [state.header] };
      if (sql.includes("FROM fandraisan_anjara_ligne") && sql.includes("ORDER BY ordre ASC")) return { rows: state.lines };
      if (sql.includes("FROM personne p")) {
        return { rows: [{
          id: otherPersonId,
          nom: "Rasoa",
          prenom: "Marie",
          id_element: "77777777-7777-4777-8777-777777777777",
          id_razambe: otherRazambeId,
          id_taranaka: null,
          id_sampana: null,
        }] };
      }
      if (sql.startsWith("UPDATE fandraisan_anjara SET\n        date_contribution")) {
        Object.assign(state.header, {
          date_contribution: params[0], type_contributeur: params[1],
          id_element_contributeur: params[2], id_foyer_contributeur: params[3], id_personne_contributeur: params[4],
          contributeur_libelle_snapshot: params[5], id_razambe_snapshot: params[6], id_taranaka_snapshot: params[7], id_sampana_snapshot: params[8],
          resolution_razambe: params[9], observation: params[10], id_compte_modificateur: params[11], revision: state.header.revision + 1,
        });
        return { rows: [{ id: state.header.id, statut: state.header.statut, revision: state.header.revision }] };
      }
      if (sql.startsWith("UPDATE fandraisan_anjara SET\n        statut = 'ANNULE'")) {
        Object.assign(state.header, {
          statut: "ANNULE", id_compte_annulateur: params[0], motif_annulation: params[1],
          date_annulation: "2026-10-20T12:00:00.000Z", revision: state.header.revision + 1,
        });
        return { rows: [{ id: state.header.id, statut: state.header.statut, revision: state.header.revision, date_annulation: state.header.date_annulation }] };
      }
      if (sql.startsWith("DELETE FROM fandraisan_anjara_ligne")) { state.lines = []; return { rows: [] }; }
      if (sql.includes("INSERT INTO fandraisan_anjara_ligne")) {
        state.lines.push({ nature: params[1], montant: params[2], devise: params[3], designation: params[4], quantite: params[5], unite: params[6], observation: params[7], ordre: params[8] });
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO fandraisan_anjara_historique")) { state.history.push(params); return { rows: [] }; }
      if (sql === "SELECT id FROM fandraisan_anjara WHERE id = $1") return { rows: [{ id: contributionId }] };
      if (sql.includes("FROM fandraisan_anjara_historique")) return { rows: historyRows ?? state.history.map((params) => ({
        action: params[1], donnees_avant: JSON.parse(params[2]), donnees_apres: JSON.parse(params[3]), commentaire: params[4], id_compte_acteur: params[5], revision: params[6], date_action: "2026-10-20T12:00:00.000Z",
      })) };
      throw new Error(`Requête inattendue : ${sql}`);
    },
  };
}

const runCorrection = (db, body, role = "ADMIN") => runWithDatabaseClient(db, () => corrigerFandraisanAnjara(contributionId, body, auth(role)));
const runCancel = (db, body, role = "ADMIN") => runWithDatabaseClient(db, () => annulerFandraisanAnjara(contributionId, body, auth(role)));

test("corrige un montant et conserve les instantanés si le contributeur ne change pas", async () => {
  const db = mockDb();
  const result = await runCorrection(db, {
    revision: 1,
    motif_correction: "Montant corrigé",
    lignes: [{ nature: "ARGENT", montant: "75000", devise: "MGA" }],
  });
  assert.deepEqual(result, { contribution: { id: contributionId, statut: "ACTIF", revision: 2 } });
  assert.equal(db.state.header.id_razambe_snapshot, razambeId);
  assert.equal(db.state.lines[0].montant, "75000");
  assert.equal(db.state.history.length, 1);
  assert.equal(db.state.history[0][1], "CORRECTION");
  const before = JSON.parse(db.state.history[0][2]); const after = JSON.parse(db.state.history[0][3]);
  assert.equal(before.lignes[0].montant, "50000");
  assert.equal(after.lignes[0].montant, "75000");
  assert.equal(after.id_razambe_snapshot, razambeId);
  assert.equal(db.calls.at(-1).sql, "COMMIT");
});

test("corrige la date et plusieurs lignes sans accepter de décimales", async () => {
  const db = mockDb();
  await runCorrection(db, {
    revision: 1, motif_correction: "Complément",
    date_contribution: "2026-10-19",
    lignes: [
      { nature: "ARGENT", montant: 7000, devise: "MGA" },
      { nature: "MATERIEL", designation: "Cahier", quantite: "12.5", unite: "unité" },
    ],
  });
  assert.equal(db.state.header.date_contribution, "2026-10-19");
  assert.equal(db.state.lines.length, 2);
  await assert.rejects(runCorrection(mockDb(), {
    revision: 1, motif_correction: "Erreur", lignes: [{ nature: "ARGENT", montant: "1.5", devise: "MGA" }],
  }), { code: "FANDRAISAN_ANJARA_INVALID" });
});

test("le changement explicite de contributeur déclenche une nouvelle résolution", async () => {
  const db = mockDb();
  await runCorrection(db, {
    revision: 1, motif_correction: "Contributeur corrigé",
    type_contributeur: "PERSONNE", id_contributeur: otherPersonId,
  });
  assert.equal(db.state.header.id_personne_contributeur, otherPersonId);
  assert.equal(db.state.header.contributeur_libelle_snapshot, "Rasoa Marie");
  assert.equal(db.state.header.id_razambe_snapshot, otherRazambeId);
  assert.ok(db.calls.some((call) => call.sql.includes("FROM personne p")));
});

test("motif, révision, statut et champs réservés sont contrôlés", async () => {
  for (const body of [
    { revision: 1, lignes: initialLines() },
    { revision: 1, motif_correction: "Interdit", statut: "ANNULE" },
    { revision: 1, motif_correction: "Partiel", type_contributeur: "PERSONNE" },
  ]) {
    await assert.rejects(runCorrection(mockDb(), body), { code: "FANDRAISAN_ANJARA_INVALID" });
  }
  await assert.rejects(runCorrection(mockDb(), { revision: 0, motif_correction: "x", observation: "x" }), { code: "FANDRAISAN_ANJARA_INVALID" });
  await assert.rejects(runCorrection(mockDb(), { revision: 1, motif_correction: "Date future", date_contribution: "2999-01-01" }), { code: "FANDRAISAN_ANJARA_INVALID" });
  await assert.rejects(runCorrection(mockDb({ header: initialHeader({ revision: 2 }) }), { revision: 1, motif_correction: "Conflit", observation: "x" }), { code: "FANDRAISAN_ANJARA_REVISION_CONFLICT" });
  await assert.rejects(runCorrection(mockDb({ header: initialHeader({ statut: "ANNULE", revision: 2 }) }), { revision: 2, motif_correction: "Fermée", observation: "x" }), { code: "FANDRAISAN_ANJARA_STATE_INVALID" });
});

test("annulation valide, double annulation et rollback", async () => {
  const db = mockDb();
  const result = await runCancel(db, { revision: 1, motif_annulation: "Erreur de saisie" });
  assert.deepEqual(result, { contribution: { id: contributionId, statut: "ANNULE", revision: 2 } });
  assert.equal(db.state.header.motif_annulation, "Erreur de saisie");
  assert.equal(db.state.lines.length, 1);
  assert.equal(db.state.history[0][1], "ANNULATION");
  await assert.rejects(runCancel(db, { revision: 2, motif_annulation: "Encore" }), { code: "FANDRAISAN_ANJARA_STATE_INVALID" });
  await assert.rejects(runCancel(mockDb(), { revision: 1, motif_annulation: " " }), { code: "FANDRAISAN_ANJARA_INVALID" });
  const failing = mockDb({ failAt: "INSERT INTO fandraisan_anjara_historique" });
  await assert.rejects(runCancel(failing, { revision: 1, motif_annulation: "Erreur" }), { message: "échec simulé" });
  assert.equal(failing.state.header.statut, "ACTIF");
  assert.equal(failing.calls.at(-1).sql, "ROLLBACK");
});

test("historique complet réservé aux gestionnaires et auteurs résolus de façon additive", async () => {
  const secondAccountId = "99999999-9999-4999-8999-999999999999";
  const db = mockDb({ historyRows: [{
    action: "CORRECTION", revision: 2, date_action: "2026-10-20T12:00:00.000Z", id_compte_acteur: accountId,
    acteur_nom: "Rabe", acteur_prenom: "Jean", acteur_nom_usage: "Rakoto",
    commentaire: "Montant corrigé", donnees_avant: { lignes: initialLines() }, donnees_apres: { lignes: [{ ...initialLines()[0], montant: "75000" }] },
  }, {
    action: "ANNULATION", revision: 3, date_action: "2026-10-21T12:00:00.000Z", id_compte_acteur: secondAccountId,
    acteur_nom: null, acteur_prenom: null, acteur_nom_usage: null,
    commentaire: "Annulation", donnees_avant: null, donnees_apres: null,
  }] });
  const result = await runWithDatabaseClient(db, () => getFandraisanAnjaraHistorique(contributionId, auth()));
  assert.equal(result.historique[0].acteur.id_compte, accountId);
  assert.deepEqual(result.historique[0].acteur, { id_compte: accountId, nom: "Rabe", prenom: "Jean", nom_usage: "Rakoto" });
  assert.deepEqual(result.historique[1].acteur, { id_compte: secondAccountId, nom: null, prenom: null, nom_usage: null });
  assert.deepEqual(result.historique.map((event) => event.revision), [2, 3]);
  assert.equal(result.historique[0].donnees_apres.lignes[0].montant, "75000");
  await assert.rejects(runWithDatabaseClient(mockDb(), () => getFandraisanAnjaraHistorique(contributionId, auth("MEMBRE"))), { code: "FANDRAISAN_ANJARA_FORBIDDEN" });
});

test("trois rôles gestionnaires autorisés et routes protégées", async () => {
  for (const role of ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA"]) {
    await assert.doesNotReject(runCorrection(mockDb(), { revision: 1, motif_correction: "Observation", observation: "Nouvelle" }, role));
  }
  await assert.rejects(runCorrection(mockDb(), { revision: 1, motif_correction: "Interdit", observation: "x" }, "MEMBRE"), { code: "FANDRAISAN_ANJARA_FORBIDDEN" });
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.ok(routes.indexOf("get /:id/historique") < routes.indexOf("get /:id"));
  const historyRoute = router.stack.find((layer) => layer.route?.path === "/:id/historique").route;
  assert.equal(historyRoute.stack.at(-1).handle, getFandraisanAnjaraHistoriqueController);
  const updateRoute = router.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.put).route;
  const cancelRoute = router.stack.find((layer) => layer.route?.path === "/:id/annuler").route;
  assert.equal(updateRoute.stack.at(-1).handle, updateFandraisanAnjara);
  assert.equal(cancelRoute.stack.at(-1).handle, cancelFandraisanAnjara);
});

test("contrôleur : le conflit de révision reste une réponse 409", async () => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await runWithDatabaseClient(mockDb({ header: initialHeader({ revision: 2 }) }), () => updateFandraisanAnjara({
    params: { id: contributionId },
    body: { revision: 1, motif_correction: "Ancienne version", observation: "x" },
    auth: auth(),
  }, res));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "FANDRAISAN_ANJARA_REVISION_CONFLICT");
});
