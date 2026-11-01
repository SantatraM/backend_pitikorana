import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInformation } from "../src/services/demandeInformation.service.js";
import { prepareInformationForm } from "../src/services/demandeInformationProtection.service.js";
import { databaseBindingForRequest, isInformationRequest } from "../src/config/demandeInformationDatabase.js";

process.env.DEMANDE_INFORMATION_SECRET = "test-only-secret-concurrency-at-least-32-characters";
const draft = (ticket = prepareInformationForm(), extra = {}) => ({ ticket, body: { nom: "Rabe", prenom: "José", contact: "jose@example.mg", message: "Une demande de renseignements.", token: ticket.token, ...extra } });
const pause = () => new Promise(resolve => setTimeout(resolve, 2));

// A deterministic model of unique-index and quota row waits, not a PostgreSQL
// emulator. Transactions overlap and only hold the rows they reserve. No socket,
// pg connection or SQL execution occurs. Real Hyperdrive validation remains manual.
function concurrentDatabase({ failFirstCommit = false } = {}) {
  const rows = new Map(); const quotas = new Map(); const locks = new Map();
  const calls = []; let waits = 0; let active = 0; let maximumActive = 0; let failed = false;
  const instance = () => ({
    async transaction(work) {
      const owned = new Map(); const changes = new Map(); let row;
      active++; maximumActive = Math.max(maximumActive, active);
      const acquire = async key => {
        while (locks.has(key) && !owned.has(key)) { waits++; await locks.get(key).done; }
        if (owned.has(key)) return;
        let release; const done = new Promise(resolve => { release = resolve; });
        locks.set(key, { done }); owned.set(key, release);
      };
      const tx = { async query(sql, params = []) {
        calls.push({ sql, params });
        assert.doesNotMatch(sql, /pg_advisory|hashtextextended/);
        if (sql.startsWith("INSERT INTO demande_information_quota")) {
          const key = `${params[0]}:${+params[1]}`;
          await acquire(`quota:${key}`);
          const current = changes.get(key) ?? quotas.get(key) ?? 0;
          if (current >= params[3]) return { rows: [] };
          changes.set(key, current + 1); await pause(); return { rows: [{ nombre: current + 1 }] };
        }
        if (sql.startsWith("DELETE FROM demande_information_quota")) return { rows: [] };
        if (sql.startsWith("INSERT INTO demande_information")) {
          assert.match(sql, /ON CONFLICT \(cle_idempotence\) DO NOTHING RETURNING id/);
          await acquire(`request:${params[7]}`);
          if (rows.has(params[7])) return { rows: [] };
          row = { key: params[7], id: params[0], fingerprint: params[8] };
          await pause(); return { rows: [{ id: row.id }] };
        }
        if (sql.startsWith("SELECT empreinte_contenu")) {
          const existing = rows.get(params[0]);
          return { rows: existing ? [{ empreinte_contenu: existing.fingerprint }] : [] };
        }
        throw new Error("Unexpected simulated statement");
      } };
      try {
        const result = await work(tx);
        if (failFirstCommit && !failed && row) { failed = true; throw new Error("simulated commit failure"); }
        if (row) rows.set(row.key, row);
        changes.forEach((value, key) => quotas.set(key, value));
        return result;
      } finally {
        active--;
        owned.forEach((release, key) => { locks.delete(key); release(); });
      }
    },
  });
  return { instance, rows, quotas, calls, get waits() { return waits; }, get maximumActive() { return maximumActive; } };
}

test("deux instances, 20 créations réellement entrelacées: une ligne et un seul quota contact", async () => {
  const db = concurrentDatabase(); const instances = [db.instance(), db.instance()]; const { ticket, body } = draft();
  const results = await Promise.all(Array.from({ length: 20 }, (_, n) => createInformation(body, undefined, ticket.key, instances[n % 2])));
  assert.ok(results.every(r => r.accepted)); assert.equal(db.rows.size, 1);
  assert.equal(db.quotas.size, 1); assert.deepEqual([...db.quotas.values()], [1]);
  assert.ok(db.maximumActive > 1); assert.ok(db.waits > 0);
});
test("même clé et contenus concurrents différents: conflit sans écraser l'original ni consommer deux quotas", async () => {
  const db = concurrentDatabase(); const { ticket, body } = draft();
  const results = await Promise.allSettled([
    createInformation(body, undefined, ticket.key, db.instance()),
    createInformation({ ...body, message: "Un autre message de demande." }, undefined, ticket.key, db.instance()),
  ]);
  assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected");
  assert.equal(results[1].reason.code, "INFORMATION_IDEMPOTENCY_CONFLICT");
  assert.equal(db.rows.size, 1); assert.deepEqual([...db.quotas.values()], [1]);
});
test("rollback du premier concurrent: son attente est libérée et le second peut créer avec la même clé", async () => {
  const db = concurrentDatabase({ failFirstCommit: true }); const { ticket, body } = draft();
  const results = await Promise.allSettled([createInformation(body, undefined, ticket.key, db.instance()), createInformation(body, undefined, ticket.key, db.instance())]);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(db.rows.size, 1); assert.deepEqual([...db.quotas.values()], [1]);
});
test("réponse perdue: reprises sur une autre instance sans changer la ligne ni les quotas", async () => {
  const db = concurrentDatabase(); const { ticket, body } = draft();
  await createInformation(body, undefined, ticket.key, db.instance()); const original = db.rows.get(ticket.key).id;
  for (let n = 0; n < 5; n++) await createInformation(body, undefined, ticket.key, db.instance());
  assert.equal(db.rows.get(ticket.key).id, original); assert.deepEqual([...db.quotas.values()], [1]);
});
test("six clés concurrentes, même contact: seules trois créations et aucun quota fantôme après refus", async () => {
  const db = concurrentDatabase(); const inputs = Array.from({ length: 6 }, () => draft());
  const results = await Promise.allSettled(inputs.map(({ body, ticket }) => createInformation(body, undefined, ticket.key, db.instance())));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 3);
  assert.ok(results.filter(r => r.status === "rejected").every(r => r.reason.status === 429));
  assert.equal(db.rows.size, 3); assert.deepEqual([...db.quotas.values()], [3]);
});
test("quota compte partagé: refus de la sixième création et rollback de son quota contact", async () => {
  const db = concurrentDatabase(); const auth = { compte: { id: "11111111-1111-4111-8111-111111111111", role: "MEMBRE" } };
  const inputs = Array.from({ length: 6 }, (_, n) => draft(undefined, { contact: `personne${n}@example.mg` }));
  const results = await Promise.allSettled(inputs.map(({ body, ticket }) => createInformation(body, auth, ticket.key, db.instance())));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 5);
  assert.equal(results.filter(r => r.status === "rejected")[0].reason.status, 429);
  assert.equal(db.rows.size, 5); assert.equal(db.quotas.size, 6); assert.equal([...db.quotas.values()].reduce((a,b)=>a+b,0), 10);
});
test("un jeton expiré sans ligne ne laisse ni insertion ni compteur après rollback", async () => {
  const db = concurrentDatabase(); const { ticket, body } = draft(prepareInformationForm(Date.now() - 1800001));
  await assert.rejects(createInformation(body, undefined, ticket.key, db.instance()), { code: "INFORMATION_TOKEN_INVALID" });
  assert.equal(db.rows.size, 0); assert.equal(db.quotas.size, 0);
});
test("routage sensible: toute la requête utilise le binding dédié, jamais un repli vers le cache partagé", () => {
  const shared = { connectionString: "mock-shared-cached" }; const fresh = { connectionString: "mock-information-fresh" };
  for (const path of ["/api/demandes-information", "/api/demandes-information/preparation", "/api/demandes-information/statistiques", "/api/demandes-information/uuid/statut", "/API/DEMANDES-INFORMATION", "/api/Demandes-Information/uuid", "/api/demandes%2Dinformation/statistiques"]) {
    assert.equal(isInformationRequest(path), true);
    assert.equal(databaseBindingForRequest(path, { HYPERDRIVE: shared, HYPERDRIVE_INFORMATION: fresh }), fresh);
    for (const value of [undefined, {}, { connectionString: "" }]) assert.throws(() => databaseBindingForRequest(path, { HYPERDRIVE: shared, HYPERDRIVE_INFORMATION: value }), { code: "INFORMATION_DATABASE_UNAVAILABLE" });
  }
  for (const path of ["/api/personnes", "/api/fandraisan-anjara", "/api/auth/me", "/api/demandes-information-autre"]) assert.equal(databaseBindingForRequest(path, { HYPERDRIVE: shared }), shared);
});
test("Worker: garde 503 avant connexion, client dédié transmis aussi à l'authentification; aucun binding local déclaré", async () => {
  const worker = await readFile(new URL("../src/worker.js", import.meta.url), "utf8");
  assert.ok(worker.indexOf("databaseBindingForRequest(pathname, env)") < worker.indexOf("new Client"));
  assert.match(worker, /status: 503/); assert.match(worker, /runWithDatabaseClient\(client/);
  const config = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.doesNotMatch(config, /HYPERDRIVE_INFORMATION/);
});
