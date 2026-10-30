import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import {
  creerFandraisanAnjara,
  createFandraisanAnjaraFingerprint,
} from "../src/services/fandraisanAnjara.service.js";
import { createFandraisanAnjara } from "../src/controllers/fandraisanAnjara.controller.js";
import router from "../src/routes/fandraisanAnjara.routes.js";

const contributionId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const personId = "33333333-3333-4333-8333-333333333333";
const razambeId = "44444444-4444-4444-8444-444444444444";
const revision = 1;
const idempotencyKey = "55555555-5555-4555-8555-555555555555";
const auth = (role = "ADMIN") => ({ compte: { id: accountId, role } });
const validMoney = () => ({
  date_contribution: "2026-10-20",
  type_contributeur: "PERSONNE",
  id_contributeur: personId,
  observation: "Collecte du dimanche",
  lignes: [{ nature: "ARGENT", montant: "50000", devise: "MGA" }],
});

function mockDb({ unresolved = false, failAt = null } = {}) {
  const state = { contribution: null, lines: [], history: [], idempotence: new Map() };
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
      if (failAt && sql.includes(failAt)) throw new Error("insertion simulée échouée");
      if (sql.includes("INSERT INTO fandraisan_anjara_idempotence")) {
        const [account, key, fingerprint, contribution] = params;
        const compoundKey = `${account}:${key}`;
        if (state.idempotence.has(compoundKey)) return { rows: [] };
        state.idempotence.set(compoundKey, {
          empreinte_contenu: fingerprint,
          id_fandraisan_anjara: contribution,
        });
        return { rows: [{ id_fandraisan_anjara: contribution }] };
      }
      if (sql.includes("FROM fandraisan_anjara_idempotence")) {
        return { rows: [state.idempotence.get(`${params[0]}:${params[1]}`)].filter(Boolean) };
      }
      if (sql.includes("SELECT id, statut, revision") && sql.includes("FROM fandraisan_anjara")) {
        return { rows: state.contribution ? [state.contribution] : [] };
      }
      if (sql.includes("FROM personne p")) {
        return {
          rows: [{
            id: personId,
            nom: "Rabe",
            prenom: "Jean",
            id_element: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            id_razambe: unresolved ? null : razambeId,
            id_taranaka: null,
            id_sampana: null,
          }],
        };
      }
      if (sql.includes("INSERT INTO fandraisan_anjara (")) {
        state.contribution = { id: params[0], statut: "ACTIF", revision };
        return { rows: [state.contribution] };
      }
      if (sql.includes("INSERT INTO fandraisan_anjara_ligne")) {
        state.lines.push(params);
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO fandraisan_anjara_historique")) {
        state.history.push(params);
        return { rows: [] };
      }
      throw new Error(`Requête inattendue : ${sql}`);
    },
  };
}

const run = (db, body, role = "ADMIN", key = idempotencyKey, account = accountId) => runWithDatabaseClient(
  db,
  () => creerFandraisanAnjara(body, { compte: { id: account, role } }, key),
);

test("crée une contribution ARGENT MGA entière et son historique dans une transaction", async () => {
  const db = mockDb();
  const result = await run(db, validMoney());
  assert.equal(result.contribution.statut, "ACTIF");
  assert.equal(result.contribution.revision, revision);
  assert.equal(result.idempotent_replay, false);
  assert.equal(db.state.lines.length, 1);
  assert.deepEqual(db.state.lines[0].slice(1, 5), ["ARGENT", "50000", "MGA", null]);
  assert.equal(db.state.history.length, 1);
  assert.match(db.calls.find((call) => call.sql.includes("INSERT INTO fandraisan_anjara_historique")).sql, /'CREATION'/);
  assert.equal(db.state.history[0][2], accountId);
  assert.equal(db.calls.at(-1).sql, "COMMIT");
});

test("crée les lignes MATERIEL et mixtes dans leur ordre serveur", async () => {
  const db = mockDb();
  const body = validMoney();
  body.lignes = [
    { nature: "MATERIEL", designation: " Cahier ", quantite: "12.500", unite: " unité " },
    { nature: "ARGENT", montant: 7000, devise: "MGA" },
  ];
  await run(db, body);
  assert.equal(db.state.lines.length, 2);
  assert.deepEqual(db.state.lines[0].slice(1), ["MATERIEL", null, null, "Cahier", "12.5", "unité", null, 1]);
  assert.deepEqual(db.state.lines[1].slice(1), ["ARGENT", "7000", "MGA", null, null, null, null, 2]);
});

test("accepte NON_DETERMINE sans inventer un Razambe", async () => {
  const db = mockDb({ unresolved: true });
  await run(db, validMoney());
  const insert = db.calls.find((call) => call.sql.includes("INSERT INTO fandraisan_anjara ("));
  assert.equal(insert.params[7], null);
  assert.equal(insert.params[10], "NON_DETERMINE");
});

test("rejette les lignes, dates et champs non valides avant la transaction", async () => {
  const invalidBodies = [
    { ...validMoney(), lignes: [] },
    { ...validMoney(), date_contribution: "2999-01-01" },
    { ...validMoney(), lignes: [{ nature: "ARGENT", montant: "1.5", devise: "MGA" }] },
    { ...validMoney(), lignes: [{ nature: "ARGENT", montant: 0, devise: "MGA" }] },
    { ...validMoney(), lignes: [{ nature: "ARGENT", montant: -1, devise: "MGA" }] },
    { ...validMoney(), lignes: [{ nature: "ARGENT", montant: "50000", devise: "EUR" }] },
    { ...validMoney(), lignes: [{ nature: "MATERIEL", designation: " ", quantite: "1", unite: "unité" }] },
    { ...validMoney(), lignes: [{ nature: "MATERIEL", designation: "Cahier", quantite: "0", unite: "unité" }] },
    { ...validMoney(), statut: "ANNULE" },
    { ...validMoney(), lignes: [{ nature: "ARGENT", montant: 50000, devise: "MGA", ordre: 2 }] },
  ];
  for (const body of invalidBodies) {
    const db = mockDb();
    await assert.rejects(run(db, body), { code: "FANDRAISAN_ANJARA_INVALID" });
    assert.equal(db.calls.length, 0);
  }
});

test("un échec d'insertion provoque un rollback sans contribution partielle", async () => {
  const db = mockDb({ failAt: "INSERT INTO fandraisan_anjara_ligne" });
  await assert.rejects(run(db, validMoney()), { message: "insertion simulée échouée" });
  assert.equal(db.state.contribution, null);
  assert.deepEqual(db.state.lines, []);
  assert.deepEqual(db.state.history, []);
  assert.equal(db.state.idempotence.size, 0);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
});

test("seuls les trois rôles gestionnaires peuvent créer", async () => {
  for (const role of ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA"]) {
    await assert.doesNotReject(run(mockDb(), validMoney(), role));
  }
  await assert.rejects(run(mockDb(), validMoney(), "MEMBRE"), { code: "FANDRAISAN_ANJARA_FORBIDDEN" });
  await assert.rejects(runWithDatabaseClient(mockDb(), () => creerFandraisanAnjara(validMoney(), null)), { code: "AUTH_REQUIRED" });
});

test("route et contrôleur appliquent les protections et renvoient 201", async () => {
  const route = router.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post).route;
  const [requireAuth, requireRole, controller] = route.stack.map((layer) => layer.handle);
  assert.equal(controller, createFandraisanAnjara);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const unauthenticated = response();
  await requireAuth({ headers: {} }, unauthenticated, () => assert.fail("authentification contournée"));
  assert.equal(unauthenticated.statusCode, 401);
  const member = response();
  requireRole({ auth: auth("MEMBRE") }, member, () => assert.fail("rôle contourné"));
  assert.equal(member.statusCode, 403);
  const db = mockDb();
  const res = response();
  await runWithDatabaseClient(db, () => createFandraisanAnjara({
    body: validMoney(), auth: auth(), headers: { "idempotency-key": idempotencyKey },
  }, res));
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.idempotent_replay, false);
  assert.equal(res.body.data.contribution.statut, "ACTIF");
});

test("contrôleur : les erreurs de validation restent des réponses 400", async () => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await runWithDatabaseClient(mockDb(), () => createFandraisanAnjara({
    body: { ...validMoney(), lignes: [] },
    auth: auth(),
  }, res));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    code: "FANDRAISAN_ANJARA_INVALID",
    message: "Au moins une ligne de contribution est obligatoire.",
  });
});

test("répète une demande identique sans nouvelle ligne ni historique", async () => {
  const db = mockDb();
  const first = await run(db, validMoney());
  const replay = await run(db, validMoney());
  assert.equal(first.idempotent_replay, false);
  assert.deepEqual(replay, {
    contribution: first.contribution,
    idempotent_replay: true,
  });
  assert.equal(db.state.lines.length, 1);
  assert.equal(db.state.history.length, 1);
});

test("refuse une même clé avec un contenu différent", async () => {
  const db = mockDb();
  await run(db, validMoney());
  await assert.rejects(
    run(db, { ...validMoney(), observation: "Contenu différent" }),
    { code: "FANDRAISAN_ANJARA_IDEMPOTENCY_CONFLICT" },
  );
  assert.equal(db.state.lines.length, 1);
  assert.equal(db.state.history.length, 1);
});

test("isole les clés entre comptes et conserve l'état courant après correction ou annulation", async () => {
  const db = mockDb();
  const first = await run(db, validMoney());
  const otherAccount = "66666666-6666-4666-8666-666666666666";
  const other = await run(db, validMoney(), "ADMIN", idempotencyKey, otherAccount);
  assert.equal(other.idempotent_replay, false);
  assert.equal(db.state.idempotence.size, 2);
  db.state.contribution = { ...first.contribution, statut: "ACTIF", revision: 2 };
  assert.deepEqual(await run(db, validMoney()), {
    contribution: db.state.contribution, idempotent_replay: true,
  });
  db.state.contribution = { ...first.contribution, statut: "ANNULE", revision: 3 };
  assert.deepEqual(await run(db, validMoney()), {
    contribution: db.state.contribution, idempotent_replay: true,
  });
});

test("valide les UUID d'idempotence et produit une empreinte canonique", async () => {
  await assert.rejects(run(mockDb(), validMoney(), "ADMIN", "pas-un-uuid"), {
    code: "FANDRAISAN_ANJARA_IDEMPOTENCY_KEY_INVALID",
  });
  const first = createFandraisanAnjaraFingerprint({
    ...validMoney(), id_contributeur: personId,
    observation: "Collecte du dimanche",
    lignes: [{ nature: "ARGENT", montant: "50000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 1 }],
  });
  const second = createFandraisanAnjaraFingerprint({
    ...validMoney(), id_contributeur: personId,
    observation: "Collecte du dimanche",
    lignes: [{ nature: "ARGENT", montant: "50000", devise: "MGA", designation: null, quantite: null, unite: null, observation: null, ordre: 1 }],
  });
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
});

test("contrôleur : une clé absente ou un conflit d'idempotence ont les statuts HTTP prévus", async () => {
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const missing = response();
  await runWithDatabaseClient(mockDb(), () => createFandraisanAnjara({ body: validMoney(), auth: auth(), headers: {} }, missing));
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body.code, "FANDRAISAN_ANJARA_IDEMPOTENCY_KEY_INVALID");

  const db = mockDb();
  await run(db, validMoney());
  const conflict = response();
  await runWithDatabaseClient(db, () => createFandraisanAnjara({
    body: { ...validMoney(), observation: "Différent" }, auth: auth(), headers: { "idempotency-key": idempotencyKey },
  }, conflict));
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.code, "FANDRAISAN_ANJARA_IDEMPOTENCY_CONFLICT");
});
